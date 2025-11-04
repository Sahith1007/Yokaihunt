import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { wallet } = req.query;
    const walletStr = Array.isArray(wallet) ? wallet[0] : wallet;
    if (!walletStr) return res.status(400).json({ error: 'Missing wallet' });

    const headers: Record<string, string> = {};
    const walletHdr = (req.headers['x-wallet-address'] as string) || undefined;
    if (walletHdr) headers['x-wallet-address'] = walletHdr;

    const upstream = await fetch(`${BASE_URL}/api/trainer/load/${encodeURIComponent(walletStr)}`, {
      method: 'GET',
      headers,
      cache: 'no-store' as any,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('content-type', contentType).send(text);
  } catch (err: any) {
    return res.status(500).json({ error: 'Upstream error', details: String(err?.message || err) });
  }
}