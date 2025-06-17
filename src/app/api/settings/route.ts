import { NextRequest, NextResponse } from 'next/server';
import { settingsManager } from '../../../lib/SettingsManager';
import { createErrorResponse } from '../../../lib/api-utils';

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await settingsManager.loadSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    return createErrorResponse(error, 'Failed to load settings');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate the entire settings object
    const validation = settingsManager.validateSettings(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid settings format',
          details: validation.errors?.issues,
        },
        { status: 400 }
      );
    }

    const success = await settingsManager.saveSettings(validation.data!);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      );
    }

    const updatedSettings = await settingsManager.loadSettings();
    return NextResponse.json({
      data: updatedSettings,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to update settings');
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const success = await settingsManager.updateSettings(body);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    const updatedSettings = await settingsManager.loadSettings();
    return NextResponse.json({
      data: updatedSettings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to update settings');
  }
}
