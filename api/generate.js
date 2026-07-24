export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN in Vercel settings.' });

  try {
    const { image, prompt } = req.body || {};
    if (!image || !prompt) return res.status(400).json({ error: 'Image and prompt are required.' });

    const create = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=60'
      },
      body: JSON.stringify({
        input: {
          input_image: image,
          prompt,
          aspect_ratio: '3:4',
          output_format: 'webp',
          safety_tolerance: 2
        }
      })
    });

    let prediction = await create.json();
    if (!create.ok) throw new Error(prediction?.detail || prediction?.error || 'Replicate request failed');

    let checks = 0;
    while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && checks < 40) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const poll = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${token}` }
      });
      prediction = await poll.json();
      checks++;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(prediction.error || 'Generation did not finish. Please try again.');
    }

    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!url) throw new Error('Replicate returned no image.');

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Generation failed' });
  }
}
