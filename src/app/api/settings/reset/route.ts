import { NextResponse } from 'next/server';
import { settingsManager } from '../../../../lib/SettingsManager';
import { createErrorResponse } from '../../../../lib/api-utils';

export async function POST(): Promise<NextResponse> {
  try {
    const success = await settingsManager.resetToDefaults();

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to reset settings' },
        { status: 500 }
      );
    }

    const defaultSettings = await settingsManager.loadSettings();
    return NextResponse.json({
      data: defaultSettings,
      message: 'Settings reset to defaults successfully',
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to reset settings');
  }
}
