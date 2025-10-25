// Quick test for working endpoints
// Run this in a separate terminal while server is running

console.log('🧪 Testing YokaiHunt API...\n');

// Optional polyfill for environments where fetch may not exist
const ensureFetch = async () => {
  if (typeof fetch === 'function') return fetch;
  const { default: nf } = await import('node-fetch');
  globalThis.fetch = nf;
  return nf;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withTimeout = (ms) => ({ signal: AbortSignal.timeout(ms) });

const waitForServer = async (baseUrl, attempts = 10, delayMs = 300) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`, withTimeout(1500));
      if (res.ok) return true;
    } catch (_) {}
    await sleep(delayMs);
  }
  return false;
};

const testEndpoint = async (url, name) => {
  try {
    const response = await fetch(url, withTimeout(4000));
    const data = await response.json().catch(() => ({}));
    const ok = response.status === 200;
    console.log(`${ok ? '✅' : '❌'} ${name}:`, ok ? 'Working' : `Error (${response.status})`);
    if (!ok) console.log('   Response:', data);
    return ok;
  } catch (error) {
    console.log(`❌ ${name}: Failed -`, error.message);
    return false;
  }
};

const runTests = async () => {
  await ensureFetch();

  const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3001';

  const serverUp = await waitForServer(BASE);
  if (!serverUp) {
    console.log('❌ Cannot reach server at', BASE);
    console.log('   Make sure the backend is running (npm run dev) and port is correct.');
    return;
  }

  console.log('Testing endpoints that work without database:\n');

  const healthOk = await testEndpoint(`${BASE}/health`, 'Health Check');
  const spawnOk = await testEndpoint(`${BASE}/api/spawn`, 'Spawn Pokemon');

  console.log('\nTesting database-dependent endpoint (DB may be connected):\n');

  let createStatus = 'skipped';
  try {
    const response = await fetch(`${BASE}/api/player`, {
      ...withTimeout(5000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', walletAddress: '0x123' })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 503) {
      console.log('📦 Create Player: Correctly blocked (no DB)');
      console.log('   Message:', data.message);
      createStatus = 'blocked';
    } else if (response.ok) {
      console.log('📦 Create Player: OK (DB connected)');
      console.log('   Player ID:', data.player?._id || '(no id)');
      createStatus = 'ok';
    } else if (response.status === 400 && data?.error === 'Player already exists') {
      console.log('📦 Create Player: Already exists (DB connected)');
      createStatus = 'exists';
    } else {
      console.log('📦 Create Player: Unexpected status', response.status);
      console.log('   Response:', data);
      createStatus = 'error';
    }
  } catch (error) {
    console.log('❌ Create Player test failed:', error.message);
    createStatus = 'failed';
  }

  console.log('\n🎯 Summary:');
  console.log(healthOk ? '✅ Health endpoint reachable' : '❌ Health endpoint unreachable');
  console.log(spawnOk ? '✅ Non-database endpoints work' : '❌ Non-database endpoints failing');
  const dbSummary = {
    ok: '✅ Database endpoints working',
    exists: '✅ Database endpoints working (player exists)',
    blocked: '✅ Database endpoints are properly protected (DB not connected)',
    error: '❌ Database endpoint error',
    failed: '❌ Database endpoint fetch failed',
    skipped: '⚠️ Skipped'
  }[createStatus];
  console.log(dbSummary);
  console.log('\n💡 Set up MongoDB Atlas to enable all features!');
};

runTests();
