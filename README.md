# AI Portrait Exhibition

A portrait-first AI photo booth for exhibitions, built with Next.js, TypeScript and browser camera APIs.

## Features

- Guided email, style, camera, review, processing and result flow
- Touch-friendly portrait interface with responsive exhibition layout
- Camera lifecycle cleanup, countdown, retake and image compression
- Replaceable AI provider architecture with a built-in mock provider
- QR delivery, download, email-ready API and inactivity reset
- Protected admin page for exhibition configuration and service tests
- Privacy-first temporary session handling and prompt moderation

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The project runs immediately in mock mode. Connect a real AI provider by implementing an adapter in `lib/providers.ts` and setting `AI_PROVIDER`.

## Environment

See `.env.example`. Never expose provider or email secrets using `NEXT_PUBLIC_` variables.

## Deployment

Deploy to Vercel or any Node-compatible Next.js host. Camera access requires HTTPS outside localhost. For production, replace the in-memory result store with object storage such as Cloudflare R2, Vercel Blob or S3, and use Redis/Durable Objects for queues and rate limits.

## Admin

Open `/admin` and enter `ADMIN_PASSWORD`. The starter admin stores settings in browser storage for demonstration. Production deployments should persist configuration in a protected database.
