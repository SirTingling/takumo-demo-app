# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

**Email:** security@takumo.io

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 24 hours and provide an initial assessment within 72 hours.

## Security Practices

This repository follows these security practices:

- **No hardcoded secrets** — All sensitive values are loaded from environment variables via Zod-validated config
- **Takumo Shield scanning** — Every commit is scanned for leaked secrets and known vulnerabilities
- **Dependabot** — Automated dependency updates for security patches
- **CodeQL** — Static analysis for common vulnerability patterns
- **Parameterized queries** — All database queries use parameterized inputs to prevent SQL injection
- **Strong cryptography** — AES-256-GCM for encryption, bcrypt for password hashing, HMAC-SHA256 for signatures
- **Input validation** — All external inputs are validated with Zod schemas
- **Structured error handling** — Errors never expose stack traces or internal details in production

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
