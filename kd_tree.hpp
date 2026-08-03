#pragma once
#include "types.hpp"
#include <vector>
#include <queue>
#include <utility>

struct KDNode {
    VectorItem item;
    KDNode* left  = nullptr;
    KDNode* right = nullptr;
    explicit KDNode(const VectorItem& v) : item(v) {}
};

class KDTree {
    KDNode* root = nullptr;
    int dims;

    void destroy(KDNode* n);
    KDNode* ins(KDNode* n, const VectorItem& v, int d);
    void knn(KDNode* n, const std::vector<float>& q, int k, int d, DistFn dist,
             std::priority_queue<std::pair<float,int>>& heap);

public:
    explicit KDTree(int d);
    ~KDTree();

    void insert(const VectorItem& v);
    std::vector<std::pair<float,int>> knn(const std::vector<float>& q, int k, DistFn dist);
    void rebuild(const std::vector<VectorItem>& items);
};
