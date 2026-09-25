import { randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults: argon2id, m=19456 KiB, t=2, p=1 (OWASP baseline).
export function hashSecret(secret: string): Promise<string> {
  return hash(secret);
}

let dummyHash: Promise<string> | undefined;

/** Constant-ish time: verifies against a dummy hash when the user has none. */
export async function verifySecret(hashValue: string | null, secret: string): Promise<boolean> {
  if (!hashValue) {
    dummyHash ??= hash('dummy-secret-for-timing');
    await verify(await dummyHash, secret).catch(() => false);
    return false;
  }
  try {
    return await verify(hashValue, secret);
  } catch {
    return false;
  }
}

export function generatePin(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
