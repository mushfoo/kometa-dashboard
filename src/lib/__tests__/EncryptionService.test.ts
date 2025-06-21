import { EncryptionService } from '../EncryptionService';
import { promises as fs } from 'fs';
import crypto from 'crypto';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (EncryptionService as any).instance = null;
    encryptionService = EncryptionService.getInstance();
    // Reset internal key state
    (encryptionService as any).key = null;
  });

  describe('getInstance', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = EncryptionService.getInstance();
      const instance2 = EncryptionService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('encrypt', () => {
    beforeEach(() => {
      // Mock key generation scenario
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('returns empty string for empty input', async () => {
      const result = await encryptionService.encrypt('');
      expect(result).toBe('');
    });

    it('returns already encrypted text unchanged', async () => {
      const encryptedText = 'enc:abcd1234:efgh5678:encrypted_content';
      const result = await encryptionService.encrypt(encryptedText);
      expect(result).toBe(encryptedText);
    });

    it('encrypts plain text', async () => {
      const plainText = 'my-secret-key';
      const result = await encryptionService.encrypt(plainText);

      expect(result).toMatch(/^enc:/);
      expect(result.split(':')).toHaveLength(4);
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('creates key directory if it does not exist', async () => {
      await encryptionService.encrypt('test');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('storage/keys'),
        { recursive: true }
      );
    });
  });

  describe('decrypt', () => {
    beforeEach(() => {
      // Mock existing key scenario
      const mockKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
      mockFs.readFile.mockResolvedValue(mockKey);
    });

    it('returns non-encrypted text unchanged', async () => {
      const plainText = 'not-encrypted';
      const result = await encryptionService.decrypt(plainText);
      expect(result).toBe(plainText);
    });

    it('returns empty string for empty input', async () => {
      const result = await encryptionService.decrypt('');
      expect(result).toBe('');
    });

    it('handles invalid encrypted format gracefully', async () => {
      const invalidEncrypted = 'enc:invalid:format';
      const result = await encryptionService.decrypt(invalidEncrypted);
      expect(result).toBe(invalidEncrypted);
    });

    it('handles missing parts in encrypted format', async () => {
      const invalidEncrypted = 'enc:::';
      const result = await encryptionService.decrypt(invalidEncrypted);
      expect(result).toBe(invalidEncrypted);
    });

    it('decrypts valid encrypted text', async () => {
      // Mock key for encryption/decryption (ensure key generation works)
      mockFs.readFile.mockRejectedValue(new Error('Key file not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      // First encrypt a value
      const plainText = 'my-secret-key';
      const encrypted = await encryptionService.encrypt(plainText);

      // Then decrypt it
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });
  });

  describe('maskKey', () => {
    beforeEach(() => {
      // Reset key state and mock key scenario
      (encryptionService as any).key = null;
      const mockKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
      mockFs.readFile.mockResolvedValue(mockKey);
    });

    it('returns empty string for empty input', async () => {
      const result = await encryptionService.maskKey('');
      expect(result).toBe('');
    });

    it('masks short keys completely', async () => {
      const shortKey = 'abc123';
      const result = await encryptionService.maskKey(shortKey);
      expect(result).toBe('******');
    });

    it('masks long keys showing first and last 4 characters', async () => {
      const longKey = 'abcd1234567890efgh';
      const result = await encryptionService.maskKey(longKey);
      expect(result).toBe('abcd**********efgh');
    });

    it('masks 8-character keys completely', async () => {
      const eightCharKey = 'abcd1234';
      const result = await encryptionService.maskKey(eightCharKey);
      expect(result).toBe('********');
    });

    it('masks encrypted keys after decryption', async () => {
      // Test decryption and masking with a mock encrypted value
      const mockEncrypted = 'enc:::iv:::tag:::data';

      // Mock decrypt to return a predictable value
      const originalDecrypt = encryptionService.decrypt;
      encryptionService.decrypt = jest
        .fn()
        .mockResolvedValue('my-long-secret-api-key-12345');

      const masked = await encryptionService.maskKey(mockEncrypted);
      expect(masked).toBe('my-l********************2345');

      // Restore original method
      encryptionService.decrypt = originalDecrypt;
    });

    it('ensures minimum middle asterisks', async () => {
      const nineCharKey = 'abcd12345';
      const result = await encryptionService.maskKey(nineCharKey);
      expect(result).toBe('abcd****2345');
    });
  });

  describe('ensureKey', () => {
    it('reuses existing key when already loaded', async () => {
      // Mock existing key scenario (32 bytes for AES-256)
      const mockKey = crypto.randomBytes(32);
      mockFs.readFile.mockResolvedValue(mockKey);

      // First call loads the key
      await encryptionService.encrypt('test1');
      mockFs.readFile.mockClear();

      // Second call should reuse key
      await encryptionService.encrypt('test2');
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('loads existing key from file', async () => {
      const mockKey = crypto.randomBytes(32); // 32 bytes for AES-256
      mockFs.readFile.mockResolvedValue(mockKey);

      await encryptionService.encrypt('test');

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('.encryption-key')
      );
    });

    it('generates new key when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await encryptionService.encrypt('test');

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.encryption-key'),
        expect.any(Buffer),
        { mode: 0o600 }
      );
    });
  });

  describe('round-trip encryption/decryption', () => {
    beforeEach(() => {
      // Mock key generation scenario
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('successfully encrypts and decrypts text', async () => {
      const originalText =
        'This is a secret message with special chars: !@#$%^&*()';

      const encrypted = await encryptionService.encrypt(originalText);
      expect(encrypted).toMatch(/^enc:/);
      expect(encrypted).not.toBe(originalText);

      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('handles unicode characters', async () => {
      const unicodeText = '🔐 Secret émojis and ñon-ásçíí characters 中文';

      const encrypted = await encryptionService.encrypt(unicodeText);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });
  });
});
