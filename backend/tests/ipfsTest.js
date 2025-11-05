// Simple end-to-end test of IPFS trainer backup/restore routes
// Run with: node backend/tests/ipfsTest.js

import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_BACKEND_URL || 'http://localhost:4000/api/trainer';
const testWallet = process.env.TEST_WALLET || 'TEST_WALLET_ADDRESS';

async function runTests() {
  console.log('=== Testing Trainer Backup to IPFS ===');
  const backupRes = await fetch(`${BASE_URL}/backup`, {
    method: 'POST',
    headers: { 'x-wallet-address': testWallet, 'content-type': 'application/json' },
    body: JSON.stringify({ walletAddress: testWallet })
  });
  const backupData = await backupRes.json();
  console.log('Backup Response:', backupData);

  console.log('=== Verifying Restore from IPFS ===');
  const restoreRes = await fetch(`${BASE_URL}/restore/${encodeURIComponent(testWallet)}`, {
    headers: { 'x-wallet-address': testWallet }
  });
  const restoreData = await restoreRes.json();
  console.log('Restore Response:', restoreData);

  console.log('=== Fetching Raw IPFS File ===');
  const cid = backupData.cid || backupData.ipfsHash;
  if (!cid) {
    console.error('No CID from backup response');
    process.exit(1);
  }
  const ipfsRes = await fetch(`${BASE_URL}/ipfs/${cid}`);
  const ipfsJson = await ipfsRes.json();
  console.log('IPFS JSON:', ipfsJson);
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});