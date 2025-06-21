import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

// Collection schema for storage
const StoredCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['smart', 'manual']),
  filters: z.any().optional(), // Kometa filter format
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.any()).optional(),
});

type StoredCollection = z.infer<typeof StoredCollectionSchema>;

export class CollectionStorageService {
  private storageDir: string;
  private collectionsFile: string;

  constructor(storageDir: string = 'storage') {
    this.storageDir = storageDir;
    this.collectionsFile = path.join(storageDir, 'collections.json');
  }

  async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  async loadCollections(): Promise<StoredCollection[]> {
    await this.ensureStorageDirectory();

    try {
      const data = await fs.readFile(this.collectionsFile, 'utf-8');
      const collections = JSON.parse(data);
      return z.array(StoredCollectionSchema).parse(collections);
    } catch (error) {
      // If file doesn't exist or is invalid, return empty array
      return [];
    }
  }

  async saveCollection(
    collection: Omit<StoredCollection, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoredCollection> {
    await this.ensureStorageDirectory();

    const collections = await this.loadCollections();
    const now = new Date().toISOString();

    const newCollection: StoredCollection = {
      ...collection,
      id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    collections.push(newCollection);

    // Atomic write with temp file
    const tempFile = `${this.collectionsFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(collections, null, 2));
    await fs.rename(tempFile, this.collectionsFile);

    return newCollection;
  }

  async updateCollection(
    id: string,
    updates: Partial<Omit<StoredCollection, 'id' | 'createdAt'>>
  ): Promise<StoredCollection | null> {
    const collections = await this.loadCollections();
    const index = collections.findIndex((col) => col.id === id);

    if (index === -1) {
      return null;
    }

    const updatedCollection: StoredCollection = {
      ...collections[index]!,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    collections[index] = updatedCollection;

    // Atomic write
    const tempFile = `${this.collectionsFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(collections, null, 2));
    await fs.rename(tempFile, this.collectionsFile);

    return updatedCollection;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const collections = await this.loadCollections();
    const filteredCollections = collections.filter((col) => col.id !== id);

    if (filteredCollections.length === collections.length) {
      return false; // Collection not found
    }

    // Atomic write
    const tempFile = `${this.collectionsFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(filteredCollections, null, 2));
    await fs.rename(tempFile, this.collectionsFile);

    return true;
  }

  async getCollection(id: string): Promise<StoredCollection | null> {
    const collections = await this.loadCollections();
    return collections.find((col) => col.id === id) || null;
  }
}
