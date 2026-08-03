# Embedding Storage Cost Analysis — MongoDB Persistence

This document details the storage costs and operational tradeoffs of persisting floating-point vector embeddings in MongoDB for **My Own AI**.

---

## 1. Why Persist Embeddings in MongoDB?

In this architecture:
- **MongoDB** is the **durable source of truth** for all users, documents, chunks, and vector embeddings.
- **C++ Engine** is an **in-memory vector index** (supporting HNSW, KD-Tree, and BruteForce).

### Key Architectural Benefits
1. **Zero-Recomputation Index Rebuilds**: If the C++ server restarts or a namespace index needs to be rebuilt atomically, the C++ engine streams pre-computed vectors directly from MongoDB instead of calling Ollama's embedding API again.
2. **LLM Cost & Latency Prevention**: Generating embeddings via Ollama or external LLM endpoints is CPU/GPU intensive (~50-200ms per text chunk). Storing the vector once guarantees zero repeated embedding calls for existing chunks.
3. **Multi-Model Portability**: Allows switching vector algorithms or index parameters in the C++ engine on-the-fly.

---

## 2. Storage Size Calculations per Chunk

In MongoDB (BSON format):
- Numbers stored inside arrays are encoded as **64-bit IEEE 754 floating-point doubles** (**8 bytes** per element).
- BSON array overhead adds ~12 bytes per field key/wrapper.

### Byte Footprint per Vector Dimension

| Model | Dimensions | Vector Size in BSON | Text + Metadata (avg) | Total Chunk Record Size |
| :--- | :--- | :--- | :--- | :--- |
| **`nomic-embed-text` / `all-minilm`** | 768 | ~6.14 KB | ~1.5 KB | **~7.6 KB** |
| **`bge-large-en` / `text-embedding-3-small`**| 1,024 | ~8.19 KB | ~1.5 KB | **~9.7 KB** |
| **`text-embedding-3-large`** | 1,536 | ~12.28 KB | ~1.5 KB | **~13.8 KB** |

---

## 3. Scale Projections (768-Dimension Vectors)

Assuming an average text chunk size of **1,000 characters** (~200 words):

| Document Volume | Total Chunks | Raw Vector Storage | DocumentChunk Collection Size |
| :--- | :--- | :--- | :--- |
| **100 documents** (small library) | 2,000 chunks | ~12.2 MB | **~15.2 MB** |
| **1,000 documents** (medium knowledge base) | 20,000 chunks | ~122.8 MB | **~152.0 MB** |
| **10,000 documents** (enterprise corpus) | 200,000 chunks | ~1.22 GB | **~1.52 GB** |
| **100,000 documents** (large-scale repository) | 2,000,000 chunks | ~12.28 GB | **~15.20 GB** |

---

## 4. Indexing & Optimization Best Practices

1. **Do NOT Index `embedding` Array in MongoDB**:
   - Primary vector similarity search is performed by the C++ engine in memory.
   - MongoDB only performs document/chunk lookups by `_id`, `ownerId`, `documentId`, `engineVectorId`, and `engineNamespace`.
   - Creating standard BSON indexes on the 768-element array would explode RAM and index size without any benefit.

2. **Chunk Partitioning**:
   - Storing each chunk as a separate document in `DocumentChunk` avoids hitting MongoDB's 16MB document size limit when storing large books or PDFs containing thousands of chunks.

3. **Compound Unique Index**:
   - `{ documentId: 1, chunkIndex: 1 }` guarantees idempotent re-ingestion and prevents duplicate chunks.
