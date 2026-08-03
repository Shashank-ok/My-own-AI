#pragma once
#include "types.hpp"
#include <string>

float euclidean(const std::vector<float>& a, const std::vector<float>& b);
float cosine(const std::vector<float>& a, const std::vector<float>& b);
float cosineNormalized(const std::vector<float>& a, const std::vector<float>& b);
float normalizeVector(std::vector<float>& v);
float manhattan(const std::vector<float>& a, const std::vector<float>& b);
DistFn getDistFn(const std::string& m);
