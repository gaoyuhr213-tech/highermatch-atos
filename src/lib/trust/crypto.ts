/**
 * 蓉才通™ ATOS — 国密加密工具库
 * 
 * 开发环境：使用Web Crypto API (SHA-256) 模拟SM3/SM2接口
 * 生产环境：替换为 @scca/gm-crypto 真实国密SDK
 * 
 * 接口保持一致，切换时仅需替换底层实现
 */

/** SM3哈希计算（开发环境使用SHA-256模拟） */
export async function computeSM3(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `SM3:${hex.slice(0, 64)}`;
}

/** SM3哈希计算（同步版本，用于非异步上下文） */
export function computeSM3Sync(data: string): string {
  // 使用简单但确定性的哈希算法（非Math.random）
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;

  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h0 = Math.imul(h0 ^ ch, 0x9e3779b9) >>> 0;
    h1 = Math.imul(h1 ^ (ch << 8), 0x517cc1b7) >>> 0;
    h2 = Math.imul(h2 ^ (ch << 16), 0x6c62272e) >>> 0;
    h3 = Math.imul(h3 ^ (ch << 24), 0x2e1b2138) >>> 0;
  }

  const hex = [h0, h1, h2, h3].map(v => v.toString(16).padStart(8, '0')).join('');
  return `SM3:${hex}`;
}

/** HMAC-SHA256签名（模拟SM2签名流程） */
export async function signWithHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const sigArray = Array.from(new Uint8Array(signature));
  return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 生成JWT Token（HMAC-SHA256签名） */
export async function generateJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInHours: number = 8
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT', kid: 'atos-trust-v1' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInHours * 3600,
    jti: crypto.randomUUID(),
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(fullPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const sigInput = `${headerB64}.${payloadB64}`;
  const signature = await signWithHMAC(sigInput, secret);
  const sigB64 = btoa(signature).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

/** 验证JWT Token */
export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const sigInput = `${headerB64}.${payloadB64}`;
    const expectedSig = await signWithHMAC(sigInput, secret);
    const expectedSigB64 = btoa(expectedSig).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (sigB64 !== expectedSigB64) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

/** 生成设备指纹（确定性） */
export function generateDeviceFingerprint(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const components = [
    nav?.userAgent || 'server',
    nav?.language || 'zh-CN',
    screen?.width || 1920,
    screen?.height || 1080,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  ];
  return computeSM3Sync(components.join('|'));
}

/** 生成链式存证哈希（包含前一条记录的哈希） */
export async function computeChainHash(
  content: string,
  prevHash: string,
  timestamp: string
): Promise<string> {
  return computeSM3(`${prevHash}:${content}:${timestamp}`);
}
