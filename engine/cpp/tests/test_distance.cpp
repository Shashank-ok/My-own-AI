#include <gtest/gtest.h>
#include "../distance.hpp"
#include <cmath>

TEST(DistanceTest, EuclideanMetric) {
    std::vector<float> a = {0.0f, 0.0f};
    std::vector<float> b = {3.0f, 4.0f};
    EXPECT_FLOAT_EQ(euclidean(a, b), 5.0f);
    EXPECT_FLOAT_EQ(euclidean(a, a), 0.0f);
}

TEST(DistanceTest, CosineMetricIdentical) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    EXPECT_NEAR(cosine(a, a), 0.0f, 1e-5f);
}

TEST(DistanceTest, CosineMetricOrthogonal) {
    std::vector<float> a = {1.0f, 0.0f};
    std::vector<float> b = {0.0f, 1.0f};
    EXPECT_NEAR(cosine(a, b), 1.0f, 1e-5f);
}

TEST(DistanceTest, CosineMetricOpposite) {
    std::vector<float> a = {1.0f, 0.0f};
    std::vector<float> b = {-1.0f, 0.0f};
    EXPECT_NEAR(cosine(a, b), 2.0f, 1e-5f);
}

TEST(DistanceTest, ManhattanMetric) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    std::vector<float> b = {4.0f, 6.0f, 8.0f};
    EXPECT_FLOAT_EQ(manhattan(a, b), 12.0f);
}

TEST(DistanceTest, EmptyVectors) {
    std::vector<float> a;
    std::vector<float> b;
    EXPECT_FLOAT_EQ(euclidean(a, b), 0.0f);
    EXPECT_FLOAT_EQ(manhattan(a, b), 0.0f);
}

TEST(DistanceTest, ZeroNormVector) {
    std::vector<float> a = {0.0f, 0.0f, 0.0f};
    std::vector<float> b = {1.0f, 2.0f, 3.0f};
    EXPECT_FLOAT_EQ(cosine(a, b), 1.0f);
}

TEST(DistanceTest, MetricFactory) {
    auto fnCos = getDistFn("cosine");
    auto fnMan = getDistFn("manhattan");
    auto fnEuc = getDistFn("euclidean");

    std::vector<float> a = {1.0f, 0.0f};
    std::vector<float> b = {0.0f, 1.0f};

    EXPECT_NEAR(fnCos(a, b), 1.0f, 1e-5f);
    EXPECT_FLOAT_EQ(fnMan(a, b), 2.0f);
    EXPECT_FLOAT_EQ(fnEuc(a, b), std::sqrt(2.0f));
}

TEST(DistanceTest, NumericalEquivalence) {
    std::vector<float> a = {3.0f, 4.0f, 12.0f};
    std::vector<float> b = {1.0f, 5.0f, 2.0f};

    float rawDist = cosine(a, b);

    std::vector<float> aNorm = a;
    std::vector<float> bNorm = b;
    float nA = normalizeVector(aNorm);
    float nB = normalizeVector(bNorm);

    EXPECT_NEAR(nA, 13.0f, 1e-5f); // sqrt(9 + 16 + 144) = 13.0f
    EXPECT_GT(nB, 0.0f);

    float normASq = 0.0f, normBSq = 0.0f;
    for (float x : aNorm) normASq += x * x;
    for (float x : bNorm) normBSq += x * x;
    EXPECT_NEAR(std::sqrt(normASq), 1.0f, 1e-5f);
    EXPECT_NEAR(std::sqrt(normBSq), 1.0f, 1e-5f);

    float fastDist = cosineNormalized(aNorm, bNorm);
    EXPECT_NEAR(rawDist, fastDist, 1e-5f);
}
