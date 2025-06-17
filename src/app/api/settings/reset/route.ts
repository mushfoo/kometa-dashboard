import { NextRequest, NextResponse } from 'next/server';
import { settingsManager } from '../../../../lib/SettingsManager';
import {
  handleApiError,
  validateRequestMethod,
} from '../../../../lib/api-utils';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, 'POST');

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
    return handleApiError(error, 'Failed to reset settings');
  }
}
