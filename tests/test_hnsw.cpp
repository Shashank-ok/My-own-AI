#include <gtest/gtest.h>
#include "../hnsw.hpp"
#include "../brute_force.hpp"
#include "../distance.hpp"

TEST(HNSWTest, InsertAndBasicSearch) {
    HNSW hnsw(16, 200);
    VectorItem v1{1, "Item 1", "catA", {1.0f, 0.0f}};
    VectorItem v2{2, "Item 2", "catB", {0.0f, 1.0f}};
    VectorItem v3{3, "Item 3", "catA", {0.5f, 0.5f}};

    hnsw.insert(v1, euclidean);
    hnsw.insert(v2, euclidean);
    hnsw.insert(v3, euclidean);

    EXPECT_EQ(hnsw.size(), 3u);

    std::vector<float> query = {1.0f, 0.0f};
    auto hits = hnsw.knn(query, 2, 50, euclidean);

    ASSERT_EQ(hits.size(), 2u);
    EXPECT_EQ(hits[0].second, 1);
    EXPECT_NEAR(hits[0].first, 0.0f, 1e-5f);
}

TEST(HNSWTest, GraphInfo) {
    HNSW hnsw(16, 200);
    VectorItem v1{1, "Node 1", "catA", {0.9f, 0.1f}};
    hnsw.insert(v1, cosine);

    auto info = hnsw.getInfo();
    EXPECT_EQ(info.nodeCount, 1);
    EXPECT_EQ(info.nodes.size(), 1u);
    EXPECT_EQ(info.nodes[0].id, 1);
    EXPECT_EQ(info.nodes[0].metadata, "Node 1");
}

TEST(HNSWTest, RemoveNode) {
    HNSW hnsw(16, 200);
    VectorItem v1{100, "Node 100", "catA", {1.0f, 0.0f}};
    VectorItem v2{200, "Node 200", "catB", {0.0f, 1.0f}};

    hnsw.insert(v1, euclidean);
    hnsw.insert(v2, euclidean);
    EXPECT_EQ(hnsw.size(), 2u);

    hnsw.remove(100);
    EXPECT_EQ(hnsw.size(), 1u);

    std::vector<float> query = {1.0f, 0.0f};
    auto hits = hnsw.knn(query, 1, 50, euclidean);
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].second, 200);
}

TEST(HNSWTest, DeleteAllNodes) {
    HNSW hnsw(16, 200);
    for (int i = 1; i <= 5; ++i) {
        VectorItem item{i, "item_" + std::to_string(i), "cat", {static_cast<float>(i), 1.0f}};
        hnsw.insert(item, euclidean);
    }
    EXPECT_EQ(hnsw.size(), 5u);

    for (int i = 1; i <= 5; ++i) {
        hnsw.remove(i);
    }

    EXPECT_EQ(hnsw.size(), 0u);
    auto info = hnsw.getInfo();
    EXPECT_EQ(info.topLayer, -1);
    EXPECT_EQ(info.nodeCount, 0);

    std::vector<float> query = {1.0f, 1.0f};
    auto hits = hnsw.knn(query, 3, 50, euclidean);
    EXPECT_TRUE(hits.empty());
}

TEST(HNSWTest, MutationGroundTruthComparison) {
    BruteForce bf;
    HNSW hnsw(16, 200);

    const int N = 60;
    const int D = 16;
    std::mt19937 rng(42);
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);

    // Insert 60 items
    for (int i = 1; i <= N; ++i) {
        std::vector<float> vec(D);
        for (int d = 0; d < D; ++d) vec[d] = dist(rng);
        VectorItem item{i, "item_" + std::to_string(i), "cat", vec};
        bf.insert(item);
        hnsw.insert(item, cosine);
    }

    // Delete 30 odd-numbered items from both indexes
    for (int i = 1; i <= N; i += 2) {
        bf.remove(i);
        hnsw.remove(i);
    }

    EXPECT_EQ(bf.items.size(), 30u);
    EXPECT_EQ(hnsw.size(), 30u);

    // Compare 10 search queries against BruteForce ground truth
    int totalMatches = 0;
    int k = 5;
    int numQueries = 10;

    for (int qIdx = 0; qIdx < numQueries; ++qIdx) {
        std::vector<float> q(D);
        for (int d = 0; d < D; ++d) q[d] = dist(rng);

        auto bfHits   = bf.knn(q, k, cosine);
        auto hnswHits = hnsw.knn(q, k, 100, cosine);

        for (auto& hHit : hnswHits) {
            for (auto& bHit : bfHits) {
                if (hHit.second == bHit.second) {
                    totalMatches++;
                    break;
                }
            }
        }
    }

    float recall = static_cast<float>(totalMatches) / (numQueries * k);
    EXPECT_GT(recall, 0.80f);
}
