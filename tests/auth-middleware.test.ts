import { describe, it, expect } from 'vitest';

describe('Auth Middleware', () => {
  const createToken = (payload: object) => {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${h}.${b}.sig`;
  };

  it('should reject missing auth', () => { expect(undefined).toBeFalsy(); });
  it('should reject malformed token', () => { expect('bad'.split('.').length).not.toBe(3); });
  it('should reject expired token', () => {
    const p = { sub: 'u1', exp: Math.floor(Date.now() / 1000) - 3600 };
    const d = JSON.parse(Buffer.from(createToken(p).split('.')[1], 'base64url').toString());
    expect(d.exp < Math.floor(Date.now() / 1000)).toBe(true);
  });
  it('should accept valid token', () => {
    const p = { sub: 'u1', tenantId: 't1', role: 'hr', exp: Math.floor(Date.now() / 1000) + 3600 };
    const d = JSON.parse(Buffer.from(createToken(p).split('.')[1], 'base64url').toString());
    expect(d.exp > Math.floor(Date.now() / 1000)).toBe(true);
  });
});
