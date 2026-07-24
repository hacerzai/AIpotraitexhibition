# AI Portrait Exhibition

A portrait-first AI photo booth for exhibitions, built with Next.js, TypeScript, browser camera APIs and Replicate.

## Features

- Guided email, style, camera, review, processing and result flow
- Touch-friendly portrait interface with responsive exhibition layout
- Camera lifecycle cleanup, countdown, retake and image compression
- Real AI portrait editing through Replicate
- QR delivery, download, email-ready API and inactivity reset
- Protected admin page for exhibition configuration and service tests
- Privacy-first temporary session handling and prompt moderation

## AI model

The app uses the official `black-forest-labs/flux-kontext-pro` model on Replicate. It is well suited to portrait transformations because it edits an input photo through natural-language instructions while retaining the subject's identity and original framing.

The server builds guarded prompts for every preset and explicitly requests preservation of facial identity, age, skin tone, hairstyle, expression and pose.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Add your Replicate token to `.env.local`:

```env
AI_PROVIDER=replicate
DEMO_MODE=false
REPLICATE_API_TOKEN=r8_your_token_here
```

Never place the real token in source code or in a variable beginning with `NEXT_PUBLIC_`.

## Replicate behavior

`POST /api/generate` now:

1. Validates and moderates the visitor request.
2. Builds the selected style, template or custom transformation prompt.
3. Sends the captured data-URI image to FLUX Kontext Pro.
4. Waits for the prediction and polls when necessary.
5. Returns the final Replicate image URL and prediction ID.
6. Falls back to the input image only when `DEMO_MODE=true` and no token is configured.

The route uses a 120-second server duration allowance. On Vercel, use a plan and deployment configuration that permits the required function duration.

## Environment

See `.env.example`. Never expose provider or email secrets using `NEXT_PUBLIC_` variables.

For Vercel, add `REPLICATE_API_TOKEN` under **Project Settings → Environment Variables**, then redeploy. For another Node-compatible host, configure the same server-side environment variable there.

## Deployment

Deploy to Vercel or any Node-compatible Next.js host. Camera access requires HTTPS outside localhost. For production, use object storage such as Cloudflare R2, Vercel Blob or S3 if you need durable result links, and use Redis or Durable Objects for queues and rate limits.

## Admin

Open `/admin` and enter `ADMIN_PASSWORD`. The starter admin stores settings in browser storage for demonstration. Production deployments should persist configuration in a protected database.
