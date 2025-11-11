import { PinataSDK } from "pinata-web3";

let client = null;
export function pinata() {
  if (client) return client;
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT missing');
  client = new PinataSDK({ pinataJwt: jwt, pinataGateway: process.env.PINATA_GATEWAY || 'gateway.pinata.cloud' });
  return client;
}

export async function pinJSON(metadata) {
  const r = await pinata().upload.json(metadata);
  return r.IpfsHash || r.cid;
}
