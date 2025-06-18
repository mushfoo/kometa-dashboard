import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export class EncryptionService {
  private static instance: EncryptionService;
  private key: Buffer | null = null;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyPath = path.join(
    process.cwd(),
    'storage',
    'keys',
    '.encryption-key'
  );

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private async ensureKey(): Promise<Buffer> {
    if (this.key) {
      return this.key;
    }

    try {
      // Try to read existing key
      const keyData = await fs.readFile(this.keyPath);
      this.key = keyData;
      return this.key;
    } catch (error) {
      // Generate new key if it doesn't exist
      this.key = crypto.randomBytes(32);

      // Ensure directory exists
      const keyDir = path.dirname(this.keyPath);
      await fs.mkdir(keyDir, { recursive: true });

      // Save key
      await fs.writeFile(this.keyPath, this.key, { mode: 0o600 });

      return this.key;
    }
  }

  async encrypt(text: string): Promise<string> {
    if (!text) return text;

    // Check if already encrypted (has the encrypted prefix)
    if (text.startsWith('enc:')) {
      return text;
    }

    const key = await this.ensureKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: enc:iv:authTag:encrypted
    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText || !encryptedText.startsWith('enc:')) {
      return encryptedText;
    }

    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted format');
      }

      const [, ivHex, authTagHex, encrypted] = parts;
      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted format - missing parts');
      }

      const key = await this.ensureKey();

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      // Return original if decryption fails
      return encryptedText;
    }
  }

  async maskKey(key: string): Promise<string> {
    if (!key) return key;

    // Decrypt first if encrypted
    const decrypted = await this.decrypt(key);

    // Show first 4 and last 4 characters
    if (decrypted.length <= 8) {
      return '*'.repeat(decrypted.length);
    }

    const first = decrypted.slice(0, 4);
    const last = decrypted.slice(-4);
    const middle = '*'.repeat(Math.max(decrypted.length - 8, 4));

    return `${first}${middle}${last}`;
  }
}
