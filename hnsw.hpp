#pragma once
#include "types.hpp"
#include <vector>
#include <unordered_map>
#include <random>

class HNSW {
    struct Node {
        VectorItem item;
        int maxLyr;
        std::vector<std::vector<int>> nbrs;
    };

    std::unordered_map<int, Node> G;
    int    M, M0, ef_build;
    float  mL;
    int    topLayer = -1;
    int    entryPt  = -1;
    std::mt19937 rng;

    int randLevel();
    std::vector<std::pair<float,int>> searchLayer(
        const std::vector<float>& q, int ep, int ef, int lyr, DistFn dist);
    std::vector<int> selectNbrs(std::vector<std::pair<float,int>>& cands, int maxM);

public:
    HNSW(int m = 16, int efBuild = 200);

    void insert(const VectorItem& item, DistFn dist);
    std::vector<std::pair<float,int>> knn(
        const std::vector<float>& q, int k, int ef, DistFn dist);
    void remove(int id);

    struct GraphInfo {
        int topLayer, nodeCount;
        std::vector<int> nodesPerLayer, edgesPerLayer;
        struct NV { int id; std::string metadata, category; int maxLyr; };
        struct EV { int src, dst, lyr; };
        std::vector<NV> nodes;
        std::vector<EV> edges;
    };

    GraphInfo getInfo();
    size_t size() const { return G.size(); }
};
