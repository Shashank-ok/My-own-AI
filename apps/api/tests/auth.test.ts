import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './models/setup';

describe('Authentication API (/auth)', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();
  });

  describe('POST /auth/register', () => {
    it('should successfully register a new user and return a JWT token', async () => {
      const payload = {
        email: 'Alice.Smith@example.com',
        password: 'securePassword123!',
        name: 'Alice Smith',
      };

      const res = await request(app).post('/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('alice.smith@example.com');
      expect(res.body.user.name).toBe('Alice Smith');
      expect(res.body.user.role).toBe('user');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should reject registration with a duplicate email', async () => {
      const payload = {
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'First User',
      };

      await request(app).post('/auth/register').send(payload);

      const res = await request(app).post('/auth/register').send({
        email: 'DUPLICATE@example.com',
        password: 'anotherPassword123',
        name: 'Second User',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should reject registration with weak password (<8 chars)', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'short@example.com',
        password: 'short',
        name: 'Short Pass',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation error');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/auth/register').send({
        email: 'login.test@example.com',
        password: 'correctPassword123',
        name: 'Login Tester',
      });
    });

    it('should log in successfully with valid credentials', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'login.test@example.com',
        password: 'correctPassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('login.test@example.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with wrong password using a generic error message', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'login.test@example.com',
        password: 'wrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login with non-existent email using generic error message', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'anyPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('GET /auth/me', () => {
    let token: string;

    beforeEach(async () => {
      const reg = await request(app).post('/auth/register').send({
        email: 'profile.user@example.com',
        password: 'mySecretPassword123',
        name: 'Profile User',
      });
      token = reg.body.token;
    });

    it('should return the authenticated user profile when valid Bearer token provided', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('profile.user@example.com');
      expect(res.body.user.name).toBe('Profile User');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject request when Authorization header is missing', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Authentication token is required');
    });

    it('should reject request when Authorization token is invalid', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid_jwt_token');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid or expired authentication token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 OK logout instructions when authenticated', async () => {
      const reg = await request(app).post('/auth/register').send({
        email: 'logout.user@example.com',
        password: 'password123!',
        name: 'Logout User',
      });

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${reg.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logged out successfully');
    });
  });
});
