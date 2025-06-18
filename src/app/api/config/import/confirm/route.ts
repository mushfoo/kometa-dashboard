import { NextResponse } from 'next/server';
import { ConfigService } from '@/lib/ConfigService';

// Import the same store from the parent route
// In a real app, this would be in a shared location like Redis
const importStore = new Map();

export async function POST() {
  try {
    // For now, we'll use the most recent import
    // In a production app, you'd pass the importId
    const imports = Array.from(importStore.entries()).sort(
      (a, b) => parseInt(b[0]) - parseInt(a[0])
    );

    if (imports.length === 0) {
      return NextResponse.json(
        { error: 'No pending import found. Please upload a file first.' },
        { status: 400 }
      );
    }

    const importEntry = imports[0];
    if (!importEntry) {
      return NextResponse.json(
        { error: 'No pending import found. Please upload a file first.' },
        { status: 400 }
      );
    }

    const [importId, config] = importEntry;

    // Create backup of current configuration
    const configService = new ConfigService();

    // Create backup before importing
    await configService.createBackup();

    // Import the new configuration
    await configService.updateConfig(config);

    // Clean up the temporary import
    importStore.delete(importId);

    return NextResponse.json({
      success: true,
      message:
        'Configuration imported successfully. A backup of your previous configuration has been created.',
    });
  } catch (error) {
    console.error('Failed to confirm import:', error);
    return NextResponse.json(
      {
        error: 'Failed to import configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
