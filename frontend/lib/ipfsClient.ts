// Frontend IPFS client (use only in server-side or secure contexts)
// Reads Infura credentials from env; avoid calling from the browser with secrets
// NOTE: ipfs-http-client package needs to be installed for this to work

export async function getIpfsClient(): Promise<any> {
  throw new Error('ipfs-http-client module not installed. Please install it with: npm install ipfs-http-client');
  // Uncomment below once ipfs-http-client is installed:
  // const { create } = await import('ipfs-http-client');
  // const apiUrl = process.env.NEXT_PUBLIC_IPFS_API_URL || 'https://ipfs.infura.io:5001';
  // const projectId = process.env.NEXT_PUBLIC_IPFS_PROJECT_ID || process.env.IPFS_PROJECT_ID || '';
  // const projectSecret = process.env.NEXT_PUBLIC_IPFS_PROJECT_SECRET || process.env.IPFS_PROJECT_SECRET || '';
  // const url = apiUrl.endsWith('/api/v0') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/api/v0`;
  //
  // if (projectId && projectSecret) {
  //   const auth = 'Basic ' + Buffer.from(`${projectId}:${projectSecret}`).toString('base64');
  //   return create({ url, headers: { authorization: auth } });
  // }
  // return create({ url });
}
