import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const Schema = z.object({
  email: z.string().email(),
  image: z.string().startsWith('data:image/').max(8_000_000),
  exhibition: z.string().max(120),
});

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    if (!process.env.RESEND_API_KEY) {
      if (process.env.DEMO_MODE === 'true') return NextResponse.json({ delivered: true, demo: true });
      return NextResponse.json({ error: 'Email provider is not configured.' }, { status: 503 });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const base64 = body.image.split(',')[1];
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Portrait Exhibition <onboarding@resend.dev>',
      to: body.email,
      subject: `Your AI portrait from ${body.exhibition}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>Your portrait is ready ✨</h1><p>Thank you for visiting ${body.exhibition}. Your generated image is attached.</p><p style="color:#667085;font-size:13px">This portrait was created with your explicit consent. Temporary exhibition files are deleted according to the organiser's privacy settings.</p></div>`,
      attachments: [{ filename: 'ai-exhibition-portrait.jpg', content: base64 }],
    });
    return NextResponse.json({ delivered: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Delivery failed' }, { status: 400 });
  }
}
