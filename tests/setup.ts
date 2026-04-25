process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 256-bit hex key for tests
