import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // 32 bytes key
const IV_LENGTH = 16; // 16 bytes IV

// ------------------------------
// AES: Two-way Encryption/Decryption
// ------------------------------
export function encryptSecretKey(secret: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptSecretKey(encrypted: string): string {
  const [ivHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ------------------------------
// Compare input with encrypted value
// ------------------------------
export function compareEncryptedSecretKey(secret: string, encrypted: string): boolean {
  try {
    const decrypted = decryptSecretKey(encrypted);
    return secret === decrypted;
  } catch (err) {
    return false;
  }
}