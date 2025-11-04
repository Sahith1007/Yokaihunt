import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const wallet = (req.headers['x-wallet-address'] as string) || undefined;
    if (wallet) headers['x-wallet-address'] = wallet;

    const upstream = await fetch(`${BASE_URL}/api/trainer/battleResult`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('content-type', contentType).send(text);
  } catch (err: any) {
    return res.status(500).json({ error: 'Upstream error', details: String(err?.message || err) });
  }
}