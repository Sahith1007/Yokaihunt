// Centralized IPFS client for the backend (ESM)
// Reads Infura credentials from environment and returns a connected client
// Usage: import { getIpfsClient } from './ipfs/ipfsClient.js'

import { create } from 'ipfs-http-client';

export function getIpfsClient() {
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