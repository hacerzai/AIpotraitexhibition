import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL_OWNER = 'black-forest-labs';
const MODEL_NAME = 'flux-kontext-pro';
const REPLICATE_API = 'https://api.replicate.com/v1';

const RequestSchema = z.object({
  image: z.string().startsWith('data:image/').max(8_000_000),
  styleId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  customPrompt: z.string().max(280).nullable().optional(),
  email: z.string().email().or(z.literal('')),
  sessionId: z.string().min(8).max(100),
});

const blocked = ['nude', 'naked', 'sexual', 'gore'];

const stylePrompts: Record<string, string> = {
  cyberpunk: 'Transform this portrait into a cinematic cyberpunk character with tasteful futuristic clothing, neon city lights, blue and magenta rim lighting, atmospheric haze and premium editorial detail.',
  renaissance: 'Transform this portrait into an elegant Renaissance oil painting with museum-quality brushwork, warm chiaroscuro lighting, rich fabrics and a timeless formal composition.',
  watercolor: 'Transform this portrait into a refined watercolor illustration with expressive pigment, soft paper texture, delicate edges and luminous natural color.',
  anime: 'Transform this portrait into a polished cinematic anime character while keeping the face immediately recognizable, with expressive eyes, clean linework and dramatic lighting.',
  royal: 'Transform this portrait into a majestic royal portrait with refined ceremonial clothing, an elegant palace setting, cinematic light and premium editorial detail.',
  astronaut: 'Transform this portrait into a heroic astronaut portrait inside a futuristic spacecraft, with realistic suit materials, soft cosmic light and cinematic depth.',
  superhero: 'Transform this portrait into an original heroic comic-book character with a unique non-branded suit, dramatic lighting and a cinematic city backdrop.',
  fantasy: 'Transform this portrait into a cinematic fantasy character in an enchanted world with intricate clothing, magical atmosphere and sophisticated lighting.',
};

const templatePrompts: Record<string, string> = {
  magazine: 'Create a premium fashion magazine cover portrait. Preserve the person exactly while upgrading the lighting, styling and background. Do not add logos, words, letters or watermarks.',
  yearbook: 'Create a clean modern yearbook-style studio portrait with flattering soft light, a tasteful neutral background and natural realistic detail.',
  film: 'Create a cinematic movie-poster portrait with dramatic lighting, rich color grading and atmospheric depth. Do not add text, logos, titles or watermarks.',
  museum: 'Create a gallery-quality fine-art portrait suitable for a museum exhibition, with refined composition, sophisticated lighting and beautiful material detail.',
};

function buildPrompt(styleId?: string | null, templateId?: string | null, customPrompt?: string | null) {
  const transformation = customPrompt?.trim()
    ? `Transform this portrait according to this creative direction: ${customPrompt.trim()}`
    : styleId && stylePrompts[styleId]
      ? stylePrompts[styleId]
      : templateId && templatePrompts[templateId]
        ? templatePrompts[templateId]
        : 'Transform this into a polished, exhibition-quality creative portrait with cinematic lighting and refined detail.';

  return `${transformation}

Critical requirements:
- Preserve the same person's facial identity, age, skin tone, facial structure, hairstyle and expression.
- Keep one person only and retain the original pose and framing.
- Produce a tasteful, family-friendly, high-quality portrait.
- Keep eyes, teeth, hands and facial anatomy natural and coherent.
- Do not add text, logos, signatures, borders or watermarks.`;
}

type ReplicatePrediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
};

function getOutputUrl(output: ReplicatePrediction['output']) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

async function replicateFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
}

async function runReplicate(image: string, prompt: string, token: string) {
  const createResponse = await replicateFetch(
    `${REPLICATE_API}/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`,
    token,
    {
      method: 'POST',
      headers: { Prefer: 'wait=60' },
      body: JSON.stringify({
        input: {
          prompt,
          input_image: image,
          aspect_ratio: 'match_input_image',
          output_format: 'jpg',
          safety_tolerance: 2,
          prompt_upsampling: false,
        },
      }),
    },
  );

  if (!createResponse.ok) {
    const detail = await createResponse.text();
    throw new Error(`Replicate request failed (${createResponse.status}): ${detail.slice(0, 300)}`);
  }

  let prediction = (await createResponse.json()) as ReplicatePrediction;

  for (let attempt = 0; attempt < 24 && ['starting', 'processing'].includes(prediction.status); attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const statusUrl = prediction.urls?.get || `${REPLICATE_API}/predictions/${prediction.id}`;
    const statusResponse = await replicateFetch(statusUrl, token);
    if (!statusResponse.ok) throw new Error(`Could not read Replicate prediction status (${statusResponse.status}).`);
    prediction = (await statusResponse.json()) as ReplicatePrediction;
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(prediction.error || `Replicate generation ended with status: ${prediction.status}`);
  }

  const resultUrl = getOutputUrl(prediction.output);
  if (!resultUrl) throw new Error('Replicate returned no image URL.');
  return { resultUrl, predictionId: prediction.id };
}

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    if (body.customPrompt && blocked.some(word => body.customPrompt!.toLowerCase().includes(word))) {
      return NextResponse.json({ error: 'Prompt rejected by safety filter.' }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    const demoMode = process.env.DEMO_MODE === 'true';

    if (!token) {
      if (demoMode) {
        return NextResponse.json({
          status: 'complete',
          provider: 'mock',
          resultUrl: body.image,
          token: crypto.randomUUID().replaceAll('-', ''),
          expiresInMinutes: Number(process.env.NEXT_PUBLIC_RESULT_TTL_MINUTES || 30),
        });
      }
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN is not configured on the server.' }, { status: 503 });
    }

    const prompt = buildPrompt(body.styleId, body.templateId, body.customPrompt);
    const generated = await runReplicate(body.image, prompt, token);

    return NextResponse.json({
      status: 'complete',
      provider: 'replicate',
      model: `${MODEL_OWNER}/${MODEL_NAME}`,
      predictionId: generated.predictionId,
      resultUrl: generated.resultUrl,
      token: crypto.randomUUID().replaceAll('-', ''),
      expiresInMinutes: Number(process.env.NEXT_PUBLIC_RESULT_TTL_MINUTES || 30),
    });
  } catch (error) {
    console.error('Portrait generation failed:', error);
    const message = error instanceof Error ? error.message : 'Invalid request';
    const status = error instanceof z.ZodError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
