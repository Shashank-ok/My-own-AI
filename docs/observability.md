# System Observability & Log Correlation Guide

This document describes the native observability architecture of the My Own AI monorepo, covering distributed request tracing, structured logging, health probes, and log correlation strategies across the Node.js API Gateway and the C++ Vector Search Engine.

---

## 1. Observability Architecture Overview

The system uses lightweight, dependency-free observability built directly into the Node.js API Gateway and C++ Vector Engine:

```
[ Client Request ]
       │ (Optional: X-Request-ID)
       ▼
┌──────────────────────────────────────────────────────────┐
│  Node.js Express API Gateway                             │
│  - Generates/validates UUID X-Request-ID                 │
│  - Binds request ID to AsyncLocalStorage context         │
│  - Emits JSON structured HTTP access log                 │
└──────────────────────────┬───────────────────────────────┘
                           │ Outbound HTTP + X-Request-ID
                           ▼
┌──────────────────────────────────────────────────────────┐
│  C++ Vector Search Engine                                │
│  - Extracts X-Request-ID from request headers            │
│  - Reflects X-Request-ID in HTTP response                │
│  - Emits JSON structured request duration log            │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Distributed Tracing with `X-Request-ID`

Every request passing through the system carries a unique UUID string passed via the HTTP header `X-Request-ID`.

1. **Ingress**: If an incoming client request supplies an `X-Request-ID` header, the Node.js API Gateway preserves it. Otherwise, a new UUID v4 is generated.
2. **Context Propagation**: The API Gateway uses Node.js `AsyncLocalStorage` (`requestIdStorage`) to automatically inject `X-Request-ID` into all outbound HTTP calls made by `VectorEngineClient` and `OllamaClient`.
3. **Downstream Processing**: The C++ Vector Engine extracts `X-Request-ID` from incoming requests and reflects it in all HTTP response headers.
4. **Log Correlation**: Both Node.js and C++ loggers write the request ID into every log line under the key `"requestId"`.

---

## 3. Log Schemas & Formats

Both Node.js API Gateway and C++ Vector Engine emit newline-delimited JSON objects to standard output (`stdout`).

### 3.1 Node.js API Gateway Log Schema

```json
{
  "timestamp": "2026-08-04T13:45:00.123Z",
  "level": "info",
  "service": "api-gateway",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "POST",
  "path": "/api/search",
  "statusCode": 200,
  "durationMs": 14,
  "userAgent": "Mozilla/5.0..."
}
```

### 3.2 C++ Vector Engine Log Schema

```json
{
  "timestamp": "2026-08-04T13:45:00.125Z",
  "level": "INFO",
  "service": "cpp-vector-engine",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "POST",
  "path": "/v1/vectors/search",
  "statusCode": 200,
  "durationMs": 2
}
```

---

## 4. How to Correlate Logs Across Services

To trace a request end-to-end across Node.js API Gateway and C++ Vector Engine:

1. **Obtain the Request ID**: Check the `X-Request-ID` header returned in the HTTP response or inspect the client error response body (`error.requestId`).
2. **Search Logs by Request ID**: Filter stdout logs by `"requestId"` value across service logs:

```bash
# Filter Node API logs by requestId
docker logs myownai-api | grep "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Filter C++ Engine logs by requestId
docker logs myownai-engine | grep "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

## 5. Health Probe Endpoint (`GET /health`)

The Node.js API Gateway provides a unified health probe endpoint at `GET /health`.

### Response Example (`200 OK`)

```json
{
  "status": "ok",
  "timestamp": "2026-08-04T13:45:00.000Z",
  "uptimeSec": 1240.5,
  "services": {
    "mongodb": {
      "status": "connected",
      "latencyMs": 2,
      "databaseName": "myownai"
    },
    "cppEngine": {
      "status": "ok",
      "latencyMs": 1,
      "version": "1.0.0",
      "uptimeSec": 3600,
      "url": "http://localhost:8080"
    },
    "ollama": {
      "status": "ok",
      "latencyMs": 12,
      "embeddingModel": "nomic-embed-text",
      "generateModel": "llama3:8b",
      "url": "http://localhost:11434"
    }
  }
}
```

### Status Thresholds
- **`ok` (HTTP 200)**: All components (MongoDB, C++ Engine, Ollama) are responsive.
- **`degraded` (HTTP 200)**: Core dependencies (MongoDB & C++ Engine) are healthy, but optional Ollama service is unavailable.
- **`down` (HTTP 503)**: Core dependencies (MongoDB or C++ Engine) are down.

---

## 6. Error Reporting & Sanitization

- **Production Sanitization**: When `NODE_ENV=production`, internal 500 errors return sanitized error messages (`"An unexpected error occurred on the server"`) to clients without revealing internal database error details, credentials, or stack traces.
- **Error Tracking**: All operational errors (4xx) and internal errors (5xx) log full details server-side along with the associated `requestId`.
