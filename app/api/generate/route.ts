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
  anime: 'Transform this portrait into polished cinematic anime character art with expressive but recognizable facial features, clean linework and dramatic soft lighting.',
  comic: 'Transform this portrait into premium comic-book cover art with bold ink, controlled halftone texture, vibrant color and cinematic heroic lighting.',
  cyberpunk: 'Transform this portrait into a cinematic cyberpunk character with tasteful futuristic clothing, neon city lights, blue and magenta rim lighting and atmospheric haze.',
  royal: 'Transform this portrait into a majestic royal oil painting with refined ceremonial clothing, an elegant palace setting and museum-quality lighting.',
  watercolour: 'Transform this portrait into a refined watercolor illustration with expressive pigment, soft paper texture, delicate edges and luminous natural color.',
  oil: 'Transform this portrait into a classical gallery-quality oil painting with rich brushwork, refined chiaroscuro, realistic anatomy and timeless composition.',
  '3d': 'Transform this portrait into a premium stylized 3D animated-film character with appealing materials, natural facial proportions and soft cinematic lighting.',
  scifi: 'Transform this portrait into an epic science-fiction explorer with an original advanced suit, futuristic environment and cinematic atmospheric lighting.',
  fantasy: 'Transform this portrait into a legendary fantasy warrior with elegant original armor, a magical environment and sophisticated cinematic lighting.',
  vintage: 'Transform this portrait into a timeless analogue-cinema portrait with tasteful vintage wardrobe, natural film grain, rich tonal contrast and classic lighting.',
  pencil: 'Transform this portrait into a highly detailed graphite pencil drawing on clean fine-art paper with realistic shading and precise facial structure.',
  pop: 'Transform this portrait into bold neon pop art with vibrant graphic shapes, crisp facial identity, gallery composition and energetic exhibition lighting.',
};

const templatePrompts: Record<string, string> = {
  magazine: 'Create a premium fashion magazine cover-style portrait. Preserve the person while upgrading the lighting, styling and editorial background. Do not add words, letters, logos or watermarks.',
  movie: 'Create a cinematic blockbuster-poster portrait with dramatic lighting, rich color grading and atmospheric depth. Do not add titles, words, logos or watermarks.',
  superhero: 'Create an original non-branded superhero collectible portrait with a unique tasteful suit, heroic presence, dramatic lighting and no text or logos.',
  'future-id': 'Create a sleek futuristic identity-card style portrait with holographic interface accents and a clean high-tech composition. Do not add readable personal data, words or logos.',
  space: 'Create a heroic space-explorer mission portrait with a realistic original astronaut suit, stars, spacecraft ambience and cinematic light.',
  graduate: 'Create a premium graduation portrait with an academic gown, celebratory but refined studio lighting and a polished keepsake composition.',
  champion: 'Create a powerful sports-champion portrait with an original athletic outfit, stadium lighting and an uplifting victory atmosphere. Do not add team logos or text.',
  leader: 'Create a dignified historical-leader portrait with respectful period clothing, formal composition, realistic painterly detail and museum lighting.',
  festival: 'Create an elegant family-friendly festival greeting portrait with warm decorative lights, celebratory ambience and refined color. Do not add text or logos.',
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
