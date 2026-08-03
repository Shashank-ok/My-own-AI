#include "brute_force.hpp"
#include <algorithm>

void BruteForce::insert(const VectorItem& v) {
    items.push_back(v);
}

std::vector<std::pair<float,int>> BruteForce::knn(
    const std::vector<float>& q, int k, DistFn dist)
{
    std::vector<std::pair<float,int>> r;
    r.reserve(items.size());
    for (auto& v : items) r.push_back({dist(q, v.emb), v.id});
    std::sort(r.begin(), r.end());
    if ((int)r.size() > k) r.resize(k);
    return r;
}

void BruteForce::remove(int id) {
    items.erase(std::remove_if(items.begin(), items.end(),
        [id](const VectorItem& v){ return v.id == id; }), items.end());
}
