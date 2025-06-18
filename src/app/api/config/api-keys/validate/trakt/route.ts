import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const traktValidationSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  pin: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, client_secret } = traktValidationSchema.parse(body);

    // For Trakt, we can't directly validate without OAuth flow
    // But we can check if the format looks valid
    if (client_id.length < 20 || client_secret.length < 20) {
      return NextResponse.json({
        service: 'trakt',
        valid: false,
        message:
          'Client ID and Secret appear to be invalid. They should be at least 20 characters long.',
      });
    }

    // Check if they look like hex strings (common format for Trakt)
    const hexPattern = /^[a-f0-9]+$/i;
    if (!hexPattern.test(client_id) || !hexPattern.test(client_secret)) {
      return NextResponse.json({
        service: 'trakt',
        valid: false,
        message:
          'Client ID and Secret should only contain hexadecimal characters (0-9, a-f).',
      });
    }

    return NextResponse.json({
      service: 'trakt',
      valid: true,
      message:
        'Trakt credentials format appears valid. Full validation requires OAuth authentication.',
    });
  } catch (error) {
    console.error('Trakt validation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        service: 'trakt',
        valid: false,
        message: 'Invalid credentials format',
      });
    }

    return NextResponse.json({
      service: 'trakt',
      valid: false,
      message: 'Failed to validate Trakt credentials.',
    });
  }
}
