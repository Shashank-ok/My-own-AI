# VectorDB — C++ Vector Search Engine

A fully working **vector search engine** built from scratch in C++17 with a web UI.
Implements **HNSW**, **KD-Tree**, and **Brute Force** search algorithms side-by-side,
plus a **RAG pipeline** powered by a local LLM via Ollama.

> Part of the [My Own AI monorepo](../../README.md).
> Built as an educational project to show how production vector databases like Pinecone, Weaviate, and Chroma actually work under the hood.

---

## What This Engine Does

| Feature | Description |
|---|---|
| **3 Search Algorithms** | HNSW (production-grade), KD-Tree, Brute Force |
| **3 Distance Metrics** | Cosine similarity, Euclidean distance, Manhattan distance |
| **Namespace Isolation** | Full multi-tenant isolation — each namespace has its own independent index |
| **Atomic Rebuild** | Zero-downtime namespace index rebuild via `shared_ptr` swap |
| **Shared Read Locking** | `std::shared_mutex` for concurrent reads, exclusive writes |
| **Versioned REST API** | `/v1/*` endpoints: insert, batch, search, delete, rebuild, status |
| **53 Unit Tests** | GoogleTest — distance, index, concurrency, HTTP integration |
| **Benchmark Suite** | Reproducible benchmark with Recall@K, QPS, P95 latency |
| **RAG Pipeline** | Document embedding via Ollama + HNSW retrieval + LLM answer generation |

---

## Versioned API (`/v1/*`)

| Endpoint | Method | Description |
|---|---|---|
| `/v1/health` | GET | Engine health and uptime |
| `/v1/stats` | GET | Supported algorithms, metrics, namespace summary |
| `/v1/vectors` | POST | Insert a single vector |
| `/v1/vectors/batch` | POST | Validated batch insertion |
| `/v1/vectors/search` | POST | k-NN search by namespace, algorithm, metric |
| `/v1/vectors/:id` | DELETE | Delete a vector by external ID |
| `/v1/namespaces/:ns` | DELETE | Drop an entire namespace |
| `/v1/namespaces/:ns/rebuild` | POST | Atomic zero-downtime index rebuild |
| `/v1/namespaces/:ns/status` | GET | Namespace status, vector count, dimensions |

**Error schema** (consistent across all endpoints):
```json
{ "error": { "code": "INVALID_DIMENSIONS", "message": "Expected 3, got 2" } }
```

---

## Building

### Prerequisites (Windows)
- MSYS2 UCRT64 with `mingw-w64-ucrt-x86_64-gcc`
- CMake ≥ 3.16

```powershell
# From repository root
$env:PATH = "C:\msys64\ucrt64\bin;C:\Program Files\CMake\bin;" + $env:PATH
cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
.\engine\cpp\build\db.exe
```

### Prerequisites (Ubuntu)
```bash
sudo apt-get install -y cmake ninja-build g++

# From repository root
cmake -S engine/cpp -B engine/cpp/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
./engine/cpp/build/db
```

### Build from inside this directory

```powershell
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build build
.\build\db.exe
```

---

## Running Tests

```powershell
# From repo root (Windows)
cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
ctest --test-dir engine/cpp/build --output-on-failure

# From inside engine/cpp
cmake -B build && cmake --build build && ctest --test-dir build --output-on-failure
```

**53 tests, 9 suites, zero Ollama or external dependencies.**

| Suite | Tests |
|---|---|
| `DistanceTest` | 9 |
| `BruteForceTest` | 2 |
| `KDTreeTest` | 2 |
| `HNSWTest` | 5 |
| `EdgeCaseTest` | 13 |
| `ConcurrencyTest` | 2 |
| `V1ApiTest` | 3 |
| `AtomicRebuildTest` | 3 |
| `V1ServerFixture` (HTTP) | 14 |

---

## Benchmark

```powershell
.\engine\cpp\build\benchmark.exe   # Windows
./engine/cpp/build/benchmark        # Ubuntu
```

Results are written to `../../benchmarks/benchmark_results.csv`.

### Sample Results (N=1000, D=64, K=10, seed=42)

| Algorithm | Build (ms) | Mean Latency (µs) | QPS | Recall@K |
|---|---|---|---|---|
| BruteForce | 0.30 | 61.9 | 16,082 | 1.000 |
| KDTree | 0.30 | 40.4 | 24,569 | 1.000 |
| HNSW | 166.0 | 115.3 | 8,583 | 0.996 |

---

## Continuous Integration

[![C++ Engine CI](https://github.com/Shashank-ok/My-own-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Shashank-ok/My-own-AI/actions/workflows/ci.yml)

- Ubuntu (GCC + Ninja) and Windows (MinGW-w64)
- CMake configure → build → CTest → benchmark smoke test
- No Ollama required for the standard test suite

---

## License

MIT — use this however you want.
