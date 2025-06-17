import { NextResponse } from 'next/server';
import { settingsManager } from '../../../../lib/SettingsManager';
import { createErrorResponse } from '../../../../lib/api-utils';

export async function GET(): Promise<NextResponse> {
  try {
    const backups = await settingsManager.listBackups();
    return NextResponse.json({ data: backups });
  } catch (error) {
    return createErrorResponse(error, 'Failed to list settings backups');
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const backupPath = await settingsManager.createBackup();

    if (!backupPath) {
      return NextResponse.json(
        { error: 'No settings file to backup' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { backupPath },
      message: 'Settings backup created successfully',
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to create settings backup');
  }
}
