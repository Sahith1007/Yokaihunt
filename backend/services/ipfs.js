import { create } from 'ipfs-http-client';

async function getNftClient() {
  try {
    const token = process.env.NFT_STORAGE_TOKEN;
    if (!token) return null;
    // Dynamic import to avoid hard dependency
    const mod = await import('nft.storage');
    const { NFTStorage } = mod;
    return new NFTStorage({ token });
  } catch {
    return null;
  }
}

export async function uploadJsonToIPFS(json) {
  const asString = typeof json === 'string' ? json : JSON.stringify(json);

  // Prefer NFT.Storage if available
  try {
    const nftClient = await getNftClient();
    if (nftClient) {
      const cid = await nftClient.storeBlob(new Blob([asString], { type: 'application/json' }));
      return { cid: cid.toString() };
    }
  } catch {}

  // Fallback to public IPFS client
  const projectId = process.env.IPFS_PROJECT_ID;
  const projectSecret = process.env.IPFS_PROJECT_SECRET;
  let client;
  if (projectId && projectSecret) {
    const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');
    client = create({
      host: process.env.IPFS_HOST || 'ipfs.infura.io',
      port: Number(process.env.IPFS_PORT || 5001),
      protocol: process.env.IPFS_PROTOCOL || 'https',
      headers: { authorization: auth },
    });
  } else {
    client = create({ url: process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001/api/v0' });
  }
  const result = await client.add(asString, { pin: true });
  return { cid: result.cid.toString() };
}
