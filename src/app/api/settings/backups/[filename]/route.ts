import { NextRequest, NextResponse } from 'next/server';
import { settingsManager } from '../../../../../lib/SettingsManager';
import { createErrorResponse } from '../../../../../lib/api-utils';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { filename } = params;

    if (!filename) {
      return NextResponse.json(
        { error: 'Backup filename is required' },
        { status: 400 }
      );
    }

    const success = await settingsManager.restoreFromBackup(filename);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to restore from backup' },
        { status: 500 }
      );
    }

    const restoredSettings = await settingsManager.loadSettings();
    return NextResponse.json({
      data: restoredSettings,
      message: `Settings restored from backup: ${filename}`,
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to restore settings from backup');
  }
}
