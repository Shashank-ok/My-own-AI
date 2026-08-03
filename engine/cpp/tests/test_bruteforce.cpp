#include <gtest/gtest.h>
#include "../brute_force.hpp"
#include "../distance.hpp"

TEST(BruteForceTest, InsertAndSearch) {
    BruteForce bf;
    VectorItem v1{1, "Item 1", "catA", {1.0f, 0.0f}};
    VectorItem v2{2, "Item 2", "catB", {0.0f, 1.0f}};
    VectorItem v3{3, "Item 3", "catA", {0.5f, 0.5f}};

    bf.insert(v1);
    bf.insert(v2);
    bf.insert(v3);

    EXPECT_EQ(bf.items.size(), 3u);

    std::vector<float> query = {1.0f, 0.0f};
    auto hits = bf.knn(query, 2, euclidean);

    ASSERT_EQ(hits.size(), 2u);
    EXPECT_EQ(hits[0].second, 1);
    EXPECT_NEAR(hits[0].first, 0.0f, 1e-5f);
}

TEST(BruteForceTest, RemoveItem) {
    BruteForce bf;
    VectorItem v1{10, "Item 10", "catA", {1.0f, 0.0f}};
    VectorItem v2{20, "Item 20", "catB", {0.0f, 1.0f}};

    bf.insert(v1);
    bf.insert(v2);
    EXPECT_EQ(bf.items.size(), 2u);

    bf.remove(10);
    EXPECT_EQ(bf.items.size(), 1u);
    EXPECT_EQ(bf.items[0].id, 20);
}
