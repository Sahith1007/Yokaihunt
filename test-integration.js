// Simple test to verify backend API integration

const BASE_URL = 'http://localhost:4000';

async function testAPI() {
  console.log('🧪 Testing YokaiHunt API Integration...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await fetch(`${BASE_URL}/health`);
    const healthData = await health.json();
    console.log('✅ Health:', healthData.status);
    
    // Test player endpoint
    console.log('\n2. Testing player endpoint...');
    const player = await fetch(`${BASE_URL}/api/player`);
    const playerData = await player.json();
    console.log('✅ Player:', playerData);
    
    // Test pokemon endpoint
    console.log('\n3. Testing pokemon endpoint...');
    const pokemon = await fetch(`${BASE_URL}/api/pokemon`);
    const pokemonData = await pokemon.json();
    console.log('✅ Pokemon:', pokemonData);
    
    // Test inventory endpoint
    console.log('\n4. Testing inventory endpoint...');
    const inventory = await fetch(`${BASE_URL}/api/inventory`);
    const inventoryData = await inventory.json();
    console.log('✅ Inventory:', inventoryData);
    
    console.log('\n🎉 All API endpoints working!');
    console.log('\n🎮 Ready for battle system testing:');
    console.log('   - Start backend: cd backend && node server.js');
    console.log('   - Start frontend: cd frontend && npm run dev'); 
    console.log('   - Open http://localhost:3000');
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    console.log('\n🔧 Make sure backend is running:');
    console.log('   cd backend && node server.js');
  }
}

testAPI();