import { NextResponse } from 'next/server';
import { z } from 'zod';

const Schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    const { password } = Schema.parse(await request.json());
    const expected = process.env.ADMIN_PASSWORD || 'change-me';
    if (password !== expected) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
