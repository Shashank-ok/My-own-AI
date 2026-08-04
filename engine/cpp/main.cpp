#include "httplib.h"
#include "nlohmann/json.hpp"
using json = nlohmann::json;
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <random>
#include <chrono>
#include <mutex>
#include <shared_mutex>
#include <unordered_map>
#include <queue>
#include <set>
#include <sstream>
#include <iomanip>
#include <functional>
#include <fstream>
#include "types.hpp"
#include "distance.hpp"
#include "brute_force.hpp"
#include "kd_tree.hpp"
#include "hnsw.hpp"

static const int DIMS = 16;   // demo vectors
// Doc embeddings dimension is determined at runtime from Ollama's model output

// =====================================================================
//  VECTOR DATABASE  (demo 16D index)
// =====================================================================

class VectorDB {
    std::unordered_map<int, VectorItem> store;
    BruteForce bf;
    KDTree     kdt;
    HNSW       hnsw;
    mutable std::shared_mutex mu; // Shared read, exclusive write lock
    int nextId = 1;

public:
    const int dims;
    explicit VectorDB(int d) : kdt(d), hnsw(16, 200), dims(d) {}

    int insert(const std::string& meta, const std::string& cat,
               const std::vector<float>& emb, DistFn dist)
    {
        std::unique_lock<std::shared_mutex> lk(mu); // Exclusive write
        std::vector<float> finalEmb = emb;
        normalizeVector(finalEmb);
        VectorItem v{nextId++, meta, cat, finalEmb};
        store[v.id] = v;
        bf.insert(v); kdt.insert(v); hnsw.insert(v, dist);
        return v.id;
    }

    bool remove(int id) {
        std::unique_lock<std::shared_mutex> lk(mu); // Exclusive write
        if (!store.count(id)) return false;
        store.erase(id); bf.remove(id); hnsw.remove(id);
        std::vector<VectorItem> rem;
        for (auto& [i, v] : store) rem.push_back(v);
        kdt.rebuild(rem);
        return true;
    }

    struct Hit { int id; std::string meta, cat; std::vector<float> emb; float dist; };
    struct SearchOut { std::vector<Hit> hits; long long us; std::string algo, metric; };

    SearchOut search(const std::vector<float>& q, int k,
                     const std::string& metric, const std::string& algo) const
    {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        auto dfn = getDistFn(metric);
        std::vector<float> qVec = q;
        if (metric == "cosine") normalizeVector(qVec);

        auto t0  = std::chrono::high_resolution_clock::now();

        std::vector<std::pair<float,int>> raw;
        if      (algo == "bruteforce") raw = const_cast<BruteForce&>(bf).knn(qVec, k, dfn);
        else if (algo == "kdtree")     raw = const_cast<KDTree&>(kdt).knn(qVec, k, dfn);
        else                           raw = const_cast<HNSW&>(hnsw).knn(qVec, k, 50, dfn);

        long long us = std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::high_resolution_clock::now() - t0).count();

        SearchOut out; out.us = us; out.algo = algo; out.metric = metric;
        for (auto& [d, id] : raw)
            if (store.count(id)) {
                const auto& item = store.at(id);
                out.hits.push_back({id, item.metadata, item.category, item.emb, d});
            }
        return out;
    }

    struct BenchOut { long long bfUs, kdUs, hnswUs; int n; };

    BenchOut benchmark(const std::vector<float>& q, int k, const std::string& metric) const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        auto dfn  = getDistFn(metric);
        auto time = [&](auto fn) -> long long {
            auto t = std::chrono::high_resolution_clock::now();
            fn();
            return std::chrono::duration_cast<std::chrono::microseconds>(
                std::chrono::high_resolution_clock::now() - t).count();
        };
        return {
            time([&]{ const_cast<BruteForce&>(bf).knn(q, k, dfn); }),
            time([&]{ const_cast<KDTree&>(kdt).knn(q, k, dfn); }),
            time([&]{ const_cast<HNSW&>(hnsw).knn(q, k, 50, dfn); }),
            (int)store.size()
        };
    }

    std::vector<VectorItem> all() const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        std::vector<VectorItem> r;
        for (auto& [id, v] : store) r.push_back(v);
        return r;
    }

    HNSW::GraphInfo hnswInfo() const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        return const_cast<HNSW&>(hnsw).getInfo();
    }

    size_t size() const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        return store.size();
    }
};

// =====================================================================
//  JSON HELPERS
// =====================================================================

// =====================================================================
//  LIGHTWEIGHT STRUCTURED LOGGER
// =====================================================================

#ifdef ERROR
#undef ERROR
#endif

enum class LogLevel { INFO, WARN, ERROR };

class Logger {
public:
    static void log(LogLevel level, const std::string& context, const std::string& message) {
        auto now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
        std::stringstream ss;
        ss << std::put_time(std::localtime(&now), "%Y-%m-%d %H:%M:%S");

        std::string lvlStr;
        switch (level) {
            case LogLevel::INFO:  lvlStr = "INFO";  break;
            case LogLevel::WARN:  lvlStr = "WARN";  break;
            case LogLevel::ERROR: lvlStr = "ERROR"; break;
        }

        std::ostream& out = (level == LogLevel::ERROR) ? std::cerr : std::cout;
        out << "[" << ss.str() << "] [" << lvlStr << "] [" << context << "] " << message << std::endl;
    }

    static void info(const std::string& context, const std::string& msg) { log(LogLevel::INFO, context, msg); }
    static void warn(const std::string& context, const std::string& msg) { log(LogLevel::WARN, context, msg); }
    static void error(const std::string& context, const std::string& msg) { log(LogLevel::ERROR, context, msg); }
};

void logError(const std::string& context, const std::string& details) {
    Logger::error(context, details);
}

// =====================================================================
//  CENTRALIZED CONFIGURATION
// =====================================================================

struct Config {
    int         port                = 8080;
    std::string ollamaHost          = "127.0.0.1";
    int         ollamaPort          = 11434;
    std::string embedModel          = "nomic-embed-text";
    std::string genModel            = "llama3.2";
    int         chunkWords          = 250;
    int         overlapWords        = 30;
    float       similarityThreshold = 0.7f;
    size_t      maxPayloadSize      = 10485760; // 10 MB
    int         embedTimeoutSec     = 30;
    int         genTimeoutSec       = 180;

private:
    static std::string getEnvString(const char* name, const std::string& def) {
        const char* val = std::getenv(name);
        return (val && *val) ? std::string(val) : def;
    }

    static int getEnvInt(const char* name, int def) {
        const char* val = std::getenv(name);
        if (!val || !*val) return def;
        try { return std::stoi(val); } catch (...) { return def; }
    }

    static float getEnvFloat(const char* name, float def) {
        const char* val = std::getenv(name);
        if (!val || !*val) return def;
        try { return std::stof(val); } catch (...) { return def; }
    }

public:
    static Config loadFromEnv() {
        Config cfg;
        cfg.port                = getEnvInt("SERVER_PORT", 8080);
        cfg.ollamaHost          = getEnvString("OLLAMA_HOST", "127.0.0.1");
        cfg.ollamaPort          = getEnvInt("OLLAMA_PORT", 11434);
        cfg.embedModel          = getEnvString("EMBED_MODEL", "nomic-embed-text");
        cfg.genModel            = getEnvString("GEN_MODEL", "llama3.2");
        cfg.chunkWords          = getEnvInt("CHUNK_SIZE", 250);
        cfg.overlapWords        = getEnvInt("CHUNK_OVERLAP", 30);
        cfg.similarityThreshold = getEnvFloat("SIMILARITY_THRESHOLD", 0.7f);
        cfg.maxPayloadSize      = static_cast<size_t>(getEnvInt("MAX_PAYLOAD_SIZE", 10485760));
        cfg.embedTimeoutSec     = getEnvInt("EMBED_TIMEOUT", 30);
        cfg.genTimeoutSec       = getEnvInt("GEN_TIMEOUT", 180);
        return cfg;
    }

    bool validate(std::string& err) const {
        if (port <= 0 || port > 65535) { err = "SERVER_PORT must be between 1 and 65535"; return false; }
        if (ollamaPort <= 0 || ollamaPort > 65535) { err = "OLLAMA_PORT must be between 1 and 65535"; return false; }
        if (chunkWords <= 0) { err = "CHUNK_SIZE must be greater than 0"; return false; }
        if (overlapWords < 0 || overlapWords >= chunkWords) { err = "CHUNK_OVERLAP must be non-negative and less than CHUNK_SIZE"; return false; }
        if (similarityThreshold <= 0.0f) { err = "SIMILARITY_THRESHOLD must be greater than 0"; return false; }
        if (maxPayloadSize <= 0) { err = "MAX_PAYLOAD_SIZE must be greater than 0"; return false; }
        if (embedTimeoutSec <= 0) { err = "EMBED_TIMEOUT must be greater than 0"; return false; }
        if (genTimeoutSec <= 0) { err = "GEN_TIMEOUT must be greater than 0"; return false; }
        return true;
    }
};

void logStartupConfig(const Config& cfg) {
    Logger::info("Config", "=== Startup Configuration ===");
    Logger::info("Config", "SERVER_PORT          : " + std::to_string(cfg.port));
    Logger::info("Config", "OLLAMA_HOST          : " + cfg.ollamaHost);
    Logger::info("Config", "OLLAMA_PORT          : " + std::to_string(cfg.ollamaPort));
    Logger::info("Config", "EMBED_MODEL          : " + cfg.embedModel);
    Logger::info("Config", "GEN_MODEL            : " + cfg.genModel);
    Logger::info("Config", "CHUNK_SIZE           : " + std::to_string(cfg.chunkWords) + " words");
    Logger::info("Config", "CHUNK_OVERLAP        : " + std::to_string(cfg.overlapWords) + " words");
    Logger::info("Config", "SIMILARITY_THRESHOLD : " + std::to_string(cfg.similarityThreshold));
    Logger::info("Config", "MAX_PAYLOAD_SIZE     : " + std::to_string(cfg.maxPayloadSize) + " bytes");
    Logger::info("Config", "EMBED_TIMEOUT        : " + std::to_string(cfg.embedTimeoutSec) + " sec");
    Logger::info("Config", "GEN_TIMEOUT          : " + std::to_string(cfg.genTimeoutSec) + " sec");
    Logger::info("Config", "=============================");
}

void sendJsonError(httplib::Response& res, int status_code, const std::string& code, const std::string& msg) {
    res.status = status_code;
    json errObj = {
        {"error", {
            {"code", code},
            {"message", msg}
        }}
    };
    res.set_content(errObj.dump(), "application/json");
}

std::atomic<int> reqCountPerSec{0};
std::atomic<int64_t> lastRateResetSec{0};

bool checkRateLimit(httplib::Response& res) {
    int64_t nowSec = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    int64_t last = lastRateResetSec.load();
    if (nowSec != last) {
        lastRateResetSec.store(nowSec);
        reqCountPerSec.store(1);
        return true;
    }
    if (reqCountPerSec.fetch_add(1) >= 100) {
        sendJsonError(res, 429, "RATE_LIMIT_EXCEEDED", "Request rate limit exceeded. Please try again later.");
        return false;
    }
    return true;
}

std::vector<float> parseVec(const std::string& s) {
    std::vector<float> v;
    std::istringstream ss(s); std::string t;
    while (std::getline(ss, t, ','))
        try { v.push_back(std::stof(t)); } catch (...) {}
    return v;
}

void cors(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin",  "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

// =====================================================================
//  TEXT CHUNKER
// =====================================================================

std::vector<std::string> chunkText(const std::string& text,
                                   int chunkWords = 250, int overlapWords = 30)
{
    std::istringstream ss(text);
    std::vector<std::string> words;
    std::string w;
    while (ss >> w) words.push_back(w);

    if (words.empty()) return {};
    if ((int)words.size() <= chunkWords) return {text};

    std::vector<std::string> chunks;
    int step = chunkWords - overlapWords;
    for (int i = 0; i < (int)words.size(); i += step) {
        int end = std::min(i + chunkWords, (int)words.size());
        std::string chunk;
        for (int j = i; j < end; j++) { if (j > i) chunk += ' '; chunk += words[j]; }
        chunks.push_back(chunk);
        if (end == (int)words.size()) break;
    }
    return chunks;
}

// =====================================================================
//  OLLAMA CLIENT  — wraps local Ollama REST API
// =====================================================================

struct OllamaResponse {
    bool success = false;
    int status_code = 200;
    std::string error_code;
    std::string error_message;
    std::string text;
    std::vector<float> embedding;
};

class OllamaClient {
    std::string host;
    int         port;
    int         embedTimeoutSec;
    int         genTimeoutSec;

public:
    std::string embedModel;
    std::string genModel;

    OllamaClient(const std::string& h = "127.0.0.1", int p = 11434,
                 const std::string& em = "nomic-embed-text", const std::string& gm = "llama3.2",
                 int et = 30, int gt = 180)
        : host(h), port(p), embedTimeoutSec(et), genTimeoutSec(gt), embedModel(em), genModel(gm) {}

    bool isAvailable() {
        httplib::Client cli(host, port);
        cli.set_connection_timeout(2, 0);
        auto res = cli.Get("/api/tags");
        return res && res->status == 200;
    }

    OllamaResponse embed(const std::string& text) {
        OllamaResponse resp;
        httplib::Client cli(host, port);
        cli.set_connection_timeout(3, 0);
        cli.set_read_timeout(embedTimeoutSec, 0);
        json reqBody = {{"model", embedModel}, {"prompt", text}};
        auto res = cli.Post("/api/embeddings", reqBody.dump(), "application/json");
        if (!res) {
            auto err = res.error();
            if (err == httplib::Error::ConnectionTimeout || err == httplib::Error::Timeout) {
                resp.status_code = 503;
                resp.error_code = "OLLAMA_TIMEOUT";
                resp.error_message = "Ollama embedding request timed out";
            } else {
                resp.status_code = 503;
                resp.error_code = "OLLAMA_UNAVAILABLE";
                resp.error_message = "Ollama service is unavailable or unreachable at " + host + ":" + std::to_string(port);
            }
            logError("OllamaClient::embed", resp.error_message);
            return resp;
        }
        if (res->status != 200) {
            resp.status_code = 502;
            resp.error_code = "OLLAMA_RESPONSE_ERROR";
            resp.error_message = "Ollama service returned HTTP status " + std::to_string(res->status);
            logError("OllamaClient::embed", resp.error_message);
            return resp;
        }
        try {
            auto j = json::parse(res->body);
            if (j.contains("embedding") && j["embedding"].is_array()) {
                resp.success = true;
                resp.embedding = j["embedding"].get<std::vector<float>>();
                return resp;
            }
        } catch (const std::exception& e) {
            logError("OllamaClient::embed JSON parse exception", e.what());
        }
        resp.status_code = 502;
        resp.error_code = "OLLAMA_RESPONSE_ERROR";
        resp.error_message = "Malformed JSON response from Ollama embeddings API";
        return resp;
    }

    OllamaResponse generate(const std::string& prompt) {
        OllamaResponse resp;
        httplib::Client cli(host, port);
        cli.set_connection_timeout(3, 0);
        cli.set_read_timeout(genTimeoutSec, 0);
        json reqBody = {{"model", genModel}, {"prompt", prompt}, {"stream", false}};
        auto res = cli.Post("/api/generate", reqBody.dump(), "application/json");
        if (!res) {
            auto err = res.error();
            if (err == httplib::Error::ConnectionTimeout || err == httplib::Error::Timeout) {
                resp.status_code = 503;
                resp.error_code = "OLLAMA_TIMEOUT";
                resp.error_message = "Ollama generation request timed out";
            } else {
                resp.status_code = 503;
                resp.error_code = "OLLAMA_UNAVAILABLE";
                resp.error_message = "Ollama service is unavailable or unreachable at " + host + ":" + std::to_string(port);
            }
            logError("OllamaClient::generate", resp.error_message);
            return resp;
        }
        if (res->status != 200) {
            resp.status_code = 502;
            resp.error_code = "OLLAMA_RESPONSE_ERROR";
            resp.error_message = "Ollama service returned HTTP status " + std::to_string(res->status);
            logError("OllamaClient::generate", resp.error_message);
            return resp;
        }
        try {
            auto j = json::parse(res->body);
            if (j.contains("response") && j["response"].is_string()) {
                resp.success = true;
                resp.text = j["response"].get<std::string>();
                return resp;
            }
        } catch (const std::exception& e) {
            logError("OllamaClient::generate JSON parse exception", e.what());
        }
        resp.status_code = 502;
        resp.error_code = "OLLAMA_RESPONSE_ERROR";
        resp.error_message = "Malformed JSON response from Ollama generation API";
        return resp;
    }
};

// =====================================================================
//  DOCUMENT DATABASE  — HNSW over real Ollama embeddings
// =====================================================================

struct DocItem {
    int         id;
    std::string title;
    std::string text;
    std::vector<float> emb;
};

class DocumentDB {
    std::unordered_map<int, DocItem> store;
    HNSW       hnsw;
    BruteForce bf;       // brute force fallback for small sets
    mutable std::shared_mutex mu; // Shared read, exclusive write lock
    int nextId = 1;
    int dims   = 0;      // determined from first inserted embedding

public:
    DocumentDB() : hnsw(16, 200) {}

    // Insert one chunk with its pre-computed embedding
    int insert(const std::string& title, const std::string& text,
               const std::vector<float>& emb)
    {
        std::unique_lock<std::shared_mutex> lk(mu); // Exclusive write
        if (dims == 0) dims = (int)emb.size();
        std::vector<float> normEmb = emb;
        normalizeVector(normEmb);
        DocItem item{nextId++, title, text, normEmb};
        store[item.id] = item;
        VectorItem vi{item.id, title, "doc", normEmb};
        hnsw.insert(vi, cosineNormalized);
        bf.insert(vi);
        return item.id;
    }

    // Semantic search — returns top-k most similar chunks
    std::vector<std::pair<float, DocItem>> search(
        const std::vector<float>& q, int k, float max_dist = 0.7f) const
    {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        if (store.empty()) return {};
        std::vector<float> qNorm = q;
        normalizeVector(qNorm);
        auto raw = (store.size() < 10)
                   ? const_cast<BruteForce&>(bf).knn(qNorm, k, cosineNormalized)
                   : const_cast<HNSW&>(hnsw).knn(qNorm, k, 50, cosineNormalized);
        std::vector<std::pair<float, DocItem>> out;
        for (auto& [d, id] : raw)
            if (store.count(id) && d <= max_dist) out.push_back({d, store.at(id)});
        return out;
    }

    bool remove(int id) {
        std::unique_lock<std::shared_mutex> lk(mu); // Exclusive write
        if (!store.count(id)) return false;
        store.erase(id); hnsw.remove(id); bf.remove(id);
        return true;
    }

    std::vector<DocItem> all() const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        std::vector<DocItem> r;
        for (auto& [id, v] : store) r.push_back(v);
        return r;
    }

    size_t size() const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        return store.size();
    }

    int getDims() const {
        std::shared_lock<std::shared_mutex> lk(mu); // Shared read
        return dims;
    }
};

// =====================================================================
//  NAMESPACE-ISOLATED VECTOR ENGINE (Versioned /v1 API)
// =====================================================================

enum class NamespaceStatus { EMPTY, READY, REBUILDING, FAILED };

inline std::string statusToString(NamespaceStatus s) {
    switch (s) {
        case NamespaceStatus::EMPTY: return "empty";
        case NamespaceStatus::READY: return "ready";
        case NamespaceStatus::REBUILDING: return "rebuilding";
        case NamespaceStatus::FAILED: return "failed";
    }
    return "unknown";
}

struct V1VectorItem {
    std::string id;
    std::string namespaceName;
    std::vector<float> values;
    json metadata;
};

class NamespaceStore {
    std::string nsName;
    std::unordered_map<std::string, V1VectorItem> store;
    std::unordered_map<std::string, int> idToInternalId;
    std::unordered_map<int, std::string> internalIdToId;
    BruteForce bf;
    KDTree kdt;
    HNSW hnsw;
    mutable std::shared_mutex mu;
    int nextInternalId = 1;
    int dims = 0;
    NamespaceStatus status = NamespaceStatus::EMPTY;

public:
    explicit NamespaceStore(const std::string& name)
        : nsName(name), kdt(16), hnsw(16, 200) {}

    void setStatus(NamespaceStatus s) {
        std::unique_lock<std::shared_mutex> lk(mu);
        status = s;
    }

    NamespaceStatus getStatus() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        if (status == NamespaceStatus::EMPTY && store.size() > 0) return NamespaceStatus::READY;
        return status;
    }

    std::string getStatusStr() const {
        return statusToString(getStatus());
    }

    bool exists(const std::string& extId) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return idToInternalId.count(extId) > 0;
    }

    std::string insert(const std::string& extId, const std::vector<float>& values,
                       const json& meta, const std::string& metric = "cosine")
    {
        std::unique_lock<std::shared_mutex> lk(mu);
        if (dims == 0) dims = (int)values.size();

        std::string finalId = extId.empty() ? ("vec_" + std::to_string(nextInternalId)) : extId;

        if (idToInternalId.count(finalId)) {
            int oldIntId = idToInternalId[finalId];
            store.erase(finalId);
            bf.remove(oldIntId);
            hnsw.remove(oldIntId);
            internalIdToId.erase(oldIntId);
            idToInternalId.erase(finalId);
        }

        int intId = nextInternalId++;
        idToInternalId[finalId] = intId;
        internalIdToId[intId] = finalId;

        std::vector<float> normValues = values;
        if (metric == "cosine") normalizeVector(normValues);

        V1VectorItem item{finalId, nsName, normValues, meta};
        store[finalId] = item;

        VectorItem vi{intId, meta.dump(), nsName, normValues};
        auto dfn = getDistFn(metric);
        bf.insert(vi);
        kdt.insert(vi);
        hnsw.insert(vi, dfn);

        status = NamespaceStatus::READY;
        return finalId;
    }

    bool remove(const std::string& extId) {
        std::unique_lock<std::shared_mutex> lk(mu);
        if (!idToInternalId.count(extId)) return false;
        int intId = idToInternalId[extId];
        store.erase(extId);
        idToInternalId.erase(extId);
        internalIdToId.erase(intId);
        bf.remove(intId);
        hnsw.remove(intId);
        std::vector<VectorItem> rem;
        for (auto& [idStr, item] : store) {
            int iId = idToInternalId[idStr];
            rem.push_back({iId, item.metadata.dump(), nsName, item.values});
        }
        kdt.rebuild(rem);
        if (store.empty()) status = NamespaceStatus::EMPTY;
        return true;
    }

    struct SearchHit {
        std::string id;
        float distance;
        json metadata;
        std::vector<float> values;
    };

    struct SearchResult {
        std::string ns;
        std::vector<SearchHit> hits;
        long long latencyUs;
        std::string algo;
        std::string metric;
    };

    SearchResult search(const std::vector<float>& q, int k, const std::string& metric, const std::string& algo) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        auto t0 = std::chrono::high_resolution_clock::now();
        std::vector<float> qVec = q;
        if (metric == "cosine") normalizeVector(qVec);
        auto dfn = getDistFn(metric);

        std::vector<std::pair<float, int>> raw;
        if      (algo == "bruteforce") raw = const_cast<BruteForce&>(bf).knn(qVec, k, dfn);
        else if (algo == "kdtree")     raw = const_cast<KDTree&>(kdt).knn(qVec, k, dfn);
        else                           raw = const_cast<HNSW&>(hnsw).knn(qVec, k, 50, dfn);

        long long us = std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::high_resolution_clock::now() - t0).count();

        SearchResult res;
        res.ns = nsName;
        res.latencyUs = us;
        res.algo = algo;
        res.metric = metric;

        for (auto& [dist, intId] : raw) {
            if (internalIdToId.count(intId)) {
                std::string extId = internalIdToId.at(intId);
                if (store.count(extId)) {
                    const auto& item = store.at(extId);
                    res.hits.push_back({item.id, dist, item.metadata, item.values});
                }
            }
        }
        return res;
    }

    size_t size() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return store.size();
    }

    int getDims() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return dims;
    }
};

class VectorEngine {
    std::unordered_map<std::string, std::shared_ptr<NamespaceStore>> namespaces;
    mutable std::shared_mutex mu;

public:
    std::shared_ptr<NamespaceStore> getOrCreateNamespace(const std::string& nsName) {
        std::unique_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        if (!namespaces.count(name)) {
            namespaces[name] = std::make_shared<NamespaceStore>(name);
        }
        return namespaces[name];
    }

    std::shared_ptr<NamespaceStore> getNamespace(const std::string& nsName) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        auto it = namespaces.find(name);
        if (it != namespaces.end()) return it->second;
        return nullptr;
    }

    bool deleteNamespace(const std::string& nsName) {
        std::unique_lock<std::shared_mutex> lk(mu);
        std::string name = nsName.empty() ? "default" : nsName;
        if (!namespaces.count(name)) return false;
        namespaces.erase(name);
        return true;
    }

    size_t totalVectors() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        size_t total = 0;
        for (auto& [name, ns] : namespaces) total += ns->size();
        return total;
    }

    size_t totalNamespaces() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return namespaces.size();
    }

    struct RebuildResult {
        bool success;
        std::string errorMessage;
        size_t vectorCount;
    };

    RebuildResult atomicRebuild(const std::string& nsName, const json& vectorsArray, const std::string& metric = "cosine") {
        std::string name = nsName.empty() ? "default" : nsName;

        std::shared_ptr<NamespaceStore> activeNs;
        {
            std::unique_lock<std::shared_mutex> lk(mu);
            if (!namespaces.count(name)) {
                namespaces[name] = std::make_shared<NamespaceStore>(name);
            }
            activeNs = namespaces[name];
            activeNs->setStatus(NamespaceStatus::REBUILDING);
        }

        auto candidate = std::make_shared<NamespaceStore>(name);
        std::unordered_set<std::string> seenIds;
        int expectedDims = activeNs->getDims();

        for (size_t i = 0; i < vectorsArray.size(); ++i) {
            const auto& item = vectorsArray[i];
            if (!item.is_object() || !item.contains("values") || !item["values"].is_array()) {
                activeNs->setStatus(NamespaceStatus::FAILED);
                return {false, "Item at index " + std::to_string(i) + " missing 'values' array.", 0};
            }

            std::vector<float> values;
            try { values = item["values"].get<std::vector<float>>(); } catch (...) {
                activeNs->setStatus(NamespaceStatus::FAILED);
                return {false, "Item at index " + std::to_string(i) + " contains non-numeric values.", 0};
            }

            if (values.empty()) {
                activeNs->setStatus(NamespaceStatus::FAILED);
                return {false, "Item at index " + std::to_string(i) + " has empty vector values.", 0};
            }

            if (expectedDims > 0 && (int)values.size() != expectedDims) {
                activeNs->setStatus(NamespaceStatus::FAILED);
                return {false, "Vector dimension mismatch at index " + std::to_string(i) +
                               ". Expected " + std::to_string(expectedDims) + ", got " + std::to_string(values.size()) +
                               ". Active index preserved.", 0};
            }

            std::string extId = item.value("id", "");
            if (!extId.empty()) {
                if (seenIds.count(extId)) {
                    activeNs->setStatus(NamespaceStatus::FAILED);
                    return {false, "Duplicate vector ID '" + extId + "' within rebuild batch.", 0};
                }
                seenIds.insert(extId);
            }

            json meta = item.value("metadata", json::object());
            candidate->insert(extId, values, meta, metric);
        }

        candidate->setStatus(NamespaceStatus::READY);

        {
            std::unique_lock<std::shared_mutex> lk(mu);
            namespaces[name] = candidate;
        }

        return {true, "", candidate->size()};
    }

    json getStats() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        json nsStats = json::object();
        size_t total = 0;
        for (auto& [name, ns] : namespaces) {
            size_t count = ns->size();
            total += count;
            nsStats[name] = {
                {"count", count},
                {"dims", ns->getDims()},
                {"status", ns->getStatusStr()}
            };
        }
        return json{
            {"totalVectors", total},
            {"totalNamespaces", namespaces.size()},
            {"namespaces", nsStats},
            {"supportedMetrics", json::array({"cosine", "euclidean", "manhattan"})},
            {"supportedAlgorithms", json::array({"hnsw", "kdtree", "bruteforce"})}
        };
    }
};

// =====================================================================
//  DEMO DATA  (16D categorical vectors)
// =====================================================================

void loadDemo(VectorDB& db) {
    auto dist = getDistFn("cosine");
    // Dims 0-3: CS | Dims 4-7: Math | Dims 8-11: Food | Dims 12-15: Sports
    db.insert("Linked List: nodes connected by pointers", "cs",
        {0.90f,0.85f,0.72f,0.68f,0.12f,0.08f,0.15f,0.10f,0.05f,0.08f,0.06f,0.09f,0.07f,0.11f,0.08f,0.06f}, dist);
    db.insert("Binary Search Tree: O(log n) search and insert", "cs",
        {0.88f,0.82f,0.78f,0.74f,0.15f,0.10f,0.08f,0.12f,0.06f,0.07f,0.08f,0.05f,0.09f,0.06f,0.07f,0.10f}, dist);
    db.insert("Dynamic Programming: memoization overlapping subproblems", "cs",
        {0.82f,0.76f,0.88f,0.80f,0.20f,0.18f,0.12f,0.09f,0.07f,0.06f,0.08f,0.07f,0.08f,0.09f,0.06f,0.07f}, dist);
    db.insert("Graph BFS and DFS: breadth and depth first traversal", "cs",
        {0.85f,0.80f,0.75f,0.82f,0.18f,0.14f,0.10f,0.08f,0.06f,0.09f,0.07f,0.06f,0.10f,0.08f,0.09f,0.07f}, dist);
    db.insert("Hash Table: O(1) lookup with collision chaining", "cs",
        {0.87f,0.78f,0.70f,0.76f,0.13f,0.11f,0.09f,0.14f,0.08f,0.07f,0.06f,0.08f,0.07f,0.10f,0.08f,0.09f}, dist);
    db.insert("Calculus: derivatives integrals and limits", "math",
        {0.12f,0.15f,0.18f,0.10f,0.91f,0.86f,0.78f,0.72f,0.08f,0.06f,0.07f,0.09f,0.07f,0.08f,0.06f,0.10f}, dist);
    db.insert("Linear Algebra: matrices eigenvalues eigenvectors", "math",
        {0.20f,0.18f,0.15f,0.12f,0.88f,0.90f,0.82f,0.76f,0.09f,0.07f,0.08f,0.06f,0.10f,0.07f,0.08f,0.09f}, dist);
    db.insert("Probability: distributions random variables Bayes theorem", "math",
        {0.15f,0.12f,0.20f,0.18f,0.84f,0.80f,0.88f,0.82f,0.07f,0.08f,0.06f,0.10f,0.09f,0.06f,0.09f,0.08f}, dist);
    db.insert("Number Theory: primes modular arithmetic RSA cryptography", "math",
        {0.22f,0.16f,0.14f,0.20f,0.80f,0.85f,0.76f,0.90f,0.08f,0.09f,0.07f,0.06f,0.08f,0.10f,0.07f,0.06f}, dist);
    db.insert("Combinatorics: permutations combinations generating functions", "math",
        {0.18f,0.20f,0.16f,0.14f,0.86f,0.78f,0.84f,0.80f,0.06f,0.07f,0.09f,0.08f,0.06f,0.09f,0.10f,0.07f}, dist);
    db.insert("Neapolitan Pizza: wood-fired dough San Marzano tomatoes", "food",
        {0.08f,0.06f,0.09f,0.07f,0.07f,0.08f,0.06f,0.09f,0.90f,0.86f,0.78f,0.72f,0.08f,0.06f,0.09f,0.07f}, dist);
    db.insert("Sushi: vinegared rice raw fish and nori rolls", "food",
        {0.06f,0.08f,0.07f,0.09f,0.09f,0.06f,0.08f,0.07f,0.86f,0.90f,0.82f,0.76f,0.07f,0.09f,0.06f,0.08f}, dist);
    db.insert("Ramen: noodle soup with chashu pork and soft-boiled eggs", "food",
        {0.09f,0.07f,0.06f,0.08f,0.08f,0.09f,0.07f,0.06f,0.82f,0.78f,0.90f,0.84f,0.09f,0.07f,0.08f,0.06f}, dist);
    db.insert("Tacos: corn tortillas with carnitas salsa and cilantro", "food",
        {0.07f,0.09f,0.08f,0.06f,0.06f,0.07f,0.09f,0.08f,0.78f,0.82f,0.86f,0.90f,0.06f,0.08f,0.07f,0.09f}, dist);
    db.insert("Croissant: laminated pastry with buttery flaky layers", "food",
        {0.06f,0.07f,0.10f,0.09f,0.10f,0.06f,0.07f,0.10f,0.85f,0.80f,0.76f,0.82f,0.09f,0.07f,0.10f,0.06f}, dist);
    db.insert("Basketball: fast-paced shooting dribbling slam dunks", "sports",
        {0.09f,0.07f,0.08f,0.10f,0.08f,0.09f,0.07f,0.06f,0.08f,0.07f,0.09f,0.06f,0.91f,0.85f,0.78f,0.72f}, dist);
    db.insert("Football: tackles touchdowns field goals and strategy", "sports",
        {0.07f,0.09f,0.06f,0.08f,0.09f,0.07f,0.10f,0.08f,0.07f,0.09f,0.08f,0.07f,0.87f,0.89f,0.82f,0.76f}, dist);
    db.insert("Tennis: racket volleys groundstrokes and Wimbledon serves", "sports",
        {0.08f,0.06f,0.09f,0.07f,0.07f,0.08f,0.06f,0.09f,0.09f,0.06f,0.07f,0.08f,0.83f,0.80f,0.88f,0.82f}, dist);
    db.insert("Chess: openings endgames tactics strategic board game", "sports",
        {0.25f,0.20f,0.22f,0.18f,0.22f,0.18f,0.20f,0.15f,0.06f,0.08f,0.07f,0.09f,0.80f,0.84f,0.78f,0.90f}, dist);
    db.insert("Swimming: butterfly freestyle backstroke Olympic competition", "sports",
        {0.06f,0.08f,0.07f,0.09f,0.08f,0.06f,0.09f,0.07f,0.10f,0.08f,0.06f,0.07f,0.85f,0.82f,0.86f,0.80f}, dist);
}

// =====================================================================
//  HTTP SERVER
// =====================================================================

int main() {
    Config config = Config::loadFromEnv();
    std::string configErr;
    if (!config.validate(configErr)) {
        Logger::error("Config", "Configuration validation failed: " + configErr);
        return 1;
    }

    logStartupConfig(config);

    static const auto g_startTime = std::chrono::steady_clock::now();

    VectorDB     db(DIMS);
    DocumentDB   docDB;
    VectorEngine v1Engine;
    OllamaClient ollama(config.ollamaHost, config.ollamaPort,
                        config.embedModel, config.genModel,
                        config.embedTimeoutSec, config.genTimeoutSec);

    loadDemo(db);

    bool ollamaUp = ollama.isAvailable();
    if (ollamaUp) {
        Logger::info("Server", "Ollama connected at " + config.ollamaHost + ":" + std::to_string(config.ollamaPort));
    } else {
        Logger::warn("Server", "Ollama unavailable at " + config.ollamaHost + ":" + std::to_string(config.ollamaPort) + " (running in vector-only mode)");
    }
    Logger::info("Server", "VectorDB engine starting on http://localhost:" + std::to_string(config.port));

    httplib::Server svr;

    static std::mutex g_logMutex;

    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        auto now = std::chrono::system_clock::now();
        auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

        std::string reqId;
        if (req.has_header("X-Request-ID")) {
            reqId = req.get_header_value("X-Request-ID");
        } else if (req.has_header("x-request-id")) {
            reqId = req.get_header_value("x-request-id");
        } else {
            std::ostringstream ss;
            ss << "cpp-req-" << nowMs << "-" << (rand() % 10000);
            reqId = ss.str();
        }

        res.set_header("X-Request-ID", reqId);
        res.set_header("X-Start-Time-Ms", std::to_string(nowMs));
        return httplib::Server::HandlerResponse::Unhandled;
    });

    svr.set_logger([](const httplib::Request& req, const httplib::Response& res) {
        auto now = std::chrono::system_clock::now();
        auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

        std::string reqId = res.has_header("X-Request-ID") ? res.get_header_value("X-Request-ID") : "system";

        long long durationMs = 0;
        if (res.has_header("X-Start-Time-Ms")) {
            try {
                long long startMs = std::stoll(res.get_header_value("X-Start-Time-Ms"));
                durationMs = nowMs - startMs;
            } catch (...) {}
        }

        std::string level = "INFO";
        if (res.status >= 500) level = "ERROR";
        else if (res.status >= 400) level = "WARN";

        auto timeT = std::chrono::system_clock::to_time_t(now);
        auto msPart = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
        std::tm tmUtc{};
#ifdef _WIN32
        gmtime_s(&tmUtc, &timeT);
#else
        gmtime_r(&timeT, &tmUtc);
#endif
        std::ostringstream isoSs;
        isoSs << std::put_time(&tmUtc, "%Y-%m-%dT%H:%M:%S")
              << '.' << std::setfill('0') << std::setw(3) << msPart.count() << 'Z';

        json logEntry = {
            {"timestamp", isoSs.str()},
            {"level", level},
            {"service", "cpp-vector-engine"},
            {"requestId", reqId},
            {"method", req.method},
            {"path", req.path},
            {"statusCode", res.status},
            {"durationMs", durationMs}
        };

        {
            std::lock_guard<std::mutex> lock(g_logMutex);
            std::cout << logEntry.dump() << std::endl;
        }
    });

    svr.set_exception_handler([](const httplib::Request& req, httplib::Response& res, std::exception_ptr ep) {
        std::string msg = "Unknown exception";
        try {
            if (ep) std::rethrow_exception(ep);
        } catch (const std::exception& e) {
            msg = e.what();
        } catch (...) {}
        Logger::error("Server Exception on " + req.path, msg);
        sendJsonError(res, 500, "INTERNAL_ERROR", "An unexpected internal server error occurred.");
    });

    svr.set_error_handler([&](const httplib::Request& req, httplib::Response& res) {
        if (res.status == 404 && res.body.empty()) {
            json errObj = {
                {"error", {
                    {"code", "NOT_FOUND"},
                    {"message", "The requested resource or endpoint was not found: " + req.path}
                }}
            };
            res.set_content(errObj.dump(), "application/json");
        } else if (res.status == 413) {
            json errObj = {
                {"error", {
                    {"code", "PAYLOAD_TOO_LARGE"},
                    {"message", "Request payload exceeds maximum allowed size of " + std::to_string(config.maxPayloadSize) + " bytes."}
                }}
            };
            res.set_content(errObj.dump(), "application/json");
        }
    });

    svr.set_payload_max_length(config.maxPayloadSize);

    // CORS preflight
    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        cors(res); res.status = 204;
    });

    // ── VERSIONED V1 VECTOR ENGINE ENDPOINTS ──────────────────────────

    svr.Get("/v1/health", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        auto uptime = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::steady_clock::now() - g_startTime).count();
        json h = {
            {"status", "ok"},
            {"version", "1.0.0"},
            {"uptimeSec", uptime}
        };
        res.set_content(h.dump(), "application/json");
    });

    svr.Get("/v1/stats", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        res.set_content(v1Engine.getStats().dump(), "application/json");
    });

    svr.Post("/v1/vectors", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json b;
        try { b = json::parse(req.body); } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
        }

        if (!b.contains("values") || !b["values"].is_array()) {
            sendJsonError(res, 422, "MISSING_FIELD", "Field 'values' must be an array of numbers."); return;
        }

        std::vector<float> values;
        try { values = b["values"].get<std::vector<float>>(); } catch (...) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'values' must contain numbers."); return;
        }

        if (values.empty()) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS", "Vector values cannot be empty."); return;
        }

        std::string nsName = b.value("namespace", "default");
        std::string extId = b.value("id", "");
        json meta = b.value("metadata", json::object());

        auto ns = v1Engine.getOrCreateNamespace(nsName);
        if (ns->getDims() > 0 && ns->getDims() != (int)values.size()) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS",
                "Vector dimension mismatch. Expected " + std::to_string(ns->getDims()) +
                ", got " + std::to_string(values.size()));
            return;
        }

        std::string assignedId = ns->insert(extId, values, meta);

        json out = {
            {"id", assignedId},
            {"namespace", nsName},
            {"dims", values.size()}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Post("/v1/vectors/batch", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json b;
        try { b = json::parse(req.body); } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
        }

        if (!b.contains("vectors") || !b["vectors"].is_array()) {
            sendJsonError(res, 422, "MISSING_FIELD", "Field 'vectors' must be an array."); return;
        }

        const auto& vecsArr = b["vectors"];
        if (vecsArr.size() > 1000) {
            sendJsonError(res, 422, "INVALID_BATCH_SIZE", "Batch size exceeds maximum limit of 1000 items."); return;
        }

        std::string defaultNs = b.value("namespace", "default");
        std::unordered_set<std::string> seenBatchIds;

        // Pre-validate batch for duplicate IDs within request
        for (size_t i = 0; i < vecsArr.size(); ++i) {
            const auto& item = vecsArr[i];
            if (item.is_object() && item.contains("id") && item["id"].is_string()) {
                std::string idStr = item["id"].get<std::string>();
                if (!idStr.empty()) {
                    if (seenBatchIds.count(idStr)) {
                        sendJsonError(res, 422, "DUPLICATE_ID", "Duplicate vector ID '" + idStr + "' within batch request.");
                        return;
                    }
                    seenBatchIds.insert(idStr);
                }
            }
        }

        int inserted = 0;
        int updated = 0;
        int rejected = 0;

        for (const auto& item : vecsArr) {
            if (!item.is_object() || !item.contains("values") || !item["values"].is_array()) {
                rejected++; continue;
            }
            std::vector<float> values;
            try { values = item["values"].get<std::vector<float>>(); } catch (...) { rejected++; continue; }
            if (values.empty()) { rejected++; continue; }

            std::string itemNs = item.value("namespace", defaultNs);
            std::string extId = item.value("id", "");
            json meta = item.value("metadata", json::object());

            auto ns = v1Engine.getOrCreateNamespace(itemNs);
            if (ns->getDims() > 0 && ns->getDims() != (int)values.size()) {
                rejected++; continue;
            }

            bool isUpdate = !extId.empty() && ns->exists(extId);
            ns->insert(extId, values, meta);

            if (isUpdate) updated++;
            else inserted++;
        }

        json out = {
            {"inserted", inserted},
            {"updated", updated},
            {"rejected", rejected},
            {"namespace", defaultNs}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Get(R"(/v1/namespaces/([^/]+)/status)", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        std::string nsName = req.matches[1];
        auto ns = v1Engine.getNamespace(nsName);
        if (!ns) {
            sendJsonError(res, 404, "NOT_FOUND", "Namespace '" + nsName + "' not found."); return;
        }

        json out = {
            {"namespace", nsName},
            {"status", ns->getStatusStr()},
            {"vectorCount", ns->size()},
            {"dims", ns->getDims()}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Post(R"(/v1/namespaces/([^/]+)/rebuild)", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        std::string nsName = req.matches[1];
        json b;
        try { b = json::parse(req.body); } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
        }

        if (!b.contains("vectors") || !b["vectors"].is_array()) {
            sendJsonError(res, 422, "MISSING_FIELD", "Field 'vectors' must be an array of vector objects."); return;
        }

        std::string metric = b.value("metric", "cosine");
        auto rebuildRes = v1Engine.atomicRebuild(nsName, b["vectors"], metric);

        if (!rebuildRes.success) {
            sendJsonError(res, 422, "REBUILD_FAILED", rebuildRes.errorMessage);
            return;
        }

        json out = {
            {"namespace", nsName},
            {"status", "ready"},
            {"rebuilt", true},
            {"vectorCount", rebuildRes.vectorCount}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Post("/v1/vectors/search", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json b;
        try { b = json::parse(req.body); } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax."); return;
        }

        std::string nsName = b.value("namespace", "default");
        if (!b.contains("vector") || !b["vector"].is_array()) {
            sendJsonError(res, 422, "MISSING_FIELD", "Field 'vector' must be a query float array."); return;
        }

        std::vector<float> q;
        try { q = b["vector"].get<std::vector<float>>(); } catch (...) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'vector' must be an array of numbers."); return;
        }

        if (q.empty()) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS", "Query vector cannot be empty."); return;
        }

        if (!b.contains("k") || !b["k"].is_number_integer()) {
            sendJsonError(res, 422, "MISSING_FIELD", "Field 'k' must be a positive integer."); return;
        }

        int k = b["k"].get<int>();
        if (k <= 0) {
            sendJsonError(res, 422, "INVALID_K", "Parameter 'k' must be greater than 0."); return;
        }

        std::string algo = b.value("algorithm", "hnsw");
        std::string metric = b.value("metric", "cosine");

        if (algo != "hnsw" && algo != "kdtree" && algo != "bruteforce") {
            sendJsonError(res, 422, "INVALID_ALGORITHM", "Unsupported algorithm '" + algo + "'."); return;
        }

        if (metric != "cosine" && metric != "euclidean" && metric != "manhattan") {
            sendJsonError(res, 422, "INVALID_METRIC", "Unsupported metric '" + metric + "'."); return;
        }

        auto ns = v1Engine.getNamespace(nsName);
        if (!ns || ns->size() == 0) {
            json out = {
                {"namespace", nsName},
                {"hits", json::array()},
                {"latencyUs", 0},
                {"algorithm", algo},
                {"metric", metric}
            };
            res.set_content(out.dump(), "application/json");
            return;
        }

        if (ns->getDims() > 0 && ns->getDims() != (int)q.size()) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS",
                "Query dimension mismatch. Namespace expects " + std::to_string(ns->getDims()) +
                ", got " + std::to_string(q.size()));
            return;
        }

        auto sres = ns->search(q, k, metric, algo);

        json hitsArr = json::array();
        for (const auto& hit : sres.hits) {
            hitsArr.push_back({
                {"id", hit.id},
                {"distance", hit.distance},
                {"metadata", hit.metadata}
            });
        }

        json out = {
            {"namespace", nsName},
            {"hits", hitsArr},
            {"latencyUs", sres.latencyUs},
            {"algorithm", sres.algo},
            {"metric", sres.metric}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Delete(R"(/v1/vectors/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        std::string extId = req.matches[1];
        std::string nsName = req.get_param_value("namespace");
        if (nsName.empty()) nsName = "default";

        auto ns = v1Engine.getNamespace(nsName);
        if (!ns || !ns->remove(extId)) {
            sendJsonError(res, 404, "NOT_FOUND", "Vector ID '" + extId + "' not found in namespace '" + nsName + "'.");
            return;
        }

        json out = {
            {"deleted", true},
            {"id", extId},
            {"namespace", nsName}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Delete(R"(/v1/namespaces/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        std::string nsName = req.matches[1];
        if (!v1Engine.deleteNamespace(nsName)) {
            sendJsonError(res, 404, "NOT_FOUND", "Namespace '" + nsName + "' not found.");
            return;
        }
        json out = {
            {"deleted", true},
            {"namespace", nsName}
        };
        res.set_content(out.dump(), "application/json");
    });

    // ── DEMO VECTOR ENDPOINTS ─────────────────────────────────────────

    svr.Get("/search", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        auto q = parseVec(req.get_param_value("v"));
        if ((int)q.size() != DIMS) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS", "Query vector must be exactly " + std::to_string(DIMS) + " dimensions.");
            return;
        }
        int k = 5;
        try { k = std::stoi(req.get_param_value("k")); } catch (...) {}
        if (k <= 0) {
            sendJsonError(res, 422, "INVALID_K", "Parameter 'k' must be a positive integer greater than 0.");
            return;
        }
        auto metric = req.get_param_value("metric"); if (metric.empty()) metric = "cosine";
        auto algo   = req.get_param_value("algo");   if (algo.empty())   algo   = "hnsw";

        auto out = db.search(q, k, metric, algo);
        json resultsArr = json::array();
        for (auto& h : out.hits) {
            resultsArr.push_back({
                {"id", h.id},
                {"metadata", h.meta},
                {"category", h.cat},
                {"distance", h.dist},
                {"embedding", h.emb}
            });
        }
        json response = {
            {"results", resultsArr},
            {"latencyUs", out.us},
            {"algo", out.algo},
            {"metric", out.metric}
        };
        res.set_content(response.dump(), "application/json");
    });

    svr.Post("/insert", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json bodyObj;
        try {
            bodyObj = json::parse(req.body);
        } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax in request body.");
            return;
        }

        if (!bodyObj.contains("metadata") || !bodyObj.contains("category") || !bodyObj.contains("embedding")) {
            sendJsonError(res, 400, "MISSING_FIELD", "Missing required field 'metadata', 'category', or 'embedding'.");
            return;
        }

        if (!bodyObj["metadata"].is_string() || !bodyObj["category"].is_string() || !bodyObj["embedding"].is_array()) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Fields 'metadata' and 'category' must be strings, 'embedding' must be an array.");
            return;
        }

        std::string meta = bodyObj["metadata"].get<std::string>();
        std::string cat = bodyObj["category"].get<std::string>();
        if (meta.empty()) {
            sendJsonError(res, 422, "EMPTY_FIELD", "Field 'metadata' cannot be empty.");
            return;
        }

        std::vector<float> emb;
        try {
            emb = bodyObj["embedding"].get<std::vector<float>>();
        } catch (...) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'embedding' must be an array of numbers.");
            return;
        }

        if ((int)emb.size() != DIMS) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS", "Vector embedding must be exactly " + std::to_string(DIMS) + " dimensions.");
            return;
        }

        int id = db.insert(meta, cat, emb, getDistFn("cosine"));
        res.set_content(json{{"id", id}}.dump(), "application/json");
    });

    svr.Delete(R"(/delete/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        int id = 0;
        try { id = std::stoi(req.matches[1]); } catch (...) {}
        if (id <= 0) {
            sendJsonError(res, 422, "INVALID_ID", "ID must be a positive integer.");
            return;
        }
        bool ok = db.remove(id);
        if (!ok) {
            sendJsonError(res, 404, "NOT_FOUND", "Vector item not found with ID " + std::to_string(id));
            return;
        }
        res.set_content(json{{"ok", true}}.dump(), "application/json");
    });

    svr.Get("/items", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        auto items = db.all();
        json arr = json::array();
        for (auto& v : items) {
            arr.push_back({
                {"id", v.id},
                {"metadata", v.metadata},
                {"category", v.category},
                {"embedding", v.emb}
            });
        }
        res.set_content(arr.dump(), "application/json");
    });

    svr.Get("/benchmark", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        auto q = parseVec(req.get_param_value("v"));
        if ((int)q.size() != DIMS) {
            sendJsonError(res, 422, "INVALID_DIMENSIONS", "Query vector must be exactly " + std::to_string(DIMS) + " dimensions.");
            return;
        }
        int k = 5; try { k = std::stoi(req.get_param_value("k")); } catch (...) {}
        if (k <= 0) {
            sendJsonError(res, 422, "INVALID_K", "Parameter 'k' must be a positive integer greater than 0.");
            return;
        }
        auto metric = req.get_param_value("metric"); if (metric.empty()) metric = "cosine";
        auto b = db.benchmark(q, k, metric);
        json out = {
            {"bruteforceUs", b.bfUs},
            {"kdtreeUs", b.kdUs},
            {"hnswUs", b.hnswUs},
            {"itemCount", b.n}
        };
        res.set_content(out.dump(), "application/json");
    });

    svr.Get("/hnsw-info", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        auto gi = db.hnswInfo();
        json nodesArr = json::array();
        for (auto& n : gi.nodes) {
            nodesArr.push_back({
                {"id", n.id},
                {"metadata", n.metadata},
                {"category", n.category},
                {"maxLyr", n.maxLyr}
            });
        }
        json edgesArr = json::array();
        for (auto& e : gi.edges) {
            edgesArr.push_back({
                {"src", e.src},
                {"dst", e.dst},
                {"lyr", e.lyr}
            });
        }
        json response = {
            {"topLayer", gi.topLayer},
            {"nodeCount", gi.nodeCount},
            {"nodesPerLayer", gi.nodesPerLayer},
            {"edgesPerLayer", gi.edgesPerLayer},
            {"nodes", nodesArr},
            {"edges", edgesArr}
        };
        res.set_content(response.dump(), "application/json");
    });

    // ── DOCUMENT + RAG ENDPOINTS ──────────────────────────────────────

    // POST /doc/insert  {"title":"...","text":"..."}
    svr.Post("/doc/insert", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json bodyObj;
        try {
            bodyObj = json::parse(req.body);
        } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax in request body.");
            return;
        }

        if (!bodyObj.contains("title") || !bodyObj.contains("text")) {
            sendJsonError(res, 400, "MISSING_FIELD", "Missing required field 'title' or 'text'.");
            return;
        }

        if (!bodyObj["title"].is_string() || !bodyObj["text"].is_string()) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Fields 'title' and 'text' must be strings.");
            return;
        }

        std::string title = bodyObj["title"].get<std::string>();
        std::string text = bodyObj["text"].get<std::string>();
        if (title.empty() || text.empty()) {
            sendJsonError(res, 422, "EMPTY_FIELD", "Fields 'title' and 'text' cannot be empty.");
            return;
        }

        auto chunks = chunkText(text, config.chunkWords, config.overlapWords);
        std::vector<int> ids;

        for (int i = 0; i < (int)chunks.size(); i++) {
            auto embRes = ollama.embed(chunks[i]);
            if (!embRes.success) {
                sendJsonError(res, embRes.status_code, embRes.error_code, embRes.error_message);
                return;
            }
            std::string chunkTitle = (chunks.size() > 1)
                ? title + " [" + std::to_string(i+1) + "/" + std::to_string(chunks.size()) + "]"
                : title;
            ids.push_back(docDB.insert(chunkTitle, chunks[i], embRes.embedding));
        }

        json response = {
            {"ids", ids},
            {"chunks", chunks.size()},
            {"dims", docDB.getDims()}
        };
        res.set_content(response.dump(), "application/json");
    });

    // DELETE /doc/delete/123
    svr.Delete(R"(/doc/delete/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        int id = 0;
        try { id = std::stoi(req.matches[1]); } catch (...) {}
        if (id <= 0) {
            sendJsonError(res, 422, "INVALID_ID", "ID must be a positive integer.");
            return;
        }
        bool ok = docDB.remove(id);
        if (!ok) {
            sendJsonError(res, 404, "NOT_FOUND", "Document chunk not found with ID " + std::to_string(id));
            return;
        }
        res.set_content(json{{"ok", true}}.dump(), "application/json");
    });

    // GET /doc/list
    svr.Get("/doc/list", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        auto docs = docDB.all();
        json arr = json::array();
        for (auto& doc : docs) {
            std::string preview = doc.text.substr(0, 120);
            if (doc.text.size() > 120) preview += "…";
            arr.push_back({
                {"id", doc.id},
                {"title", doc.title},
                {"preview", preview},
                {"words", (int)std::count(doc.text.begin(), doc.text.end(), ' ') + 1}
            });
        }
        res.set_content(arr.dump(), "application/json");
    });

    // POST /doc/search {"question":"...","k":3}
    svr.Post("/doc/search", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json bodyObj;
        try {
            bodyObj = json::parse(req.body);
        } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax in request body.");
            return;
        }

        if (!bodyObj.contains("question")) {
            sendJsonError(res, 400, "MISSING_FIELD", "Missing required field 'question'.");
            return;
        }

        if (!bodyObj["question"].is_string()) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'question' must be a string.");
            return;
        }

        std::string question = bodyObj["question"].get<std::string>();
        if (question.empty()) {
            sendJsonError(res, 422, "EMPTY_FIELD", "Field 'question' cannot be empty.");
            return;
        }

        int k = 3;
        if (bodyObj.contains("k")) {
            if (!bodyObj["k"].is_number_integer()) {
                sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'k' must be an integer.");
                return;
            }
            k = bodyObj["k"].get<int>();
        }
        if (k <= 0) {
            sendJsonError(res, 422, "INVALID_K", "Parameter 'k' must be a positive integer greater than 0.");
            return;
        }

        auto qEmbRes = ollama.embed(question);
        if (!qEmbRes.success) {
            sendJsonError(res, qEmbRes.status_code, qEmbRes.error_code, qEmbRes.error_message);
            return;
        }

        auto hits = docDB.search(qEmbRes.embedding, k, config.similarityThreshold);

        json contextsArr = json::array();
        for (auto& h : hits) {
            contextsArr.push_back({
                {"id", h.second.id},
                {"title", h.second.title},
                {"distance", h.first}
            });
        }
        res.set_content(json{{"contexts", contextsArr}}.dump(), "application/json");
    });

    // POST /doc/ask  {"question":"...","k":3}
    svr.Post("/doc/ask", [&](const httplib::Request& req, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json bodyObj;
        try {
            bodyObj = json::parse(req.body);
        } catch (...) {
            sendJsonError(res, 400, "INVALID_JSON", "Malformed JSON syntax in request body.");
            return;
        }

        if (!bodyObj.contains("question")) {
            sendJsonError(res, 400, "MISSING_FIELD", "Missing required field 'question'.");
            return;
        }

        if (!bodyObj["question"].is_string()) {
            sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'question' must be a string.");
            return;
        }

        std::string question = bodyObj["question"].get<std::string>();
        if (question.empty()) {
            sendJsonError(res, 422, "EMPTY_FIELD", "Field 'question' cannot be empty.");
            return;
        }

        int k = 3;
        if (bodyObj.contains("k")) {
            if (!bodyObj["k"].is_number_integer()) {
                sendJsonError(res, 422, "INVALID_FIELD_TYPE", "Field 'k' must be an integer.");
                return;
            }
            k = bodyObj["k"].get<int>();
        }
        if (k <= 0) {
            sendJsonError(res, 422, "INVALID_K", "Parameter 'k' must be a positive integer greater than 0.");
            return;
        }

        // Step 1: embed the question
        auto qEmbRes = ollama.embed(question);
        if (!qEmbRes.success) {
            sendJsonError(res, qEmbRes.status_code, qEmbRes.error_code, qEmbRes.error_message);
            return;
        }

        // Step 2: retrieve top-k relevant chunks
        auto hits = docDB.search(qEmbRes.embedding, k, config.similarityThreshold);

        // Step 3: build prompt
        std::ostringstream ctx;
        for (int i = 0; i < (int)hits.size(); i++) {
            ctx << "[" << (i+1) << "] " << hits[i].second.title << ":\n"
                << hits[i].second.text << "\n\n";
        }
        std::string prompt =
            "You are a helpful assistant. Answer the user's question directly. "
            "Use the provided context if it contains relevant information. "
            "If it doesn't, just use your own general knowledge. "
            "IMPORTANT: Do NOT mention the 'context', 'provided text', or say things like 'the context doesn't mention'. "
            "Just answer the question naturally.\n\n"
            "Context:\n" + ctx.str() +
            "Question: " + question + "\n\n"
            "Answer:";

        // Step 4: generate answer
        auto genRes = ollama.generate(prompt);
        if (!genRes.success) {
            sendJsonError(res, genRes.status_code, genRes.error_code, genRes.error_message);
            return;
        }

        // Step 5: return everything
        json contextsArr = json::array();
        for (auto& h : hits) {
            contextsArr.push_back({
                {"id", h.second.id},
                {"title", h.second.title},
                {"text", h.second.text},
                {"distance", h.first}
            });
        }

        json response = {
            {"answer", genRes.text},
            {"model", ollama.genModel},
            {"contexts", contextsArr},
            {"docCount", docDB.size()}
        };
        res.set_content(response.dump(), "application/json");
    });

    // GET /status
    svr.Get("/status", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        bool up = ollama.isAvailable();
        json response = {
            {"ollamaAvailable", up},
            {"embedModel", ollama.embedModel},
            {"genModel", ollama.genModel},
            {"docCount", docDB.size()},
            {"docDims", docDB.getDims()},
            {"demoDims", DIMS},
            {"demoCount", db.size()}
        };
        res.set_content(response.dump(), "application/json");
    });

    // GET /stats
    svr.Get("/stats", [&](const httplib::Request&, httplib::Response& res) {
        cors(res);
        if (!checkRateLimit(res)) return;
        json response = {
            {"count", db.size()},
            {"dims", DIMS},
            {"algorithms", {"bruteforce", "kdtree", "hnsw"}},
            {"metrics", {"euclidean", "cosine", "manhattan"}}
        };
        res.set_content(response.dump(), "application/json");
    });

    // Serve index.html
    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        std::ifstream f("index.html");
        if (!f.is_open()) {
            json errObj = {
                {"error", {
                    {"code", "NOT_FOUND"},
                    {"message", "Static file index.html not found."}
                }}
            };
            res.status = 404;
            res.set_content(errObj.dump(), "application/json");
            return;
        }
        res.set_content(
            std::string(std::istreambuf_iterator<char>(f),
                        std::istreambuf_iterator<char>()),
            "text/html");
    });

    svr.listen("0.0.0.0", config.port);
    return 0;
}
