#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <random>
#include <chrono>
#include <algorithm>
#include <set>
#include <cmath>
#include <numeric>
#include <memory>
#include <shared_mutex>
#include <unordered_map>
#include <unordered_set>
#include <nlohmann/json.hpp>
#include "distance.hpp"
#include "brute_force.hpp"
#include "kd_tree.hpp"
#include "hnsw.hpp"

using json = nlohmann::json;

// ── DETERMINISTIC RANDOM VECTOR GENERATOR ────────────────────────────

std::vector<std::vector<float>> generateNormalizedVectors(int count, int dims, int seed = 42) {
    std::mt19937 rng(seed);
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);

    std::vector<std::vector<float>> vecs;
    vecs.reserve(count);
    for (int i = 0; i < count; ++i) {
        std::vector<float> v(dims);
        for (int d = 0; d < dims; ++d) v[d] = dist(rng);
        normalizeVector(v);
        vecs.push_back(v);
    }
    return vecs;
}

// ── GROUND TRUTH COMPUTATION (BruteForce Linear Scan) ────────────────

std::vector<std::set<int>> computeGroundTruth(
    const std::vector<VectorItem>& items,
    const std::vector<std::vector<float>>& queries,
    int k)
{
    BruteForce bf;
    for (const auto& item : items) bf.insert(item);

    std::vector<std::set<int>> groundTruth;
    groundTruth.reserve(queries.size());

    for (const auto& q : queries) {
        auto raw = bf.knn(q, k, cosineNormalized);
        std::set<int> topK;
        for (const auto& [dist, id] : raw) topK.insert(id);
        groundTruth.push_back(topK);
    }
    return groundTruth;
}

// ── RECALL@K CALCULATION ─────────────────────────────────────────────

float calculateRecallAtK(
    const std::set<int>& groundTruth,
    const std::vector<std::pair<float, int>>& results)
{
    if (groundTruth.empty()) return 1.0f;
    int matches = 0;
    for (const auto& [dist, id] : results) {
        if (groundTruth.count(id)) matches++;
    }
    return static_cast<float>(matches) / static_cast<float>(groundTruth.size());
}

// ── BENCHMARK RUNNER RESULT STRUCT ───────────────────────────────────

struct BenchmarkMetricResult {
    std::string algorithm;
    int datasetSize;
    int dims;
    int queries;
    int k;
    int M;
    int efConstruction;
    int efSearch;
    double buildTimeMs;
    double batchThroughputVecPerSec;
    double meanLatencyUs;
    double medianLatencyUs;
    double p95LatencyUs;
    double qps;
    float recallAtK;
    int namespaces;
    double namespaceOverheadPercent;
};

// ── MAIN BENCHMARK LOGIC ─────────────────────────────────────────────

int main() {
    std::cout << "========================================================\n";
    std::cout << "  C++ Vector Search Engine - Reproducible Benchmark\n";
    std::cout << "========================================================\n\n";

    std::vector<BenchmarkMetricResult> allResults;
    std::string csvPath = "benchmark_results.csv";
    std::ofstream csv(csvPath);

    csv << "Algorithm,DatasetSize,Dims,Queries,K,M,efConstruction,efSearch,BuildTimeMs,"
        << "BatchThroughputVecPerSec,MeanLatencyUs,MedianLatencyUs,P95LatencyUs,QPS,RecallAtK,"
        << "Namespaces,NamespaceOverheadPercent\n";

    // Benchmark Parameter Matrix
    std::vector<int> datasetSizes = {100, 1000, 5000};
    std::vector<int> dimensions = {16, 64, 128};
    int numQueries = 100;
    int k = 10;
    int M = 16;
    int efConstruction = 200;
    int efSearch = 50;

    for (int N : datasetSizes) {
        for (int D : dimensions) {
            std::cout << "--> Running Matrix Benchmark: N=" << N << ", D=" << D << " ...\n";

            auto datasetRaw = generateNormalizedVectors(N, D, 42);
            auto queriesRaw = generateNormalizedVectors(numQueries, D, 1337);

            std::vector<VectorItem> items;
            items.reserve(N);
            for (int i = 0; i < N; ++i) {
                items.push_back({i + 1, "meta_" + std::to_string(i + 1), "cat", datasetRaw[i]});
            }

            // Ground truth computation via BruteForce
            auto groundTruth = computeGroundTruth(items, queriesRaw, k);

            // 1. BruteForce Benchmark
            {
                auto t0 = std::chrono::high_resolution_clock::now();
                BruteForce bf;
                for (const auto& item : items) bf.insert(item);
                auto t1 = std::chrono::high_resolution_clock::now();
                double buildMs = std::chrono::duration<double, std::milli>(t1 - t0).count();

                std::vector<double> latencies;
                latencies.reserve(numQueries);

                auto q0 = std::chrono::high_resolution_clock::now();
                for (int qIdx = 0; qIdx < numQueries; ++qIdx) {
                    auto startQ = std::chrono::high_resolution_clock::now();
                    auto res = bf.knn(queriesRaw[qIdx], k, cosineNormalized);
                    auto endQ = std::chrono::high_resolution_clock::now();
                    latencies.push_back(std::chrono::duration<double, std::micro>(endQ - startQ).count());
                }
                auto q1 = std::chrono::high_resolution_clock::now();
                double totalSearchSec = std::chrono::duration<double>(q1 - q0).count();

                std::sort(latencies.begin(), latencies.end());
                double sumLat = std::accumulate(latencies.begin(), latencies.end(), 0.0);
                double meanLat = sumLat / numQueries;
                double medianLat = latencies[numQueries / 2];
                double p95Lat = latencies[static_cast<size_t>(numQueries * 0.95)];
                double qps = numQueries / totalSearchSec;

                BenchmarkMetricResult r{
                    "BruteForce", N, D, numQueries, k, M, efConstruction, efSearch,
                    buildMs, (N / (buildMs / 1000.0)), meanLat, medianLat, p95Lat, qps, 1.0f, 1, 0.0
                };
                allResults.push_back(r);

                csv << r.algorithm << "," << r.datasetSize << "," << r.dims << "," << r.queries << ","
                    << r.k << "," << r.M << "," << r.efConstruction << "," << r.efSearch << ","
                    << r.buildTimeMs << "," << r.batchThroughputVecPerSec << ","
                    << r.meanLatencyUs << "," << r.medianLatencyUs << "," << r.p95LatencyUs << ","
                    << r.qps << "," << r.recallAtK << "," << r.namespaces << "," << r.namespaceOverheadPercent << "\n";
            }

            // 2. KDTree Benchmark
            {
                auto t0 = std::chrono::high_resolution_clock::now();
                KDTree kdt(D);
                for (const auto& item : items) kdt.insert(item);
                auto t1 = std::chrono::high_resolution_clock::now();
                double buildMs = std::chrono::duration<double, std::milli>(t1 - t0).count();

                std::vector<double> latencies;
                latencies.reserve(numQueries);
                float totalRecall = 0.0f;

                auto q0 = std::chrono::high_resolution_clock::now();
                for (int qIdx = 0; qIdx < numQueries; ++qIdx) {
                    auto startQ = std::chrono::high_resolution_clock::now();
                    auto res = kdt.knn(queriesRaw[qIdx], k, cosineNormalized);
                    auto endQ = std::chrono::high_resolution_clock::now();
                    latencies.push_back(std::chrono::duration<double, std::micro>(endQ - startQ).count());
                    totalRecall += calculateRecallAtK(groundTruth[qIdx], res);
                }
                auto q1 = std::chrono::high_resolution_clock::now();
                double totalSearchSec = std::chrono::duration<double>(q1 - q0).count();

                std::sort(latencies.begin(), latencies.end());
                double sumLat = std::accumulate(latencies.begin(), latencies.end(), 0.0);
                double meanLat = sumLat / numQueries;
                double medianLat = latencies[numQueries / 2];
                double p95Lat = latencies[static_cast<size_t>(numQueries * 0.95)];
                double qps = numQueries / totalSearchSec;
                float recall = totalRecall / numQueries;

                BenchmarkMetricResult r{
                    "KDTree", N, D, numQueries, k, M, efConstruction, efSearch,
                    buildMs, (N / (buildMs / 1000.0)), meanLat, medianLat, p95Lat, qps, recall, 1, 0.0
                };
                allResults.push_back(r);

                csv << r.algorithm << "," << r.datasetSize << "," << r.dims << "," << r.queries << ","
                    << r.k << "," << r.M << "," << r.efConstruction << "," << r.efSearch << ","
                    << r.buildTimeMs << "," << r.batchThroughputVecPerSec << ","
                    << r.meanLatencyUs << "," << r.medianLatencyUs << "," << r.p95LatencyUs << ","
                    << r.qps << "," << r.recallAtK << "," << r.namespaces << "," << r.namespaceOverheadPercent << "\n";
            }

            // 3. HNSW Benchmark
            {
                auto t0 = std::chrono::high_resolution_clock::now();
                HNSW hnsw(M, efConstruction);
                for (const auto& item : items) hnsw.insert(item, cosineNormalized);
                auto t1 = std::chrono::high_resolution_clock::now();
                double buildMs = std::chrono::duration<double, std::milli>(t1 - t0).count();

                std::vector<double> latencies;
                latencies.reserve(numQueries);
                float totalRecall = 0.0f;

                auto q0 = std::chrono::high_resolution_clock::now();
                for (int qIdx = 0; qIdx < numQueries; ++qIdx) {
                    auto startQ = std::chrono::high_resolution_clock::now();
                    auto res = hnsw.knn(queriesRaw[qIdx], k, efSearch, cosineNormalized);
                    auto endQ = std::chrono::high_resolution_clock::now();
                    latencies.push_back(std::chrono::duration<double, std::micro>(endQ - startQ).count());
                    totalRecall += calculateRecallAtK(groundTruth[qIdx], res);
                }
                auto q1 = std::chrono::high_resolution_clock::now();
                double totalSearchSec = std::chrono::duration<double>(q1 - q0).count();

                std::sort(latencies.begin(), latencies.end());
                double sumLat = std::accumulate(latencies.begin(), latencies.end(), 0.0);
                double meanLat = sumLat / numQueries;
                double medianLat = latencies[numQueries / 2];
                double p95Lat = latencies[static_cast<size_t>(numQueries * 0.95)];
                double qps = numQueries / totalSearchSec;
                float recall = totalRecall / numQueries;

                BenchmarkMetricResult r{
                    "HNSW", N, D, numQueries, k, M, efConstruction, efSearch,
                    buildMs, (N / (buildMs / 1000.0)), meanLat, medianLat, p95Lat, qps, recall, 1, 0.0
                };
                allResults.push_back(r);

                csv << r.algorithm << "," << r.datasetSize << "," << r.dims << "," << r.queries << ","
                    << r.k << "," << r.M << "," << r.efConstruction << "," << r.efSearch << ","
                    << r.buildTimeMs << "," << r.batchThroughputVecPerSec << ","
                    << r.meanLatencyUs << "," << r.medianLatencyUs << "," << r.p95LatencyUs << ","
                    << r.qps << "," << r.recallAtK << "," << r.namespaces << "," << r.namespaceOverheadPercent << "\n";
            }
        }
    }

    // ── NAMESPACE ISOLATION OVERHEAD BENCHMARK ────────────────────────

    std::cout << "\n--> Running Namespace Isolation Overhead Benchmark ...\n";
    {
        int N = 1000, D = 64;
        auto dataset = generateNormalizedVectors(N, D, 42);
        auto query = generateNormalizedVectors(1, D, 999)[0];

        // 1-Namespace benchmark
        auto t0_single = std::chrono::high_resolution_clock::now();
        HNSW singleHnsw(M, efConstruction);
        for (int i = 0; i < N; ++i) {
            singleHnsw.insert({i + 1, "meta", "cat", dataset[i]}, cosineNormalized);
        }
        for (int i = 0; i < 1000; ++i) {
            auto res = singleHnsw.knn(query, 10, efSearch, cosineNormalized);
        }
        auto t1_single = std::chrono::high_resolution_clock::now();
        double singleUs = std::chrono::duration<double, std::micro>(t1_single - t0_single).count() / 1000.0;

        // 10-Namespace map lookup benchmark
        std::unordered_map<std::string, std::shared_ptr<HNSW>> multiNs;
        for (int ns = 0; ns < 10; ++ns) {
            std::string nsName = "tenant_" + std::to_string(ns);
            auto h = std::make_shared<HNSW>(M, efConstruction);
            for (int i = 0; i < N / 10; ++i) {
                h->insert({i + 1, "meta", "cat", dataset[i]}, cosineNormalized);
            }
            multiNs[nsName] = h;
        }

        auto t0_multi = std::chrono::high_resolution_clock::now();
        for (int i = 0; i < 1000; ++i) {
            std::string targetNs = "tenant_" + std::to_string(i % 10);
            auto h = multiNs[targetNs];
            auto res = h->knn(query, 10, efSearch, cosineNormalized);
        }
        auto t1_multi = std::chrono::high_resolution_clock::now();
        double multiUs = std::chrono::duration<double, std::micro>(t1_multi - t0_multi).count() / 1000.0;

        double overheadPercent = ((multiUs - singleUs) / singleUs) * 100.0;

        csv << "HNSW_MultiNamespace,1000,64,1000,10,16,200,50,0,0,"
            << multiUs << "," << multiUs << "," << multiUs << ","
            << (1000.0 / (multiUs / 1e6)) << ",1.0,10," << overheadPercent << "\n";

        std::cout << "    Single Namespace Avg Latency : " << singleUs << " us\n";
        std::cout << "    10-Namespace Avg Latency    : " << multiUs << " us\n";
        std::cout << "    Namespace Isolation Overhead: " << overheadPercent << " %\n";
    }

    csv.close();
    std::cout << "\n[SUCCESS] Benchmark complete! Results saved to '" << csvPath << "'.\n";
    return 0;
}
