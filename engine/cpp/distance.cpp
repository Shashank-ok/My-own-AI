#include "distance.hpp"
#include <cmath>
#include <algorithm>

float euclidean(const std::vector<float>& a, const std::vector<float>& b) {
    float s = 0;
    int len = std::min((int)a.size(), (int)b.size());
    for (int i = 0; i < len; i++) { float d = a[i]-b[i]; s += d*d; }
    return std::sqrt(s);
}

float normalizeVector(std::vector<float>& v) {
    float normSq = 0.0f;
    for (float x : v) normSq += x * x;
    float norm = std::sqrt(normSq);
    if (norm < 1e-9f) return 0.0f;
    float invNorm = 1.0f / norm;
    for (float& x : v) x *= invNorm;
    return norm;
}

float cosineNormalized(const std::vector<float>& a, const std::vector<float>& b) {
    if (a.empty() || b.empty()) return 0.0f;
    float dot = 0.0f;
    int len = std::min((int)a.size(), (int)b.size());
    for (int i = 0; i < len; ++i) dot += a[i] * b[i];
    return 1.0f - dot;
}

float cosine(const std::vector<float>& a, const std::vector<float>& b) {
    float dot=0, na=0, nb=0;
    int len = std::min((int)a.size(), (int)b.size());
    for (int i = 0; i < len; i++) {
        dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i];
    }
    if (na < 1e-9f || nb < 1e-9f) return 1.0f;
    return 1.0f - dot / (std::sqrt(na) * std::sqrt(nb));
}

float manhattan(const std::vector<float>& a, const std::vector<float>& b) {
    float s = 0;
    int len = std::min((int)a.size(), (int)b.size());
    for (int i = 0; i < len; i++) s += std::abs(a[i]-b[i]);
    return s;
}

DistFn getDistFn(const std::string& m) {
    if (m == "cosine")    return cosineNormalized;
    if (m == "manhattan") return manhattan;
    return euclidean;
}
