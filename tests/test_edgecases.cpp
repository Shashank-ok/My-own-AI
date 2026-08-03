#include <gtest/gtest.h>
#include "../types.hpp"
#include "../distance.hpp"
#include "../brute_force.hpp"
#include "../kd_tree.hpp"
#include "../hnsw.hpp"
#include <vector>
#include <random>

// 1. Empty Index Search
TEST(EdgeCaseTest, EmptyIndexSearch) {
    std::vector<float> q = {1.0f, 0.0f};

    BruteForce bf;
    auto bfHits = bf.knn(q, 5, euclidean);
    EXPECT_TRUE(bfHits.empty());

    KDTree kdt(2);
    auto kdtHits = kdt.knn(q, 5, euclidean);
    EXPECT_TRUE(kdtHits.empty());

    HNSW hnsw(16, 200);
    auto hnswHits = hnsw.knn(q, 5, 50, euclidean);
    EXPECT_TRUE(hnswHits.empty());
}

// 2. One-Item Index
TEST(EdgeCaseTest, OneItemIndex) {
    std::vector<float> q = {1.0f, 0.0f};
    VectorItem item{101, "single", "cat", {1.0f, 0.0f}};

    BruteForce bf;
    bf.insert(item);
    EXPECT_EQ(bf.knn(q, 5, euclidean).size(), 1u);

    KDTree kdt(2);
    kdt.insert(item);
    EXPECT_EQ(kdt.knn(q, 5, euclidean).size(), 1u);

    HNSW hnsw(16, 200);
    hnsw.insert(item, euclidean);
    EXPECT_EQ(hnsw.knn(q, 5, 50, euclidean).size(), 1u);
}

// 3. Duplicate Vectors
TEST(EdgeCaseTest, DuplicateVectors) {
    std::vector<float> q = {1.0f, 0.0f};
    VectorItem v1{1, "item1", "cat", {1.0f, 0.0f}};
    VectorItem v2{2, "item2", "cat", {1.0f, 0.0f}};

    BruteForce bf;
    bf.insert(v1);
    bf.insert(v2);
    EXPECT_EQ(bf.knn(q, 2, euclidean).size(), 2u);

    KDTree kdt(2);
    kdt.insert(v1);
    kdt.insert(v2);
    EXPECT_EQ(kdt.knn(q, 2, euclidean).size(), 2u);

    HNSW hnsw(16, 200);
    hnsw.insert(v1, euclidean);
    hnsw.insert(v2, euclidean);
    EXPECT_EQ(hnsw.knn(q, 2, 50, euclidean).size(), 2u);
}

// 4. Duplicate IDs
TEST(EdgeCaseTest, DuplicateIDs) {
    VectorItem v1{42, "first", "cat", {1.0f, 0.0f}};
    VectorItem v2{42, "second", "cat", {0.0f, 1.0f}};

    BruteForce bf;
    bf.insert(v1);
    bf.insert(v2);
    EXPECT_EQ(bf.items.size(), 2u);

    HNSW hnsw(16, 200);
    hnsw.insert(v1, euclidean);
    hnsw.insert(v2, euclidean);
    EXPECT_EQ(hnsw.size(), 1u);
}

// 5. Deleting a Missing ID
TEST(EdgeCaseTest, DeleteMissingID) {
    VectorItem v1{1, "item1", "cat", {1.0f, 0.0f}};

    BruteForce bf;
    bf.insert(v1);
    bf.remove(999);
    EXPECT_EQ(bf.items.size(), 1u);

    HNSW hnsw(16, 200);
    hnsw.insert(v1, euclidean);
    hnsw.remove(999);
    EXPECT_EQ(hnsw.size(), 1u);
}

// 6. Deleting HNSW Entry Point
TEST(EdgeCaseTest, DeleteHNSWEntryPoint) {
    HNSW hnsw(16, 200);
    VectorItem v1{1, "item1", "cat", {1.0f, 0.0f}};
    VectorItem v2{2, "item2", "cat", {0.0f, 1.0f}};
    VectorItem v3{3, "item3", "cat", {0.5f, 0.5f}};

    hnsw.insert(v1, euclidean);
    hnsw.insert(v2, euclidean);
    hnsw.insert(v3, euclidean);

    auto info = hnsw.getInfo();

    hnsw.remove(1);

    std::vector<float> q = {15.0f, 1.0f};
    auto hits = hnsw.knn(q, 3, 50, euclidean);
    EXPECT_EQ(hnsw.size(), static_cast<size_t>(info.nodeCount - 1));
}

// 6c. HNSW Stale Top-Layer & Arbitrary Entry Point Defect Test
TEST(EdgeCaseTest, HNSW_StaleTopLayerDefect) {
    HNSW hnsw(2, 50);
    
    // Insert nodes
    for (int i = 1; i <= 20; ++i) {
        VectorItem item{i, "item_" + std::to_string(i), "cat", {static_cast<float>(i), 1.0f}};
        hnsw.insert(item, euclidean);
    }

    auto infoBefore = hnsw.getInfo();
    int topLyrBefore = infoBefore.topLayer;

    // Find entry point node
    int entryNodeId = -1;
    for (auto& n : infoBefore.nodes) {
        if (n.maxLyr == topLyrBefore) {
            entryNodeId = n.id;
            break;
        }
    }

    // Remove entry point node
    hnsw.remove(entryNodeId);

    auto infoAfter = hnsw.getInfo();

    // Find actual highest maxLyr among remaining nodes
    int actualMaxLyr = -1;
    for (auto& n : infoAfter.nodes) {
        if (n.maxLyr > actualMaxLyr) {
            actualMaxLyr = n.maxLyr;
        }
    }

    // DEFECT DISCOVERY & DOCUMENTATION:
    // When the top-layer entry point is removed, HNSW::remove does not recalculate topLayer.
    // As a result, topLayer in GraphInfo remains equal to topLyrBefore even if no remaining node reaches topLyrBefore!
    EXPECT_EQ(infoAfter.topLayer, actualMaxLyr);
}

// 6b. Deleting Top-Layer HNSW Entry Point Defect Reproduction
TEST(EdgeCaseTest, HNSW_EntryPointTopLayerDefect) {
    HNSW hnsw(2, 50); // Small M to force multiple layers quickly
    
    // Insert 30 items to guarantee topLayer > 0
    for (int i = 1; i <= 30; ++i) {
        VectorItem item{i, "item_" + std::to_string(i), "cat", {static_cast<float>(i), 1.0f}};
        hnsw.insert(item, euclidean);
    }

    auto infoBefore = hnsw.getInfo();
    int topLyrBefore = infoBefore.topLayer;

    // Find the node at the top layer
    int topNodeId = -1;
    for (auto& n : infoBefore.nodes) {
        if (n.maxLyr == topLyrBefore) {
            topNodeId = n.id;
            break;
        }
    }

    ASSERT_NE(topNodeId, -1);

    // Delete the entry point node at topLayer
    hnsw.remove(topNodeId);

    auto infoAfter = hnsw.getInfo();
    
    // DEFECT REPRODUCTION CHECK:
    // If the top layer node was deleted, topLayer should be updated to the new maximum layer among remaining nodes.
    // If topLayer is left stale or entryPt is assigned to a lower-layer node without updating topLayer, search will fail or produce inconsistent topLayer metadata.
    EXPECT_LE(infoAfter.topLayer, topLyrBefore);
    for (auto& n : infoAfter.nodes) {
        EXPECT_NE(n.id, topNodeId);
    }

    std::vector<float> q = {15.0f, 1.0f};
    auto hits = hnsw.knn(q, 3, 50, euclidean);
    // Verify KNN search still returns valid results after entry point deletion
    EXPECT_FALSE(hits.empty());
}

// 7. Repeated Insert and Delete Cycles
TEST(EdgeCaseTest, InsertDeleteCycles) {
    HNSW hnsw(16, 200);
    BruteForce bf;

    for (int cycle = 0; cycle < 3; ++cycle) {
        for (int i = 0; i < 10; ++i) {
            int id = cycle * 10 + i;
            VectorItem v{id, "item", "cat", {static_cast<float>(id), static_cast<float>(i)}};
            bf.insert(v);
            hnsw.insert(v, euclidean);
        }
        for (int i = 0; i < 5; ++i) {
            int id = cycle * 10 + i;
            bf.remove(id);
            hnsw.remove(id);
        }
    }

    EXPECT_EQ(bf.items.size(), 15u);
    EXPECT_EQ(hnsw.size(), 15u);
}

// 8. k Larger Than Dataset Size
TEST(EdgeCaseTest, KLargerThanDataset) {
    std::vector<float> q = {1.0f, 0.0f};
    VectorItem v1{1, "item1", "cat", {1.0f, 0.0f}};
    VectorItem v2{2, "item2", "cat", {0.0f, 1.0f}};

    BruteForce bf;
    bf.insert(v1);
    bf.insert(v2);
    auto bfHits = bf.knn(q, 100, euclidean);
    EXPECT_EQ(bfHits.size(), 2u);

    KDTree kdt(2);
    kdt.insert(v1);
    kdt.insert(v2);
    auto kdtHits = kdt.knn(q, 100, euclidean);
    EXPECT_EQ(kdtHits.size(), 2u);

    HNSW hnsw(16, 200);
    hnsw.insert(v1, euclidean);
    hnsw.insert(v2, euclidean);
    auto hnswHits = hnsw.knn(q, 100, 50, euclidean);
    EXPECT_EQ(hnswHits.size(), 2u);
}

// 9. Zero-Length Vectors & Invalid Dimensions
TEST(EdgeCaseTest, InvalidDimensionsAndZeroLength) {
    std::vector<float> qEmpty;
    std::vector<float> q3D = {1.0f, 2.0f, 3.0f};
    VectorItem v2D{1, "item2D", "cat", {1.0f, 0.0f}};

    BruteForce bf;
    bf.insert(v2D);

    auto hitsEmpty = bf.knn(qEmpty, 1, euclidean);
    EXPECT_EQ(hitsEmpty.size(), 1u);

    auto hits3D = bf.knn(q3D, 1, euclidean);
    EXPECT_EQ(hits3D.size(), 1u);
}

// 10. Structured KDTree Insertion Order
TEST(EdgeCaseTest, StructuredKDTreeOrder) {
    KDTree kdtBalanced(2);
    KDTree kdtSorted(2);

    kdtBalanced.insert({2, "mid", "cat", {0.5f, 0.5f}});
    kdtBalanced.insert({1, "left", "cat", {0.1f, 0.1f}});
    kdtBalanced.insert({3, "right", "cat", {0.9f, 0.9f}});

    kdtSorted.insert({1, "left", "cat", {0.1f, 0.1f}});
    kdtSorted.insert({2, "mid", "cat", {0.5f, 0.5f}});
    kdtSorted.insert({3, "right", "cat", {0.9f, 0.9f}});

    std::vector<float> q = {0.8f, 0.8f};
    auto hitsB = kdtBalanced.knn(q, 1, euclidean);
    auto hitsS = kdtSorted.knn(q, 1, euclidean);

    ASSERT_EQ(hitsB.size(), 1u);
    ASSERT_EQ(hitsS.size(), 1u);
    EXPECT_EQ(hitsB[0].second, 3);
    EXPECT_EQ(hitsS[0].second, 3);
}

// 11. HNSW vs BruteForce Ground Truth Comparison
TEST(EdgeCaseTest, HNSWGroundTruthComparison) {
    BruteForce bf;
    HNSW hnsw(16, 200);

    const int N = 50;
    const int D = 16;
    std::mt19937 rng(12345);
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);

    for (int i = 0; i < N; ++i) {
        std::vector<float> vec(D);
        for (int d = 0; d < D; ++d) vec[d] = dist(rng);
        VectorItem item{i + 1, "vec_" + std::to_string(i), "test", vec};
        bf.insert(item);
        hnsw.insert(item, cosine);
    }

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
