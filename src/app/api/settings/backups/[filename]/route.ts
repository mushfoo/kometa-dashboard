import { NextRequest, NextResponse } from 'next/server';
import { settingsManager } from '../../../../../lib/SettingsManager';
import { createErrorResponse } from '../../../../../lib/api-utils';

interface RouteParams {
  params: {
    filename: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
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
