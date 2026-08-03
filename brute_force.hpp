#pragma once
#include "types.hpp"
#include <vector>
#include <utility>

class BruteForce {
public:
    std::vector<VectorItem> items;

    void insert(const VectorItem& v);
    std::vector<std::pair<float,int>> knn(const std::vector<float>& q, int k, DistFn dist);
    void remove(int id);
};
