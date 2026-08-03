#include <gtest/gtest.h>
#include "../types.hpp"
#include "../distance.hpp"
#include "../brute_force.hpp"
#include "../kd_tree.hpp"
#include "../hnsw.hpp"
#include <vector>
#include <thread>
#include <future>
#include <atomic>
#include <unordered_map>
#include <shared_mutex>

class TestDocumentDB {
    struct DocItem {
        int id;
        std::string title;
        std::string text;
        std::vector<float> emb;
    };

    std::unordered_map<int, DocItem> store;
    HNSW hnsw;
    BruteForce bf;
    mutable std::shared_mutex mu;
    int nextId = 1;
    int dims = 0;

public:
    TestDocumentDB() : hnsw(16, 200) {}

    int insert(const std::string& title, const std::string& text, const std::vector<float>& emb) {
        std::unique_lock<std::shared_mutex> lk(mu);
        if (dims == 0) dims = (int)emb.size();
        DocItem item{nextId++, title, text, emb};
        store[item.id] = item;
        VectorItem vi{item.id, title, "doc", emb};
        hnsw.insert(vi, cosine);
        bf.insert(vi);
        return item.id;
    }

    std::vector<std::pair<float, DocItem>> search(const std::vector<float>& q, int k, float max_dist = 0.7f) const {
        std::shared_lock<std::shared_mutex> lk(mu);
        if (store.empty()) return {};
        auto raw = (store.size() < 10) ? const_cast<BruteForce&>(bf).knn(q, k, cosine)
                                       : const_cast<HNSW&>(hnsw).knn(q, k, 50, cosine);
        std::vector<std::pair<float, DocItem>> out;
        for (auto& [d, id] : raw)
            if (store.count(id) && d <= max_dist) out.push_back({d, store.at(id)});
        return out;
    }

    bool remove(int id) {
        std::unique_lock<std::shared_mutex> lk(mu);
        if (!store.count(id)) return false;
        store.erase(id); hnsw.remove(id); bf.remove(id);
        return true;
    }

    size_t size() const {
        std::shared_lock<std::shared_mutex> lk(mu);
        return store.size();
    }
};

TEST(ConcurrencyTest, ParallelReaders) {
    TestDocumentDB db;
    std::vector<float> emb = {1.0f, 0.0f, 0.0f, 0.0f};
    for (int i = 0; i < 20; ++i) {
        db.insert("Doc " + std::to_string(i), "Sample text content", emb);
    }

    const int numThreads = 10;
    std::vector<std::future<size_t>> futures;

    for (int t = 0; t < numThreads; ++t) {
        futures.push_back(std::async(std::launch::async, [&db, &emb]() {
            size_t total = 0;
            for (int r = 0; r < 50; ++r) {
                auto hits = db.search(emb, 3, 1.0f);
                total += hits.size();
                total += db.size();
            }
            return total;
        }));
    }

    for (auto& f : futures) {
        EXPECT_GT(f.get(), 0u);
    }
}

TEST(ConcurrencyTest, MixedReadWriteStress) {
    TestDocumentDB db;
    std::atomic<bool> stop{false};
    std::vector<std::thread> threads;

    for (int w = 0; w < 4; ++w) {
        threads.emplace_back([&db, &stop, w]() {
            int counter = 0;
            while (!stop.load()) {
                std::vector<float> emb = {static_cast<float>(w), static_cast<float>(counter), 0.0f, 0.0f};
                int id = db.insert("WriterDoc", "Text", emb);
                if (id % 2 == 0) {
                    db.remove(id);
                }
                counter++;
                std::this_thread::yield();
            }
        });
    }

    std::atomic<int> totalSearchHits{0};
    for (int r = 0; r < 8; ++r) {
        threads.emplace_back([&db, &stop, &totalSearchHits]() {
            std::vector<float> q = {1.0f, 0.0f, 0.0f, 0.0f};
            while (!stop.load()) {
                auto hits = db.search(q, 3, 1.0f);
                totalSearchHits += (int)hits.size();
                (void)db.size();
                std::this_thread::yield();
            }
        });
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(200));
    stop.store(true);

    for (auto& t : threads) {
        if (t.joinable()) t.join();
    }

    EXPECT_GT(db.size(), 0u);
}
