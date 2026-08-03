# Authentication & Security Limitations Document

This document outlines the security architecture, design choices, and security limitations for authentication in **My Own AI**.

---

## 1. Security Architecture & Controls

### Password Hashing (`bcryptjs`)
- All user passwords are salted and hashed using `bcryptjs` with **10 salt rounds**.
- Plaintext passwords are never logged, stored in MongoDB, or returned in any API response.
- Password hashes are excluded from `User` document serialization (`sanitizeUser`).

### Input Validation & Prevention of Enumeration
- Email inputs are validated, trimmed, and converted to lowercase.
- Passwords require a minimum length of 8 characters.
- Login failures use a **generic error message**: `"Invalid email or password"`.
  - Rejects both non-existent emails and wrong passwords with identical status (`401 Unauthorized`) and message, preventing account enumeration attacks.

### Authentication Rate Limiting
- `/auth/register` and `/auth/login` routes are protected by `express-rate-limit`.
- Restricted to **15 requests per 15-minute window per IP address** to prevent automated password dictionary attacks and brute-force credential stuffing.

### Token Architecture (JWT)
- Signed using `jsonwebtoken` with HMAC SHA-256 (`HS256`) and `config.jwtSecret`.
- Payload contains minimal identifiers: `{ userId, email, role }`.
- Default token expiration is set to **7 days**.

---

## 2. Security Limitations & Mitigations

### 1. Stateless Logout & Token Revocation
- **Limitation**: Stateless JWT access tokens cannot be instantly revoked server-side upon `/auth/logout` without maintaining a token blacklist. Once issued, a valid JWT remains accepted until its expiration timestamp (`exp`).
- **Mitigation / Next Step**: Current `POST /auth/logout` provides client-side logout instructions (clearing `localStorage` / `sessionStorage`). In future production phases, a Redis-backed token revocation list or DB-backed `tokenVersion` field on the `User` model can invalidate all tokens on logout or password reset.

### 2. Transport Security (HTTPS)
- **Limitation**: Bearer tokens passed in `Authorization: Bearer <token>` headers can be intercepted if transmitted over unencrypted HTTP connections.
- **Mitigation**: Production environments must enforce TLS/HTTPS at the reverse proxy / API gateway level (e.g. Nginx or Cloudflare).

### 3. Refresh Tokens & Storage Location
- **Limitation**: Storing access tokens in browser `localStorage` leaves tokens vulnerable to Cross-Site Scripting (XSS) attacks.
- **Mitigation / Next Step**: For client applications (Stage C), short-lived access tokens (15 mins) paired with `httpOnly`, `Secure`, `SameSite=Strict` refresh token cookies should be introduced to isolate token access from JavaScript context.
