#include <gtest/gtest.h>
#include "../kd_tree.hpp"
#include "../distance.hpp"

TEST(KDTreeTest, InsertAndSearch) {
    KDTree kdt(2);
    VectorItem v1{1, "Item 1", "catA", {1.0f, 0.0f}};
    VectorItem v2{2, "Item 2", "catB", {0.0f, 1.0f}};
    VectorItem v3{3, "Item 3", "catA", {0.5f, 0.5f}};

    kdt.insert(v1);
    kdt.insert(v2);
    kdt.insert(v3);

    std::vector<float> query = {1.0f, 0.0f};
    auto hits = kdt.knn(query, 2, euclidean);

    ASSERT_EQ(hits.size(), 2u);
    EXPECT_EQ(hits[0].second, 1);
    EXPECT_NEAR(hits[0].first, 0.0f, 1e-5f);
}

TEST(KDTreeTest, Rebuild) {
    KDTree kdt(2);
    VectorItem v1{1, "Item 1", "catA", {1.0f, 0.0f}};
    VectorItem v2{2, "Item 2", "catB", {0.0f, 1.0f}};

    kdt.insert(v1);
    kdt.insert(v2);

    std::vector<VectorItem> remaining = {v2};
    kdt.rebuild(remaining);

    std::vector<float> query = {1.0f, 0.0f};
    auto hits = kdt.knn(query, 1, euclidean);
    ASSERT_EQ(hits.size(), 1u);
    EXPECT_EQ(hits[0].second, 2);
}
