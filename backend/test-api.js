// Simple API test script
// Run this after starting the server to test endpoints

const BASE_URL = 'http://localhost:3001/api';

async function testAPI() {
  try {
    console.log('🧪 Testing API endpoints...\n');

    // Test health check
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test spawn Pokemon
    const spawnResponse = await fetch(`${BASE_URL}/spawn`);
    const spawnData = await spawnResponse.json();
    console.log('✅ Spawn Pokemon:', spawnData);

    console.log('\n🎉 All basic tests passed!');
    console.log('\n📋 Available endpoints:');
    console.log('POST /api/player - Create player');
    console.log('GET /api/player/:id - Get player');
    console.log('GET /api/spawn - Spawn random Pokemon');
    console.log('POST /api/catch - Catch Pokemon');
    console.log('GET /api/inventory/:playerId - Get inventory');
    console.log('POST /api/evolve - Evolve Pokemon');
    console.log('POST /api/sell - List Pokemon for sale');
    console.log('GET /api/marketplace - View marketplace');
    console.log('POST /api/buy - Buy Pokemon from marketplace');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('Make sure the server is running: npm run dev');
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAPI();
}