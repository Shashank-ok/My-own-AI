#ifdef _WIN32
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#define WIN32_LEAN_AND_MEAN
#endif

#include <gtest/gtest.h>
#include <httplib.h>
#include <nlohmann/json.hpp>
#include <thread>
#include <chrono>
#include <future>
#include <atomic>
#include <vector>
#include <string>
#include <shared_mutex>
#include <unordered_set>
#include "../distance.hpp"
#include "../brute_force.hpp"
#include "../kd_tree.hpp"
#include "../hnsw.hpp"

using json = nlohmann::json;

// ── IN-PROCESS V1 ENGINE FOR INTEGRATION TESTING ─────────────────────

enum class IntNsStatus { EMPTY, READY, REBUILDING, FAILED };

inline std::string intStatusStr(IntNsStatus s) {
    switch (s) {
        case IntNsStatus::EMPTY: return "empty";
        case IntNsStatus::READY: return "ready";
        case IntNsStatus::REBUILDING: return "rebuilding";
        case IntNsStatus::FAILED: return "failed";
    }
    return "unknown";
}

struct IntVectorItem {
    std::string id;
    std::string namespaceName;
    std::vector<float> values;
    json metadata;
};

class IntNamespaceStore {
    std::string nsName;
    std::unordered_map<std::string, IntVectorItem> store;
    std::unordered_map<std::string, int> idToInternalId;
    std::unordered_map<int, std::string> internalIdToId;
    BruteForce bf;
    KDTree kdt;
    HNSW hnsw;
    mutable std::shared_mutex mu;
    int nextInternalId = 1;
    int dims = 0;
    IntNsStatus status = IntNsStatus::EMPTY;

public:
    explicit IntNamespaceStore(const std::string& name)
        : nsName(name), kdt(16), hnsw(16, 200) {}

    void setStatus(IntNsStatus s) {
        std::unique_lock<std::shared_mutex> lk(mu);
        status = s;
    }

    IntNsStatus getStatus() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        if (status == IntNsStatus::EMPTY && store.size() > 0) return IntNsStatus::READY;
        return status;
    }

    std::string getStatusStr() const {
        return intStatusStr(getStatus());
    }

    bool exists(const std::string& extId) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return idToInternalId.count(extId) > 0;
    }

    std::string insert(const std::string& extId, const std::vector<float>& values,
                       const json& meta, const std::string& metric = "cosine")
    {
        std::unique_lock<std::shared_mutex> lk(mu);
        if (dims == 0) dims = (int)values.size();

        std::string finalId = extId.empty() ? ("vec_" + std::to_string(nextInternalId)) : extId;

        if (idToInternalId.count(finalId)) {
            int oldIntId = idToInternalId[finalId];
            store.erase(finalId);
            bf.remove(oldIntId);
            hnsw.remove(oldIntId);
            internalIdToId.erase(oldIntId);
            idToInternalId.erase(finalId);
        }

        int intId = nextInternalId++;
        idToInternalId[finalId] = intId;
        internalIdToId[intId] = finalId;

        std::vector<float> normValues = values;
        if (metric == "cosine") normalizeVector(normValues);

        IntVectorItem item{finalId, nsName, normValues, meta};
        store[finalId] = item;

        VectorItem vi{intId, meta.dump(), nsName, normValues};
        auto dfn = getDistFn(metric);
        bf.insert(vi);
        kdt.insert(vi);
        hnsw.insert(vi, dfn);

        status = IntNsStatus::READY;
        return finalId;
    }

    bool remove(const std::string& extId) {
        std::unique_lock<std::shared_mutex> lk(mu);
        if (!idToInternalId.count(extId)) return false;
        int intId = idToInternalId[extId];
        store.erase(extId);
        idToInternalId.erase(extId);
        internalIdToId.erase(intId);
        bf.remove(intId);
        hnsw.remove(intId);
        std::vector<VectorItem> rem;
        for (auto& [idStr, item] : store) {
            int iId = idToInternalId[idStr];
            rem.push_back({iId, item.metadata.dump(), nsName, item.values});
        }
        kdt.rebuild(rem);
        if (store.empty()) status = IntNsStatus::EMPTY;
        return true;
    }

    struct SearchHit {
        std::string id;
        float distance;
        json metadata;
        std::vector<float> values;
    };

    struct SearchResult {
        std::string ns;
        std::vector<SearchHit> hits;
        long long latencyUs;
        std::string algo;
        std::string metric;
    };

    SearchResult search(const std::vector<float>& q, int k, const std::string& metric, const std::string& algo) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        auto t0 = std::chrono::high_resolution_clock::now();
        std::vector<float> qVec = q;
        if (metric == "cosine") normalizeVector(qVec);
        auto dfn = getDistFn(metric);

        std::vector<std::pair<float, int>> raw;
        if      (algo == "bruteforce") raw = const_cast<BruteForce&>(bf).knn(qVec, k, dfn);
        else if (algo == "kdtree")     raw = const_cast<KDTree&>(kdt).knn(qVec, k, dfn);
        else                           raw = const_cast<HNSW&>(hnsw).knn(qVec, k, 50, dfn);

        long long us = std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::high_resolution_clock::now() - t0).count();

        SearchResult res;
        res.ns = nsName;
        res.latencyUs = us;
        res.algo = algo;
        res.metric = metric;

        for (auto& [dist, intId] : raw) {
            if (internalIdToId.count(intId)) {
                std::string extId = internalIdToId.at(intId);
                if (store.count(extId)) {
                    const auto& item = store.at(extId);
                    res.hits.push_back({item.id, dist, item.metadata, item.values});
                }
            }
        }
        return res;
    }

    size_t size() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return store.size();
    }

    int getDims() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return dims;
    }
};

class IntVectorEngine {
    std::unordered_map<std::string, std::shared_ptr<IntNamespaceStore>> namespaces;
    mutable std::shared_mutex mu;

public:
    std::shared_ptr<IntNamespaceStore> getOrCreateNamespace(const std::string& nsName) {
        std::unique_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        if (!namespaces.count(name)) {
            namespaces[name] = std::make_shared<IntNamespaceStore>(name);
        }
        return namespaces[name];
    }

    std::shared_ptr<IntNamespaceStore> getNamespace(const std::string& nsName) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        auto it = namespaces.find(name);
        if (it != namespaces.end()) return it->second;
        return nullptr;
    }

    bool deleteNamespace(const std::string& nsName) {
        std::unique_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        if (!namespaces.count(name)) return false;
        namespaces.erase(name);
        return true;
    }

    struct RebuildResult {
        bool success;
        std::string errorMessage;
        size_t vectorCount;
    };

    RebuildResult atomicRebuild(const std::string& nsName, const json& vectorsArray, const std::string& metric = "cosine") {
        std::string name = nsName.empty() ? "default" : nsName;

        std::shared_ptr<IntNamespaceStore> activeNs;
        {
            std::unique_lock<std::shared_mutex> lk(mu);
            if (!namespaces.count(name)) {
                namespaces[name] = std::make_shared<IntNamespaceStore>(name);
            }
            activeNs = namespaces[name];
            activeNs->setStatus(IntNsStatus::REBUILDING);
        }

        auto candidate = std::make_shared<IntNamespaceStore>(name);
        std::unordered_set<std::string> seenIds;
        int expectedDims = activeNs->getDims();

        for (size_t i = 0; i < vectorsArray.size(); ++i) {
            const auto& item = vectorsArray[i];
            if (!item.is_object() || !item.contains("values") || !item["values"].is_array()) {
                activeNs->setStatus(IntNsStatus::FAILED);
                return {false, "Item missing 'values' array.", 0};
            }

            std::vector<float> values;
            try { values = item["values"].get<std::vector<float>>(); } catch (...) {
                activeNs->setStatus(IntNsStatus::FAILED);
                return {false, "Item contains non-numeric values.", 0};
            }

            if (values.empty()) {
                activeNs->setStatus(IntNsStatus::FAILED);
                return {false, "Empty vector values.", 0};
            }

            if (expectedDims > 0 && (int)values.size() != expectedDims) {
                activeNs->setStatus(IntNsStatus::FAILED);
                return {false, "Vector dimension mismatch.", 0};
            }

            std::string extId = item.value("id", "");
            if (!extId.empty()) {
                if (seenIds.count(extId)) {
                    activeNs->setStatus(IntNsStatus::FAILED);
                    return {false, "Duplicate vector ID within rebuild batch.", 0};
                }
                seenIds.insert(extId);
            }

            json meta = item.value("metadata", json::object());
            candidate->insert(extId, values, meta, metric);
        }

        candidate->setStatus(IntNsStatus::READY);

        {
            std::unique_lock<std::shared_mutex> lk(mu);
            namespaces[name] = candidate;
        }

        return {true, "", candidate->size()};
    }

    json getStats() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        json nsStats = json::object();
        size_t total = 0;
        for (auto& [name, ns] : namespaces) {
            size_t count = ns->size();
            total += count;
            nsStats[name] = {
                {"count", count},
                {"dims", ns->getDims()},
                {"status", ns->getStatusStr()}
            };
        }
        return json{
            {"totalVectors", total},
            {"totalNamespaces", namespaces.size()},
            {"namespaces", nsStats},
            {"supportedMetrics", json::array({"cosine", "euclidean", "manhattan"})},
            {"supportedAlgorithms", json::array({"hnsw", "kdtree", "bruteforce"})}
        };
    }
};

// ── TEST SERVER FIXTURE ──────────────────────────────────────────────

class V1ServerFixture : public ::testing::Test {
protected:
    static std::unique_ptr<httplib::Server> svr;
    static std::unique_ptr<std::thread> svrThread;
    static IntVectorEngine engine;
    static std::chrono::steady_clock::time_point startTime;
    static int port;

    static void SetUpTestSuite() {
        port = 8089;
        svr = std::make_unique<httplib::Server>();
        startTime = std::chrono::steady_clock::now();

        auto sendErr = [](httplib::Response& res, int status, const std::string& code, const std::string& msg) {
            res.status = status;
            json errObj = {
                {"error", {
                    {"code", code},
                    {"message", msg}
                }}
            };
            res.set_content(errObj.dump(), "application/json");
        };

        svr->Get("/v1/health", [&](const httplib::Request&, httplib::Response& res) {
            auto uptime = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::steady_clock::now() - startTime).count();
            json h = {
                {"status", "ok"},
                {"version", "1.0.0"},
                {"uptimeSec", uptime}
            };
            res.set_content(h.dump(), "application/json");
        });

        svr->Get("/v1/stats", [&](const httplib::Request&, httplib::Response& res) {
            res.set_content(engine.getStats().dump(), "application/json");
        });

        svr->Post("/v1/vectors", [&](const httplib::Request& req, httplib::Response& res) {
            json b;
            try { b = json::parse(req.body); } catch (...) {
                sendErr(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
            }

            if (!b.contains("values") || !b["values"].is_array()) {
                sendErr(res, 422, "MISSING_FIELD", "Field 'values' must be an array of numbers."); return;
            }

            std::vector<float> values;
            try { values = b["values"].get<std::vector<float>>(); } catch (...) {
                sendErr(res, 422, "INVALID_FIELD_TYPE", "Field 'values' must contain numbers."); return;
            }

            if (values.empty()) {
                sendErr(res, 422, "INVALID_DIMENSIONS", "Vector values cannot be empty."); return;
            }

            std::string nsName = b.value("namespace", "default");
            std::string extId = b.value("id", "");
            json meta = b.value("metadata", json::object());

            auto ns = engine.getOrCreateNamespace(nsName);
            if (ns->getDims() > 0 && ns->getDims() != (int)values.size()) {
                sendErr(res, 422, "INVALID_DIMENSIONS", "Vector dimension mismatch."); return;
            }

            std::string assignedId = ns->insert(extId, values, meta);
            json out = {{"id", assignedId}, {"namespace", nsName}, {"dims", values.size()}};
            res.set_content(out.dump(), "application/json");
        });

        svr->Post("/v1/vectors/batch", [&](const httplib::Request& req, httplib::Response& res) {
            json b;
            try { b = json::parse(req.body); } catch (...) {
                sendErr(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
            }

            if (!b.contains("vectors") || !b["vectors"].is_array()) {
                sendErr(res, 422, "MISSING_FIELD", "Field 'vectors' must be an array."); return;
            }

            const auto& vecsArr = b["vectors"];
            if (vecsArr.size() > 1000) {
                sendErr(res, 422, "INVALID_BATCH_SIZE", "Batch size exceeds 1000 items."); return;
            }

            std::string defaultNs = b.value("namespace", "default");
            std::unordered_set<std::string> seenBatchIds;

            for (size_t i = 0; i < vecsArr.size(); ++i) {
                const auto& item = vecsArr[i];
                if (item.is_object() && item.contains("id") && item["id"].is_string()) {
                    std::string idStr = item["id"].get<std::string>();
                    if (!idStr.empty()) {
                        if (seenBatchIds.count(idStr)) {
                            sendErr(res, 422, "DUPLICATE_ID", "Duplicate vector ID in batch."); return;
                        }
                        seenBatchIds.insert(idStr);
                    }
                }
            }

            int inserted = 0, updated = 0, rejected = 0;
            for (const auto& item : vecsArr) {
                if (!item.is_object() || !item.contains("values") || !item["values"].is_array()) {
                    rejected++; continue;
                }
                std::vector<float> values;
                try { values = item["values"].get<std::vector<float>>(); } catch (...) { rejected++; continue; }
                if (values.empty()) { rejected++; continue; }

                std::string itemNs = item.value("namespace", defaultNs);
                std::string extId = item.value("id", "");
                json meta = item.value("metadata", json::object());

                auto ns = engine.getOrCreateNamespace(itemNs);
                if (ns->getDims() > 0 && ns->getDims() != (int)values.size()) { rejected++; continue; }

                bool isUpdate = !extId.empty() && ns->exists(extId);
                ns->insert(extId, values, meta);
                if (isUpdate) updated++; else inserted++;
            }

            json out = {{"inserted", inserted}, {"updated", updated}, {"rejected", rejected}, {"namespace", defaultNs}};
            res.set_content(out.dump(), "application/json");
        });

        svr->Post("/v1/vectors/search", [&](const httplib::Request& req, httplib::Response& res) {
            json b;
            try { b = json::parse(req.body); } catch (...) {
                sendErr(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
            }

            std::string nsName = b.value("namespace", "default");
            if (!b.contains("vector") || !b["vector"].is_array()) {
                sendErr(res, 422, "MISSING_FIELD", "Field 'vector' must be a query float array."); return;
            }

            std::vector<float> q;
            try { q = b["vector"].get<std::vector<float>>(); } catch (...) {
                sendErr(res, 422, "INVALID_FIELD_TYPE", "Field 'vector' must be array of numbers."); return;
            }
            if (q.empty()) { sendErr(res, 422, "INVALID_DIMENSIONS", "Query vector cannot be empty."); return; }

            if (!b.contains("k") || !b["k"].is_number_integer()) {
                sendErr(res, 422, "MISSING_FIELD", "Field 'k' must be integer."); return;
            }
            int k = b["k"].get<int>();
            if (k <= 0) { sendErr(res, 422, "INVALID_K", "k must be > 0."); return; }

            std::string algo = b.value("algorithm", "hnsw");
            std::string metric = b.value("metric", "cosine");

            if (algo != "hnsw" && algo != "kdtree" && algo != "bruteforce") {
                sendErr(res, 422, "INVALID_ALGORITHM", "Unsupported algorithm."); return;
            }
            if (metric != "cosine" && metric != "euclidean" && metric != "manhattan") {
                sendErr(res, 422, "INVALID_METRIC", "Unsupported metric."); return;
            }

            auto ns = engine.getNamespace(nsName);
            if (!ns || ns->size() == 0) {
                json out = {{"namespace", nsName}, {"hits", json::array()}, {"latencyUs", 0}, {"algorithm", algo}, {"metric", metric}};
                res.set_content(out.dump(), "application/json"); return;
            }

            if (ns->getDims() > 0 && ns->getDims() != (int)q.size()) {
                sendErr(res, 422, "INVALID_DIMENSIONS", "Query dimension mismatch."); return;
            }

            auto sres = ns->search(q, k, metric, algo);
            json hitsArr = json::array();
            for (const auto& hit : sres.hits) {
                hitsArr.push_back({{"id", hit.id}, {"distance", hit.distance}, {"metadata", hit.metadata}});
            }
            json out = {{"namespace", nsName}, {"hits", hitsArr}, {"latencyUs", sres.latencyUs}, {"algorithm", sres.algo}, {"metric", sres.metric}};
            res.set_content(out.dump(), "application/json");
        });

        svr->Delete(R"(/v1/vectors/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
            std::string extId = req.matches[1];
            std::string nsName = req.get_param_value("namespace");
            if (nsName.empty()) nsName = "default";

            auto ns = engine.getNamespace(nsName);
            if (!ns || !ns->remove(extId)) {
                sendErr(res, 404, "NOT_FOUND", "Vector ID not found."); return;
            }
            json out = {{"deleted", true}, {"id", extId}, {"namespace", nsName}};
            res.set_content(out.dump(), "application/json");
        });

        svr->Delete(R"(/v1/namespaces/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
            std::string nsName = req.matches[1];
            if (!engine.deleteNamespace(nsName)) {
                sendErr(res, 404, "NOT_FOUND", "Namespace not found."); return;
            }
            json out = {{"deleted", true}, {"namespace", nsName}};
            res.set_content(out.dump(), "application/json");
        });

        svr->Get(R"(/v1/namespaces/([^/]+)/status)", [&](const httplib::Request& req, httplib::Response& res) {
            std::string nsName = req.matches[1];
            auto ns = engine.getNamespace(nsName);
            if (!ns) { sendErr(res, 404, "NOT_FOUND", "Namespace not found."); return; }
            json out = {{"namespace", nsName}, {"status", ns->getStatusStr()}, {"vectorCount", ns->size()}, {"dims", ns->getDims()}};
            res.set_content(out.dump(), "application/json");
        });

        svr->Post(R"(/v1/namespaces/([^/]+)/rebuild)", [&](const httplib::Request& req, httplib::Response& res) {
            std::string nsName = req.matches[1];
            json b;
            try { b = json::parse(req.body); } catch (...) {
                sendErr(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
            }
            if (!b.contains("vectors") || !b["vectors"].is_array()) {
                sendErr(res, 422, "MISSING_FIELD", "Field 'vectors' must be array."); return;
            }
            std::string metric = b.value("metric", "cosine");
            auto rebuildRes = engine.atomicRebuild(nsName, b["vectors"], metric);
            if (!rebuildRes.success) {
                sendErr(res, 422, "REBUILD_FAILED", rebuildRes.errorMessage); return;
            }
            json out = {{"namespace", nsName}, {"status", "ready"}, {"rebuilt", true}, {"vectorCount", rebuildRes.vectorCount}};
            res.set_content(out.dump(), "application/json");
        });

        svrThread = std::make_unique<std::thread>([]() {
            svr->listen("127.0.0.1", port);
        });

        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    static void TearDownTestSuite() {
        if (svr) svr->stop();
        if (svrThread && svrThread->joinable()) svrThread->join();
    }
};

std::unique_ptr<httplib::Server> V1ServerFixture::svr;
std::unique_ptr<std::thread> V1ServerFixture::svrThread;
IntVectorEngine V1ServerFixture::engine;
std::chrono::steady_clock::time_point V1ServerFixture::startTime;
int V1ServerFixture::port = 8089;

// ── INTEGRATION TEST CASES ───────────────────────────────────────────

TEST_F(V1ServerFixture, GetHealth) {
    httplib::Client cli("127.0.0.1", port);
    auto res = cli.Get("/v1/health");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);

    json body = json::parse(res->body);
    EXPECT_EQ(body["status"], "ok");
    EXPECT_EQ(body["version"], "1.0.0");
    EXPECT_GE(body["uptimeSec"].get<long long>(), 0);
}

TEST_F(V1ServerFixture, GetStats) {
    httplib::Client cli("127.0.0.1", port);
    auto res = cli.Get("/v1/stats");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);

    json body = json::parse(res->body);
    EXPECT_TRUE(body.contains("supportedMetrics"));
    EXPECT_TRUE(body.contains("supportedAlgorithms"));
}

TEST_F(V1ServerFixture, ValidSingleInsertion) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"id", "v_single"},
        {"namespace", "ns_single"},
        {"values", {1.0f, 0.0f, 0.0f}},
        {"metadata", {{"tag", "test"}}}
    };
    auto res = cli.Post("/v1/vectors", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);

    json body = json::parse(res->body);
    EXPECT_EQ(body["id"], "v_single");
    EXPECT_EQ(body["namespace"], "ns_single");
    EXPECT_EQ(body["dims"], 3);
}

TEST_F(V1ServerFixture, ValidBatchInsertion) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"namespace", "ns_batch"},
        {"vectors", {
            {{"id", "b1"}, {"values", {1.0f, 0.0f, 0.0f}}},
            {{"id", "b2"}, {"values", {0.0f, 1.0f, 0.0f}}}
        }}
    };
    auto res = cli.Post("/v1/vectors/batch", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);

    json body = json::parse(res->body);
    EXPECT_EQ(body["inserted"], 2);
    EXPECT_EQ(body["updated"], 0);
    EXPECT_EQ(body["rejected"], 0);
}

TEST_F(V1ServerFixture, DuplicateBatchIDs) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"namespace", "ns_dup"},
        {"vectors", {
            {{"id", "dup1"}, {"values", {1.0f, 0.0f}}},
            {{"id", "dup1"}, {"values", {0.0f, 1.0f}}}
        }}
    };
    auto res = cli.Post("/v1/vectors/batch", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 422);

    json body = json::parse(res->body);
    EXPECT_EQ(body["error"]["code"], "DUPLICATE_ID");
}

TEST_F(V1ServerFixture, MalformedJSON) {
    httplib::Client cli("127.0.0.1", port);
    auto res = cli.Post("/v1/vectors", "{invalid json...", "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 400);

    json body = json::parse(res->body);
    EXPECT_EQ(body["error"]["code"], "INVALID_JSON");
}

TEST_F(V1ServerFixture, SearchInEmptyNamespace) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"namespace", "non_existent_ns"},
        {"vector", {1.0f, 0.0f, 0.0f}},
        {"k", 3}
    };
    auto res = cli.Post("/v1/vectors/search", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);

    json body = json::parse(res->body);
    EXPECT_EQ(body["hits"].size(), 0u);
}

TEST_F(V1ServerFixture, InvalidVectorDimensions) {
    httplib::Client cli("127.0.0.1", port);
    // First create a namespace with 3D vectors
    cli.Post("/v1/vectors", json({{"namespace", "ns_dim"}, {"values", {1.0f, 2.0f, 3.0f}}}).dump(), "application/json");

    // Try inserting a 2D vector
    auto res = cli.Post("/v1/vectors", json({{"namespace", "ns_dim"}, {"values", {1.0f, 2.0f}}}).dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 422);

    json body = json::parse(res->body);
    EXPECT_EQ(body["error"]["code"], "INVALID_DIMENSIONS");
}

TEST_F(V1ServerFixture, InvalidK) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"namespace", "ns_k"},
        {"vector", {1.0f, 0.0f}},
        {"k", -1}
    };
    auto res = cli.Post("/v1/vectors/search", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 422);

    json body = json::parse(res->body);
    EXPECT_EQ(body["error"]["code"], "INVALID_K");
}

TEST_F(V1ServerFixture, UnsupportedAlgorithm) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"namespace", "ns_algo"},
        {"vector", {1.0f, 0.0f}},
        {"k", 2},
        {"algorithm", "quantum"}
    };
    auto res = cli.Post("/v1/vectors/search", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 422);

    json body = json::parse(res->body);
    EXPECT_EQ(body["error"]["code"], "INVALID_ALGORITHM");
}

TEST_F(V1ServerFixture, UnsupportedMetric) {
    httplib::Client cli("127.0.0.1", port);
    json payload = {
        {"namespace", "ns_metric"},
        {"vector", {1.0f, 0.0f}},
        {"k", 2},
        {"metric", "minkowski"}
    };
    auto res = cli.Post("/v1/vectors/search", payload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 422);

    json body = json::parse(res->body);
    EXPECT_EQ(body["error"]["code"], "INVALID_METRIC");
}

TEST_F(V1ServerFixture, NamespaceIsolation) {
    httplib::Client cli("127.0.0.1", port);
    cli.Post("/v1/vectors", json({{"id", "alpha_v"}, {"namespace", "ns_iso_a"}, {"values", {1.0f, 0.0f}}}).dump(), "application/json");
    cli.Post("/v1/vectors", json({{"id", "beta_v"}, {"namespace", "ns_iso_b"}, {"values", {1.0f, 0.0f}}}).dump(), "application/json");

    // Search in ns_iso_a MUST return alpha_v only
    json searchPayload = {{"namespace", "ns_iso_a"}, {"vector", {1.0f, 0.0f}}, {"k", 5}};
    auto res = cli.Post("/v1/vectors/search", searchPayload.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);

    json body = json::parse(res->body);
    ASSERT_EQ(body["hits"].size(), 1u);
    EXPECT_EQ(body["hits"][0]["id"], "alpha_v");
}

TEST_F(V1ServerFixture, DeleteExistingAndMissingVector) {
    httplib::Client cli("127.0.0.1", port);
    cli.Post("/v1/vectors", json({{"id", "to_del"}, {"namespace", "ns_del"}, {"values", {1.0f, 0.0f}}}).dump(), "application/json");

    // Delete existing
    auto res1 = cli.Delete("/v1/vectors/to_del?namespace=ns_del");
    ASSERT_TRUE(res1);
    EXPECT_EQ(res1->status, 200);
    EXPECT_EQ(json::parse(res1->body)["deleted"], true);

    // Delete missing
    auto res2 = cli.Delete("/v1/vectors/missing?namespace=ns_del");
    ASSERT_TRUE(res2);
    EXPECT_EQ(res2->status, 404);
    EXPECT_EQ(json::parse(res2->body)["error"]["code"], "NOT_FOUND");
}

TEST_F(V1ServerFixture, AtomicRebuildSuccessAndFailureRollback) {
    httplib::Client cli("127.0.0.1", port);
    cli.Post("/v1/vectors", json({{"id", "orig"}, {"namespace", "ns_rb"}, {"values", {1.0f, 0.0f, 0.0f}}}).dump(), "application/json");

    // Rebuild failure (dim mismatch: 2D vector into 3D namespace)
    json invalidRebuild = {{"vectors", {{{"id", "bad"}, {"values", {1.0f, 0.0f}}}}}};
    auto resFail = cli.Post("/v1/namespaces/ns_rb/rebuild", invalidRebuild.dump(), "application/json");
    ASSERT_TRUE(resFail);
    EXPECT_EQ(resFail->status, 422);
    EXPECT_EQ(json::parse(resFail->body)["error"]["code"], "REBUILD_FAILED");

    // Verify active index preserved & status is failed
    auto resStatus = cli.Get("/v1/namespaces/ns_rb/status");
    ASSERT_TRUE(resStatus);
    json statusBody = json::parse(resStatus->body);
    EXPECT_EQ(statusBody["status"], "failed");
    EXPECT_EQ(statusBody["vectorCount"], 1);

    // Rebuild success
    json validRebuild = {{"vectors", {
        {{"id", "new1"}, {"values", {0.5f, 0.5f, 0.0f}}},
        {{"id", "new2"}, {"values", {0.2f, 0.8f, 0.0f}}}
    }}};
    auto resSucc = cli.Post("/v1/namespaces/ns_rb/rebuild", validRebuild.dump(), "application/json");
    ASSERT_TRUE(resSucc);
    EXPECT_EQ(resSucc->status, 200);
    EXPECT_EQ(json::parse(resSucc->body)["status"], "ready");
}
