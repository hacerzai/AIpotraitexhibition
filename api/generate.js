module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).end(JSON.stringify({ error: 'Use POST' }));
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).end(JSON.stringify({
      error: 'Replicate token is missing. Add REPLICATE_API_TOKEN in Vercel Environment Variables and redeploy.'
    }));
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { image, prompt } = body;

    if (!image || !prompt) {
      return res.status(400).end(JSON.stringify({ error: 'Image and prompt are required.' }));
    }

    const create = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
      {
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
      }
    );

    const createText = await create.text();
    let prediction;
    try {
      prediction = createText ? JSON.parse(createText) : {};
    } catch {
      throw new Error(`Replicate returned an invalid response (${create.status}).`);
    }

    if (!create.ok) {
      const detail = prediction?.detail;
      const message = Array.isArray(detail)
        ? detail.map(item => item.msg || JSON.stringify(item)).join(', ')
        : detail || prediction?.error || `Replicate request failed (${create.status})`;
      throw new Error(message);
    }

    let checks = 0;
    while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && checks < 50) {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const poll = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const pollText = await poll.text();
      try {
        prediction = pollText ? JSON.parse(pollText) : {};
      } catch {
        throw new Error(`Replicate polling returned an invalid response (${poll.status}).`);
      }

      if (!poll.ok) {
        throw new Error(prediction?.detail || prediction?.error || `Polling failed (${poll.status})`);
      }
      checks++;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(prediction.error || 'Generation timed out or failed. Please try again.');
    }

    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!url) throw new Error('Replicate returned no image URL.');

    return res.status(200).end(JSON.stringify({ url }));
  } catch (error) {
    console.error('Portrait generation error:', error);
    return res.status(500).end(JSON.stringify({
      error: error && error.message ? error.message : 'Generation failed'
    }));
  }
};