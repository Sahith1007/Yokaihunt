// Frontend IPFS client (use only in server-side or secure contexts)
// Reads Infura credentials from env; avoid calling from the browser with secrets

export async function getIpfsClient() {
  const { create } = await import('ipfs-http-client');
  const apiUrl = process.env.NEXT_PUBLIC_IPFS_API_URL || 'https://ipfs.infura.io:5001';
  const projectId = process.env.NEXT_PUBLIC_IPFS_PROJECT_ID || process.env.IPFS_PROJECT_ID || '';
  const projectSecret = process.env.NEXT_PUBLIC_IPFS_PROJECT_SECRET || process.env.IPFS_PROJECT_SECRET || '';
  const url = apiUrl.endsWith('/api/v0') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/api/v0`;

  if (projectId && projectSecret) {
    const auth = 'Basic ' + Buffer.from(`${projectId}:${projectSecret}`).toString('base64');
    return create({ url, headers: { authorization: auth } });
  }
  return create({ url });
}