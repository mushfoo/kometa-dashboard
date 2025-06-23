import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

// Request schema for creating collections
const CreateCollectionRequest = z.object({
  name: z.string().min(1, 'Collection name is required'),
  description: z.string().optional(),
  type: z.enum(['smart', 'manual']),
  library: z.string().min(1, 'Library is required'),
  filters: z.any().optional(),
  poster: z.string().url().optional().or(z.literal('')),
  sort_order: z
    .enum([
      'alpha',
      'release',
      'critic_rating',
      'audience_rating',
      'added',
      'random',
    ])
    .optional(),
  visible_library: z.boolean().optional(),
  visible_home: z.boolean().optional(),
  visible_shared: z.boolean().optional(),
  collection_mode: z.enum(['default', 'hide', 'hide_items']).optional(),
});

async function loadConfig() {
  const configPath = path.join(process.cwd(), 'storage', 'config.yml');
  const configData = await fs.readFile(configPath, 'utf-8');
  return yaml.load(configData) as any;
}

async function saveConfig(config: any) {
  const configPath = path.join(process.cwd(), 'storage', 'config.yml');
  const tempPath = `${configPath}.tmp`;

  // Create backup
  const backupPath = path.join(
    process.cwd(),
    'storage',
    `config-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.yml`
  );
  await fs.copyFile(configPath, backupPath);

  // Save new config atomically
  await fs.writeFile(
    tempPath,
    yaml.dump(config, {
      lineWidth: -1,
      noRefs: true,
    })
  );
  await fs.rename(tempPath, configPath);
}

function processFilters(filters: any): any {
  const processed: any = {};

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Convert nested objects to dot notation (e.g., year: {gte: 1999} -> year.gte: 1999)
      for (const [subKey, subValue] of Object.entries(value)) {
        processed[`${key}.${subKey}`] = subValue;
      }
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const config = await loadConfig();
    const allCollections: any[] = [];

    // Extract collections from all libraries (both inline and external files)
    if (config.libraries) {
      for (const [libraryName, library] of Object.entries(config.libraries)) {
        const lib = library as any;

        // Check inline collections (deprecated but still supported)
        if (lib.collections && Array.isArray(lib.collections)) {
          lib.collections.forEach((collection: any) => {
            const collectionName = Object.keys(collection)[0];
            allCollections.push({
              name: collectionName,
              ...collection[collectionName],
              library: libraryName,
              id: `${libraryName}-${collectionName}`,
              source: 'inline',
            });
          });
        }

        // Check external collection files
        if (lib.collection_files && Array.isArray(lib.collection_files)) {
          for (const fileRef of lib.collection_files) {
            try {
              const filePath = path.join(
                process.cwd(),
                'storage',
                fileRef.file.replace('config/', '')
              );
              const fileData = await fs.readFile(filePath, 'utf-8');
              const fileContent = yaml.load(fileData) as any;

              if (fileContent.collections) {
                Object.entries(fileContent.collections).forEach(
                  ([collectionName, collectionData]: [string, any]) => {
                    allCollections.push({
                      name: collectionName,
                      ...collectionData,
                      library: libraryName,
                      id: `${libraryName}-${collectionName}`,
                      source: 'file',
                      sourceFile: fileRef.file,
                    });
                  }
                );
              }
            } catch (error) {
              console.warn(
                `Failed to read collection file ${fileRef.file}:`,
                error
              );
            }
          }
        }
      }
    }

    logApiRequest(request, startTime);
    return NextResponse.json({
      collections: allCollections,
      total: allCollections.length,
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to get collections');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate request
    const parseResult = CreateCollectionRequest.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid collection data',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const config = await loadConfig();

    // Ensure the library exists
    if (!config.libraries || !config.libraries[data.library]) {
      return NextResponse.json(
        { error: `Library "${data.library}" not found` },
        { status: 400 }
      );
    }

    // Ensure collection_files array exists for the library
    if (!config.libraries[data.library].collection_files) {
      config.libraries[data.library].collection_files = [];
    }

    // Create the collection object in Kometa format
    const collectionContent: any = {
      collections: {
        [data.name]: {},
      },
    };

    // Add basic properties
    if (data.description) {
      collectionContent.collections[data.name].summary = data.description;
    }
    if (data.poster) {
      collectionContent.collections[data.name].poster = data.poster;
    }
    if (data.sort_order) {
      collectionContent.collections[data.name].sort_title = data.sort_order;
    }
    if (data.collection_mode && data.collection_mode !== 'default') {
      collectionContent.collections[data.name].collection_mode =
        data.collection_mode;
    }

    // Add visibility settings
    if (data.visible_library !== undefined) {
      collectionContent.collections[data.name].visible_library =
        data.visible_library;
    }
    if (data.visible_home !== undefined) {
      collectionContent.collections[data.name].visible_home = data.visible_home;
    }
    if (data.visible_shared !== undefined) {
      collectionContent.collections[data.name].visible_shared =
        data.visible_shared;
    }

    // Add filters for smart collections
    if (data.type === 'smart' && data.filters) {
      // Convert nested filter objects to Kometa's dot notation
      const processedFilters = processFilters(data.filters);
      Object.assign(collectionContent.collections[data.name], processedFilters);
    }

    // Create filename (sanitize collection name)
    const sanitizedName = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const fileName = `${sanitizedName}.yml`;
    const filePath = path.join(
      process.cwd(),
      'storage',
      'collections',
      fileName
    );

    // Ensure collections directory exists
    const collectionsDir = path.join(process.cwd(), 'storage', 'collections');
    await fs.mkdir(collectionsDir, { recursive: true });

    // Save the collection file
    await fs.writeFile(
      filePath,
      yaml.dump(collectionContent, {
        lineWidth: -1,
        noRefs: true,
      })
    );

    // Add reference to the collection file in config
    const fileReference = { file: `config/collections/${fileName}` };
    config.libraries[data.library].collection_files.push(fileReference);

    // Save the updated config
    await saveConfig(config);

    logApiRequest(request, startTime);
    return NextResponse.json(
      {
        collection: {
          name: data.name,
          library: data.library,
          type: data.type,
          id: `${data.library}-${data.name}`,
        },
        message: 'Collection created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return createErrorResponse(error, 'Failed to create collection');
  }
}
