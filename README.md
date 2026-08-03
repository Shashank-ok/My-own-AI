# My Own AI — Monorepo

A full-stack AI assistant built from first principles:
a **C++ vector search engine**, a **Node.js REST API**, and a **React web UI** —
all orchestrated as a clean monorepo.

[![C++ Engine CI](https://github.com/Shashank-ok/My-own-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Shashank-ok/My-own-AI/actions/workflows/ci.yml)

---

## Repository Structure

```
/
├── apps/
│   ├── api/            ← Node.js + Express REST API (Stage B)
│   └── web/            ← React frontend UI (Stage C)
├── engine/
│   └── cpp/            ← C++ vector search engine (Stage A — complete)
├── packages/
│   └── shared/         ← Shared TypeScript types and schemas (Stage B+)
├── benchmarks/
│   └── benchmark_results.csv  ← Empirical engine benchmark data
├── docs/               ← Architecture and API documentation
├── docker/             ← Docker and docker-compose definitions
├── .github/
│   └── workflows/
│       └── ci.yml      ← GitHub Actions CI (Ubuntu + Windows matrix)
└── README.md           ← This file
```

---

## Components

### `engine/cpp` — C++ Vector Search Engine

A production-quality, namespace-isolated, multi-algorithm vector search engine written from scratch in C++17.

| Feature | Detail |
| :--- | :--- |
| **Algorithms** | HNSW, KDTree, BruteForce |
| **Distance metrics** | Cosine (normalized), Euclidean, Manhattan |
| **API** | Versioned HTTP REST (`/v1/*`) served by cpp-httplib |
| **Namespaces** | Full multi-tenant namespace isolation |
| **Concurrency** | `std::shared_mutex` — shared reads, exclusive writes |
| **Atomic rebuild** | Zero-downtime namespace index replacement via `shared_ptr` swap |
| **Tests** | 53 GoogleTest cases — distance, index, edge cases, concurrency, HTTP integration |
| **CI** | Ubuntu + Windows via GitHub Actions |

**Quick start:**
```powershell
# Windows (MinGW-w64)
$env:PATH = "C:\msys64\ucrt64\bin;C:\Program Files\CMake\bin;" + $env:PATH
cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
.\engine\cpp\build\db.exe
```

```bash
# Ubuntu / macOS
cmake -S engine/cpp -B engine/cpp/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
./engine/cpp/build/db
```

See [`engine/cpp/README.md`](engine/cpp/README.md) for full C++ engine documentation.

---

### `apps/api` — Node.js REST API *(Stage B — in progress)*

Express + TypeScript API layer responsible for:
- Document ingestion and chunking
- Ollama embedding integration
- RAG pipeline orchestration
- Forwarding vector operations to `engine/cpp`
- MongoDB persistence

---

### `apps/web` — React Frontend *(Stage C — planned)*

React UI for:
- Document upload and search
- Vector space visualization (PCA scatter plot)
- Engine statistics dashboard

---

## Running Tests

### C++ Engine Tests (53 tests)

```powershell
# Windows
$env:PATH = "C:\msys64\ucrt64\bin;C:\Program Files\CMake\bin;" + $env:PATH
cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
ctest --test-dir engine/cpp/build --output-on-failure
```

```bash
# Ubuntu
cmake -S engine/cpp -B engine/cpp/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
ctest --test-dir engine/cpp/build --output-on-failure
```

### Benchmark

```powershell
.\engine\cpp\build\benchmark.exe   # Windows
./engine/cpp/build/benchmark        # Ubuntu
```

Results are exported to `benchmarks/benchmark_results.csv`.

---

## Continuous Integration

GitHub Actions runs on every push and pull request:
- **Ubuntu** (GCC + Ninja) and **Windows** (MinGW-w64)
- CMake configure → build → CTest (53 tests) → benchmark smoke test
- Test logs uploaded as artifacts on failure

No Ollama, MongoDB, or Node.js required for the C++ test suite.

---

## License

MIT — use this however you want.
