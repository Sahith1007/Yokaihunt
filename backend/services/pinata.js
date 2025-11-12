// backend/services/pinata.js
// IPFS helpers (no SDK dependency)

import { create } from 'ipfs-http-client';
import axios from 'axios';

function getIpfsClient() {
  const projectId = process.env.IPFS_PROJECT_ID;
  const projectSecret = process.env.IPFS_PROJECT_SECRET;
  if (projectId && projectSecret) {
    const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');
    return create({
      host: process.env.IPFS_HOST || 'ipfs.infura.io',
      port: Number(process.env.IPFS_PORT || 5001),
      protocol: process.env.IPFS_PROTOCOL || 'https',
      headers: { authorization: auth },
    });
  }
  return create({ url: process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001/api/v0' });
}

/**
 * Upload image buffer to IPFS via ipfs-http-client
 */
export async function uploadImage(buffer, filename = 'image.png') {
  try {
    const client = getIpfsClient();
    const { cid } = await client.add(buffer, { pin: true });
    return cid.toString();
  } catch (error) {
    console.error('IPFS image upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Upload JSON metadata to IPFS (Pinata preferred for pinning)
 */
export async function uploadJSON(metadata) {
  const jwt = process.env.PINATA_JWT;
  if (jwt) {
    // Use Pinata JSON pin endpoint if JWT is configured
    const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
    const resp = await axios.post(url, metadata, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      timeout: 15000,
    });
    const ipfsHash = resp?.data?.IpfsHash || resp?.data?.cid;
    if (!ipfsHash) throw new Error('Pinata response missing IpfsHash');
    return ipfsHash;
  }
  // Fallback to direct IPFS
  const client = getIpfsClient();
  const { cid } = await client.add(JSON.stringify(metadata), { pin: true });
  return cid.toString();
}

/**
 * Upload base64 image to IPFS
 */
export async function uploadImageFromBase64(base64, filename = 'image.png') {
  try {
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(base64Data, 'base64');
    return await uploadImage(buffer, filename);
  } catch (error) {
    console.error('IPFS base64 upload error:', error);
    throw new Error(`Failed to upload base64 image: ${error.message}`);
  }
}

/**
 * Upload file from URL (fetches and uploads)
 */
export async function uploadImageFromURL(url) {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return await uploadImage(buffer);
  } catch (error) {
    console.error('IPFS image upload from URL error:', error);
    throw new Error(`Failed to upload image from URL: ${error.message}`);
  }
}

