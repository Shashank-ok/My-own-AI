#include <gtest/gtest.h>
#include <nlohmann/json.hpp>
#include <vector>
#include <string>
#include "../distance.hpp"
#include "../brute_force.hpp"
#include "../kd_tree.hpp"
#include "../hnsw.hpp"
#include <shared_mutex>
#include <memory>
#include <unordered_map>
#include <chrono>

using json = nlohmann::json;

// Re-declarations for unit testing NamespaceStore & VectorEngine logic directly
struct V1VectorItemTest {
    std::string id;
    std::string namespaceName;
    std::vector<float> values;
    json metadata;
};

class NamespaceStoreTest {
    std::string nsName;
    std::unordered_map<std::string, V1VectorItemTest> store;
    std::unordered_map<std::string, int> idToInternalId;
    std::unordered_map<int, std::string> internalIdToId;
    BruteForce bf;
    KDTree kdt;
    HNSW hnsw;
    mutable std::shared_mutex mu;
    int nextInternalId = 1;
    int dims = 0;

public:
    explicit NamespaceStoreTest(const std::string& name)
        : nsName(name), kdt(16), hnsw(16, 200) {}

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

        V1VectorItemTest item{finalId, nsName, normValues, meta};
        store[finalId] = item;

        VectorItem vi{intId, meta.dump(), nsName, normValues};
        auto dfn = getDistFn(metric);
        bf.insert(vi);
        kdt.insert(vi);
        hnsw.insert(vi, dfn);

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
};

class VectorEngineTest {
    std::unordered_map<std::string, std::shared_ptr<NamespaceStoreTest>> namespaces;
    mutable std::shared_mutex mu;

public:
    std::shared_ptr<NamespaceStoreTest> getOrCreateNamespace(const std::string& nsName) {
        std::unique_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        if (!namespaces.count(name)) {
            namespaces[name] = std::make_shared<NamespaceStoreTest>(name);
        }
        return namespaces[name];
    }

    std::shared_ptr<NamespaceStoreTest> getNamespace(const std::string& nsName) const {
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

    size_t totalVectors() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        size_t total = 0;
        for (auto& [name, ns] : namespaces) total += ns->size();
        return total;
    }

    size_t totalNamespaces() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return namespaces.size();
    }
};

TEST(V1ApiTest, InsertAndSearchInNamespace) {
    VectorEngineTest engine;
    auto ns = engine.getOrCreateNamespace("tenant_a");

    std::string id1 = ns->insert("vec1", {1.0f, 0.0f, 0.0f}, {{"tag", "first"}});
    std::string id2 = ns->insert("vec2", {0.0f, 1.0f, 0.0f}, {{"tag", "second"}});

    EXPECT_EQ(id1, "vec1");
    EXPECT_EQ(id2, "vec2");
    EXPECT_EQ(ns->size(), 2u);

    auto res = ns->search({1.0f, 0.0f, 0.0f}, 1, "cosine", "hnsw");
    ASSERT_EQ(res.hits.size(), 1u);
    EXPECT_EQ(res.hits[0].id, "vec1");
    EXPECT_NEAR(res.hits[0].distance, 0.0f, 1e-4f);
}

TEST(V1ApiTest, NamespaceIsolation) {
    VectorEngineTest engine;
    auto nsA = engine.getOrCreateNamespace("tenant_a");
    auto nsB = engine.getOrCreateNamespace("tenant_b");

    nsA->insert("doc_a", {1.0f, 0.0f, 0.0f}, {{"ns", "A"}});
    nsB->insert("doc_b", {1.0f, 0.0f, 0.0f}, {{"ns", "B"}});

    // Search in tenant_a MUST NOT return items from tenant_b
    auto resA = nsA->search({1.0f, 0.0f, 0.0f}, 10, "cosine", "hnsw");
    ASSERT_EQ(resA.hits.size(), 1u);
    EXPECT_EQ(resA.hits[0].id, "doc_a");

    auto resB = nsB->search({1.0f, 0.0f, 0.0f}, 10, "cosine", "hnsw");
    ASSERT_EQ(resB.hits.size(), 1u);
    EXPECT_EQ(resB.hits[0].id, "doc_b");
}

TEST(V1ApiTest, DeleteVectorAndNamespace) {
    VectorEngineTest engine;
    auto ns = engine.getOrCreateNamespace("temp_ns");
    ns->insert("v1", {1.0f, 2.0f}, {});
    ns->insert("v2", {3.0f, 4.0f}, {});

    EXPECT_EQ(ns->size(), 2u);
    EXPECT_TRUE(ns->remove("v1"));
    EXPECT_EQ(ns->size(), 1u);
    EXPECT_FALSE(ns->remove("v1")); // Second delete returns false

    EXPECT_TRUE(engine.deleteNamespace("temp_ns"));
    EXPECT_EQ(engine.totalNamespaces(), 0u);
    EXPECT_FALSE(engine.deleteNamespace("temp_ns"));
}
