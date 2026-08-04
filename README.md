# My Own AI — Full-Stack RAG & Vector Search Monorepo

A production-grade Retrieval-Augmented Generation (RAG) platform built from first principles:
a **C++ vector search engine**, a **Node.js + Express REST API Gateway**, and a **React + TypeScript web UI**.

[![C++ Engine CI](https://github.com/Shashank-ok/My-own-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Shashank-ok/My-own-AI/actions/workflows/ci.yml)

---

## System Architecture

```text
React + TypeScript Frontend (Port 5173 / 3001)
        ↓  (HTTP REST)
Node.js + Express API Gateway (Port 3000)
  ├── MongoDB (Metadata & Document Persistence)
  ├── Ollama (Embeddings: nomic-embed-text | LLM: llama3:8b)
  └── C++ Vector Search Engine (Port 8080)
```

### Architectural Rules
- The React frontend communicates **exclusively** with the Node.js API Gateway (`http://localhost:3000`).
- The frontend **never** connects directly to MongoDB, Ollama, or the C++ Vector Engine.
- The Node.js API handles authentication, document chunking, user ownership isolation, and RAG orchestration.

---

## Monorepo Components

```text
/
├── engine/cpp/       ← High-performance C++17 Vector Search Engine (HNSW, KD-Tree, BruteForce)
├── apps/api/         ← Node.js + Express + TypeScript REST API Gateway
├── apps/web/         ← React 18 + Vite + TypeScript Frontend UI
├── benchmarks/       ← Engine benchmark scripts & empirical output (benchmark_results.csv)
└── docs/             ← OpenAPI specification (openapi.json) & architectural documents
```

| Tier | Tech Stack | Port | Test Runner | Automated Tests |
| :--- | :--- | :--- | :--- | :--- |
| **C++ Engine** | C++17, cpp-httplib, nlohmann-json, GoogleTest | `8080` | `ctest` | **53 tests** |
| **Node API** | Node.js, Express, TypeScript, Vitest, MongoDB | `3000` | `vitest` | **110 tests** |
| **React Web** | React 18, Vite, TypeScript, Vitest, Testing Library | `5173` / `3001` | `vitest` | **27 tests** |
| **Total Suite** | | | | **190 passing tests** |

---

## Prerequisites & Requirements

### System Software
1. **Windows 10/11** (or Linux / macOS)
2. **MinGW-w64 GCC 13+** and **CMake 3.24+** (for C++ engine compilation)
3. **Node.js v18+** or **v20+** and **npm**
4. **MongoDB Community Server** (running locally on default port `27017`)
5. **Ollama** (running locally on port `11434`)

### Required Ollama Models
Pull the required embedding and LLM generation models before starting the application:
```powershell
ollama pull nomic-embed-text
ollama pull llama3:8b
```

---

## Correct System Startup Order

To run the full end-to-end stack locally, start services in the following sequence:

1. **Start MongoDB**: Ensure MongoDB service is running (`mongodb://localhost:27017`).
2. **Start Ollama**: Run `ollama serve` (listens on `http://localhost:11434`).
3. **Build & Start C++ Engine**:
   ```powershell
   # Windows (MinGW)
   cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
   cmake --build engine/cpp/build
   .\engine\cpp\build\db.exe 8080
   ```
4. **Build & Start Node.js API**:
   ```powershell
   npm --prefix apps/api install
   npm --prefix apps/api run build
   npm --prefix apps/api run dev
   ```
5. **Build & Start React Frontend**:
   ```powershell
   npm --prefix apps/web install
   npm --prefix apps/web run build
   npm --prefix apps/web run dev
   ```

Open `http://localhost:5173` (or `http://localhost:3001` if port 5173 is occupied) in your browser.

---

## Root Monorepo Workflow Commands

The monorepo provides simple, unified `npm` scripts at the root level:

| Task | Command | Description |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm run setup` | Installs JS packages for both `apps/api` and `apps/web`. |
| **Build C++ Engine** | `npm run build:engine` | Configures & builds C++ engine binaries (`db.exe`, `unit_tests.exe`). |
| **Start Node API** | `npm run dev:api` | Launches Node.js Express server on port `3000`. |
| **Start React UI** | `npm run dev:web` | Launches Vite React dev server on port `5173`/`3001`. |
| **Run All Tests** | `npm test` | Runs CTest engine suite, API Vitest suite, and Web Vitest suite (**190 tests**). |
| **Run Linting** | `npm run lint` | Runs ESLint across both `apps/api` and `apps/web`. |

---

## Development & Build Commands

### C++ Vector Search Engine (`engine/cpp`)
```powershell
# Configure CMake build directory
cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release

# Compile db.exe, unit_tests.exe, and benchmark.exe
cmake --build engine/cpp/build

# Execute vector engine server on port 8080
.\engine\cpp\build\db.exe 8080
```

### Node.js REST API Gateway (`apps/api`)
```powershell
# Install dependencies
npm --prefix apps/api install

# Compile TypeScript to JavaScript
npm --prefix apps/api run build

# Start dev server with hot reload
npm --prefix apps/api run dev
```

### React Web UI (`apps/web`)
```powershell
# Install dependencies
npm --prefix apps/web install

# Validate TypeScript and build Vite production bundle
npm --prefix apps/web run build

# Start Vite development server
npm --prefix apps/web run dev
```

---

## Running Automated Tests (190 Tests Total)

### 1. C++ Engine Test Suite (53 Tests)
```powershell
cmake -S engine/cpp -B engine/cpp/build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build engine/cpp/build
ctest --test-dir engine/cpp/build --output-on-failure
```

### 2. Node.js API Test Suite (110 Tests)
*Note: On Windows, backend tests run Vitest with `--fileParallelism=false` to prevent MongoMemoryServer binary process locks.*
```powershell
npm --prefix apps/api run test
```

### 3. React Frontend Test Suite (27 Tests)
```powershell
npm --prefix apps/web run test
```

### 4. Running Benchmarks
```powershell
.\engine\cpp\build\benchmark.exe
```
Results are exported to `benchmarks/benchmark_results.csv`.

---

## Frontend Port & CORS Configuration

* **Default Frontend Origin**: `http://localhost:5173`
* **Fallback Frontend Origin**: `http://localhost:3001` (if port 5173 is in use)
* **Allowed Origins Setting** (`apps/api/.env`):
  ```env
  ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3001
  ```

---

## Troubleshooting & Common Issues

### 1. CORS Preflight Blocked in Browser
* **Symptom**: Browser network logs show `403 Forbidden` or `CORS policy: Origin not allowed`.
* **Fix**: Ensure your frontend URL (e.g. `http://localhost:3001`) is included in `ALLOWED_ORIGINS` in `apps/api/.env`.

### 2. Ollama Connection Error (`502 Bad Gateway` / `504 Timeout`)
* **Symptom**: Ingestion or chat displays `Ollama engine unavailable`.
* **Fix**: Ensure `ollama serve` is running and the required models exist:
  ```powershell
  ollama list
  # If missing, run:
  ollama pull nomic-embed-text
  ollama pull llama3:8b
  ```

### 3. MongoDB Connection Failure / Vitest Timeout on Windows
* **Symptom**: `MongoMemoryServer` throws hook timeout or binary file lock contention.
* **Fix**: Execute tests using `npm --prefix apps/api run test` which invokes `vitest run --fileParallelism=false`.

### 4. TypeScript JSON Import Errors (`apps/api`)
* **Symptom**: `Cannot find module '../docs/openapi.json'`.
* **Fix**: Confirm `"resolveJsonModule": true` is present under `compilerOptions` in `apps/api/tsconfig.json`.

---

## License

MIT License — free to modify and use.
