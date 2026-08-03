#include "kd_tree.hpp"
#include <algorithm>
#include <cmath>

void KDTree::destroy(KDNode* n) {
    if (!n) return;
    destroy(n->left);
    destroy(n->right);
    delete n;
}

KDNode* KDTree::ins(KDNode* n, const VectorItem& v, int d) {
    if (!n) return new KDNode(v);
    int ax = d % dims;
    if (v.emb[ax] < n->item.emb[ax]) n->left  = ins(n->left,  v, d+1);
    else                              n->right = ins(n->right, v, d+1);
    return n;
}

void KDTree::knn(KDNode* n, const std::vector<float>& q, int k, int d, DistFn dist,
                 std::priority_queue<std::pair<float,int>>& heap)
{
    if (!n) return;
    float dn = dist(q, n->item.emb);
    if ((int)heap.size() < k || dn < heap.top().first) {
        heap.push({dn, n->item.id});
        if ((int)heap.size() > k) heap.pop();
    }
    int ax = d % dims;
    float diff = q[ax] - n->item.emb[ax];
    KDNode* closer  = diff < 0 ? n->left  : n->right;
    KDNode* farther = diff < 0 ? n->right : n->left;
    knn(closer, q, k, d+1, dist, heap);
    if ((int)heap.size() < k || std::abs(diff) < heap.top().first)
        knn(farther, q, k, d+1, dist, heap);
}

KDTree::KDTree(int d) : dims(d) {}

KDTree::~KDTree() {
    destroy(root);
}

void KDTree::insert(const VectorItem& v) {
    root = ins(root, v, 0);
}

std::vector<std::pair<float,int>> KDTree::knn(
    const std::vector<float>& q, int k, DistFn dist)
{
    std::priority_queue<std::pair<float,int>> heap;
    knn(root, q, k, 0, dist, heap);
    std::vector<std::pair<float,int>> r;
    while (!heap.empty()) { r.push_back(heap.top()); heap.pop(); }
    std::sort(r.begin(), r.end());
    return r;
}

void KDTree::rebuild(const std::vector<VectorItem>& items) {
    destroy(root);
    root = nullptr;
    for (auto& v : items) insert(v);
}
