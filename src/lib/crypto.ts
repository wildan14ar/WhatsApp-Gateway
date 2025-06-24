// src/utils/crypto.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashSecretKey(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export async function verifySecretKey(
  secret: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(secret, hashed);
}
