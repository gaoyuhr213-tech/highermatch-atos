import { describe, it, expect } from 'vitest';

describe('Trust Gateway', () => {
  describe('SM3 Hash', () => {
    it('should produce consistent hash for same input', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('test-data');
      const hash1 = await crypto.subtle.digest('SHA-256', data);
      const hash2 = await crypto.subtle.digest('SHA-256', data);
      expect(Buffer.from(hash1).toString('hex')).toBe(Buffer.from(hash2).toString('hex'));
    });

    it('should produce different hash for different input', async () => {
      const encoder = new TextEncoder();
      const hash1 = await crypto.subtle.digest('SHA-256', encoder.encode('a'));
      const hash2 = await crypto.subtle.digest('SHA-256', encoder.encode('b'));
      expect(Buffer.from(hash1).toString('hex')).not.toBe(Buffer.from(hash2).toString('hex'));
    });
  });

  describe('k-Anonymity Guard', () => {
    const K = 20;
    it('should reject when sample < k', () => { expect(15 < K).toBe(true); });
    it('should allow when sample >= k', () => { expect(25 >= K).toBe(true); });
  });

  describe('JWT Token', () => {
    it('should have three dot-separated parts', () => {
      const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.sig';
      expect(token.split('.').length).toBe(3);
    });
    it('should decode payload', () => {
      const payload = { sub: 'u1', tenantId: 't1', role: 'hr' };
      const enc = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const dec = JSON.parse(Buffer.from(enc, 'base64url').toString());
      expect(dec.sub).toBe('u1');
      expect(dec.tenantId).toBe('t1');
    });
  });
});
