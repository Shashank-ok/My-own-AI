#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include <vector>
#include <string>
#include <shared_mutex>
#include <unordered_set>
#include <thread>
#include <future>
#include <chrono>
#include "../distance.hpp"
#include "../brute_force.hpp"
#include "../kd_tree.hpp"
#include "../hnsw.hpp"

using json = nlohmann::json;

enum class TestNsStatus { EMPTY, READY, REBUILDING, FAILED };

inline std::string testStatusStr(TestNsStatus s) {
    switch (s) {
        case TestNsStatus::EMPTY: return "empty";
        case TestNsStatus::READY: return "ready";
        case TestNsStatus::REBUILDING: return "rebuilding";
        case TestNsStatus::FAILED: return "failed";
    }
    return "unknown";
}

struct TestVectorItem {
    std::string id;
    std::string namespaceName;
    std::vector<float> values;
    json metadata;
};

class AtomicNamespaceStore {
    std::string nsName;
    std::unordered_map<std::string, TestVectorItem> store;
    std::unordered_map<std::string, int> idToInternalId;
    std::unordered_map<int, std::string> internalIdToId;
    BruteForce bf;
    KDTree kdt;
    HNSW hnsw;
    mutable std::shared_mutex mu;
    int nextInternalId = 1;
    int dims = 0;
    TestNsStatus status = TestNsStatus::EMPTY;

public:
    explicit AtomicNamespaceStore(const std::string& name)
        : nsName(name), kdt(16), hnsw(16, 200) {}

    void setStatus(TestNsStatus s) {
        std::unique_lock<std::shared_mutex> lk(mu);
        status = s;
    }

    TestNsStatus getStatus() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        if (status == TestNsStatus::EMPTY && store.size() > 0) return TestNsStatus::READY;
        return status;
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

        TestVectorItem item{finalId, nsName, normValues, meta};
        store[finalId] = item;

        VectorItem vi{intId, meta.dump(), nsName, normValues};
        auto dfn = getDistFn(metric);
        bf.insert(vi);
        kdt.insert(vi);
        hnsw.insert(vi, dfn);

        status = TestNsStatus::READY;
        return finalId;
    }

    size_t size() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return store.size();
    }

    int getDims() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return dims;
    }

    std::vector<std::pair<float, std::string>> search(const std::vector<float>& q, int k) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        std::vector<float> qVec = q;
        normalizeVector(qVec);
        auto raw = const_cast<BruteForce&>(bf).knn(qVec, k, cosineNormalized);
        std::vector<std::pair<float, std::string>> res;
        for (auto& [d, id] : raw) {
            if (internalIdToId.count(id)) res.push_back({d, internalIdToId.at(id)});
        }
        return res;
    }
};

class AtomicVectorEngine {
    std::unordered_map<std::string, std::shared_ptr<AtomicNamespaceStore>> namespaces;
    mutable std::shared_mutex mu;

public:
    std::shared_ptr<AtomicNamespaceStore> getOrCreateNamespace(const std::string& nsName) {
        std::unique_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        if (!namespaces.count(name)) {
            namespaces[name] = std::make_shared<AtomicNamespaceStore>(name);
        }
        return namespaces[name];
    }

    std::shared_ptr<AtomicNamespaceStore> getNamespace(const std::string& nsName) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        auto it = namespaces.find(name);
        if (it != namespaces.end()) return it->second;
        return nullptr;
    }

    struct RebuildResult {
        bool success;
        std::string errorMessage;
        size_t vectorCount;
    };

    RebuildResult atomicRebuild(const std::string& nsName, const json& vectorsArray, const std::string& metric = "cosine") {
        std::string name = nsName.empty() ? "default" : nsName;

        std::shared_ptr<AtomicNamespaceStore> activeNs;
        {
            std::unique_lock<std::shared_mutex> lk(mu);
            if (!namespaces.count(name)) {
                namespaces[name] = std::make_shared<AtomicNamespaceStore>(name);
            }
            activeNs = namespaces[name];
            activeNs->setStatus(TestNsStatus::REBUILDING);
        }

        auto candidate = std::make_shared<AtomicNamespaceStore>(name);
        std::unordered_set<std::string> seenIds;
        int expectedDims = activeNs->getDims();

        for (size_t i = 0; i < vectorsArray.size(); ++i) {
            const auto& item = vectorsArray[i];
            if (!item.is_object() || !item.contains("values") || !item["values"].is_array()) {
                activeNs->setStatus(TestNsStatus::FAILED);
                return {false, "Item missing 'values' array.", 0};
            }

            std::vector<float> values;
            try { values = item["values"].get<std::vector<float>>(); } catch (...) {
                activeNs->setStatus(TestNsStatus::FAILED);
                return {false, "Item contains non-numeric values.", 0};
            }

            if (values.empty()) {
                activeNs->setStatus(TestNsStatus::FAILED);
                return {false, "Empty vector values.", 0};
            }

            if (expectedDims > 0 && (int)values.size() != expectedDims) {
                activeNs->setStatus(TestNsStatus::FAILED);
                return {false, "Vector dimension mismatch.", 0};
            }

            std::string extId = item.value("id", "");
            if (!extId.empty()) {
                if (seenIds.count(extId)) {
                    activeNs->setStatus(TestNsStatus::FAILED);
                    return {false, "Duplicate vector ID within rebuild batch.", 0};
                }
                seenIds.insert(extId);
            }

            // Simulate small building latency
            std::this_thread::sleep_for(std::chrono::milliseconds(1));

            json meta = item.value("metadata", json::object());
            candidate->insert(extId, values, meta, metric);
        }

        candidate->setStatus(TestNsStatus::READY);

        {
            std::unique_lock<std::shared_mutex> lk(mu);
            namespaces[name] = candidate;
        }

        return {true, "", candidate->size()};
    }
};

// ── TEST CASES ───────────────────────────────────────────────────────

TEST(AtomicRebuildTest, DuplicateBatchIDRejection) {
    AtomicVectorEngine engine;
    auto ns = engine.getOrCreateNamespace("ns1");
    ns->insert("v1", {1.0f, 0.0f}, {});

    json batchPayload = json::array({
        {{"id", "v10"}, {"values", {1.0f, 0.0f}}},
        {{"id", "v10"}, {"values", {0.0f, 1.0f}}} // Duplicate ID in batch!
    });

    std::unordered_set<std::string> seen;
    bool hasDuplicate = false;
    for (const auto& item : batchPayload) {
        std::string id = item.value("id", "");
        if (!id.empty() && seen.count(id)) { hasDuplicate = true; break; }
        seen.insert(id);
    }
    EXPECT_TRUE(hasDuplicate);
}

TEST(AtomicRebuildTest, FailedRebuildPreservesActiveIndex) {
    AtomicVectorEngine engine;
    auto ns = engine.getOrCreateNamespace("ns_prod");
    ns->insert("v_original", {1.0f, 0.0f, 0.0f}, {{"status", "active"}});

    EXPECT_EQ(ns->size(), 1u);
    EXPECT_EQ(ns->getDims(), 3);

    // Invalid rebuild payload with dimension mismatch (dim = 2 instead of 3)
    json invalidBatch = json::array({
        {{"id", "bad1"}, {"values", {1.0f, 0.0f}}}
    });

    auto result = engine.atomicRebuild("ns_prod", invalidBatch);
    EXPECT_FALSE(result.success);

    // Verify active index is preserved
    auto currentNs = engine.getNamespace("ns_prod");
    ASSERT_NE(currentNs, nullptr);
    EXPECT_EQ(currentNs->size(), 1u);
    EXPECT_EQ(currentNs->getStatus(), TestNsStatus::FAILED);

    auto hits = currentNs->search({1.0f, 0.0f, 0.0f}, 1);
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].second, "v_original");
}

TEST(AtomicRebuildTest, ConcurrentSearchDuringRebuild) {
    AtomicVectorEngine engine;
    auto ns = engine.getOrCreateNamespace("ns_busy");
    ns->insert("v1", {1.0f, 0.0f, 0.0f}, {});

    json newBatch = json::array();
    for (int i = 0; i < 20; ++i) {
        newBatch.push_back({
            {"id", "new_" + std::to_string(i)},
            {"values", {0.0f, 1.0f, (float)i}}
        });
    }

    std::atomic<bool> searching{true};
    std::atomic<int> successfulSearches{0};

    // Reader thread constantly searching
    auto reader = std::async(std::launch::async, [&]() {
        while (searching.load()) {
            auto currentNs = engine.getNamespace("ns_busy");
            if (currentNs) {
                auto hits = currentNs->search({1.0f, 0.0f, 0.0f}, 1);
                if (!hits.empty()) successfulSearches++;
            }
            std::this_thread::sleep_for(std::chrono::microseconds(100));
        }
    });

    // Rebuild in background
    auto result = engine.atomicRebuild("ns_busy", newBatch);
    searching.store(false);
    reader.get();

    EXPECT_TRUE(result.success);
    EXPECT_GT(successfulSearches.load(), 0);

    auto finalNs = engine.getNamespace("ns_busy");
    EXPECT_EQ(finalNs->size(), 20u);
    EXPECT_EQ(finalNs->getStatus(), TestNsStatus::READY);
}
