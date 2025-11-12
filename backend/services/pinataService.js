import axios from 'axios';

export async function pinJSON(metadata) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT missing');
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  const resp = await axios.post(url, metadata, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    timeout: 15000,
  });
  const ipfsHash = resp?.data?.IpfsHash || resp?.data?.cid;
  if (!ipfsHash) throw new Error('Pinata response missing IpfsHash');
  return ipfsHash;
}
