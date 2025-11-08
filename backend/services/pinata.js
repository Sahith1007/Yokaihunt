// backend/services/pinata.js
// Pinata IPFS service using pinata-web3

import { PinataSDK } from "pinata-web3";

let pinataClient = null;

/**
 * Get or initialize Pinata client
 */
function getPinataClient() {
  if (pinataClient) return pinataClient;
  
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('PINATA_JWT not set in environment');
  }
  
  pinataClient = new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: process.env.PINATA_GATEWAY || 'gateway.pinata.cloud'
  });
  
  return pinataClient;
}

/**
 * Upload image buffer to IPFS
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Optional filename
 * @returns {Promise<string>} IPFS CID
 */
export async function uploadImage(buffer, filename = 'image.png') {
  try {
    const pinata = getPinataClient();
    const result = await pinata.upload.file(buffer, {
      name: filename
    });
    return result.IpfsHash || result.cid;
  } catch (error) {
    console.error('Pinata image upload error:', error);
    throw new Error(`Failed to upload image to Pinata: ${error.message}`);
  }
}

/**
 * Upload JSON metadata to IPFS
 * @param {Object} metadata - Metadata object
 * @returns {Promise<string>} IPFS CID
 */
export async function uploadJSON(metadata) {
  try {
    const pinata = getPinataClient();
    const result = await pinata.upload.json(metadata);
    return result.IpfsHash || result.cid;
  } catch (error) {
    console.error('Pinata JSON upload error:', error);
    throw new Error(`Failed to upload JSON to Pinata: ${error.message}`);
  }
}

/**
 * Upload base64 image to IPFS
 * @param {string} base64 - Base64 encoded image (with or without data URL prefix)
 * @param {string} filename - Optional filename
 * @returns {Promise<string>} IPFS CID
 */
export async function uploadImageFromBase64(base64, filename = 'image.png') {
  try {
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(base64Data, 'base64');
    return await uploadImage(buffer, filename);
  } catch (error) {
    console.error('Pinata base64 upload error:', error);
    throw new Error(`Failed to upload base64 image: ${error.message}`);
  }
}

/**
 * Upload file from URL (fetches and uploads)
 * @param {string} url - Image URL
 * @returns {Promise<string>} IPFS CID
 */
export async function uploadImageFromURL(url) {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = url.split('/').pop() || 'image.png';
    return await uploadImage(buffer, filename);
  } catch (error) {
    console.error('Pinata image upload from URL error:', error);
    throw new Error(`Failed to upload image from URL: ${error.message}`);
  }
}

