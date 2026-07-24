import { NextResponse } from 'next/server';
import { z } from 'zod';

const RequestSchema = z.object({
  image: z.string().startsWith('data:image/').max(8_000_000),
  styleId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  customPrompt: z.string().max(280).nullable().optional(),
  email: z.string().email().or(z.literal('')),
  sessionId: z.string().min(8).max(100),
});

const blocked = ['nude','naked','sexual','gore'];

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    if (body.customPrompt && blocked.some(word => body.customPrompt!.toLowerCase().includes(word))) {
      return NextResponse.json({ error: 'Prompt rejected by safety filter.' }, { status: 400 });
    }

    // Mock adapter: returns the client-prepared exhibition render.
    // Replace this block with Replicate, Hugging Face, Workers AI, or a self-hosted adapter.
    await new Promise(resolve => setTimeout(resolve, 1800));
    const token = crypto.randomUUID().replaceAll('-', '');
    return NextResponse.json({
      status: 'complete',
      provider: process.env.AI_PROVIDER || 'mock',
      resultUrl: body.image,
      token,
      expiresInMinutes: Number(process.env.NEXT_PUBLIC_RESULT_TTL_MINUTES || 30),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}
