// Centralized IPFS client for the backend (ESM)
// - Supports Infura (ipfs-http-client) and Pinata (HTTP API)
// - Exposes a minimal interface: add(jsonLike) -> { cid: { toString() } }, cat(cid) -> AsyncIterable<Buffer>
// Usage: import { getIpfsClient } from './ipfs/ipfsClient.js'

import { create } from 'ipfs-http-client';
import fetch from 'node-fetch';

function pinataClient() {
  const jwt = process.env.PINATA_JWT || '';
  const apiKey = process.env.PINATA_API_KEY || '';
  const apiSecret = process.env.PINATA_API_SECRET || '';
  const base = process.env.PINATA_BASE_URL || 'https://api.pinata.cloud';
  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

  function authHeaders() {
    if (jwt) return { authorization: `Bearer ${jwt}` };
    if (apiKey && apiSecret) return { pinata_api_key: apiKey, pinata_secret_api_key: apiSecret };
    throw new Error('Missing Pinata credentials: set PINATA_JWT or PINATA_API_KEY and PINATA_API_SECRET');
  }

  return {
    // Pins a JSON object to Pinata; accepts a JSON string or object
    async add(content /*, opts */) {
      let bodyObj;
      try {
        bodyObj = typeof content === 'string' ? JSON.parse(content) : content;
      } catch {
        // Fallback: wrap as text field
        bodyObj = { _raw: String(content) };
      }
      const url = `${base.replace(/\/$/, '')}/pinning/pinJSONToIPFS`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ pinataContent: bodyObj })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Pinata add failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      const hash = data.IpfsHash || data.cid || data.hash;
      return { cid: { toString: () => hash } };
    },

    // Returns async iterable Buffer for content by CID using Pinata gateway
    cat(cid) {
      const url = `${gateway.replace(/\/$/, '')}/${cid}`;
      async function* gen() {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Pinata cat failed: ${res.status}`);
        const ab = await res.arrayBuffer();
        yield Buffer.from(ab);
      }
      return gen();
    }
  };
}

export function getIpfsClient() {
  const provider = (process.env.IPFS_PROVIDER || 'infura').toLowerCase();
  if (provider === 'pinata') {
    return pinataClient();
  }

  const apiUrl = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001';
  const projectId = process.env.IPFS_PROJECT_ID || '';
  const projectSecret = process.env.IPFS_PROJECT_SECRET || '';

  // Support both URL form and host/port form
  const url = apiUrl.endsWith('/api/v0') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/api/v0`;

  if (projectId && projectSecret) {
    const auth = 'Basic ' + Buffer.from(`${projectId}:${projectSecret}`).toString('base64');
    return create({ url, headers: { authorization: auth } });
  }

  // Anonymous client (may be rate-limited)
  return create({ url });
}
