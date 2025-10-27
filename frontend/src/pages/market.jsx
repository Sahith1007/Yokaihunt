import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Market() {
  const [inventory, setInventory] = useState({ pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 });
  const [coins, setCoins] = useState(1000); // Mock currency for now
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load player inventory
    import('../../lib/api/pokemonApi')
      .then(mod => mod.getPlayerInventory())
      .then(data => {
        setInventory(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const shopItems = [
    { id: 'pokeball', name: 'Poké Ball', icon: '⚾', price: 200, description: 'A standard ball for catching Pokémon' },
    { id: 'greatball', name: 'Great Ball', icon: '🥎', price: 600, description: 'A better ball with higher catch rate' },
    { id: 'ultraball', name: 'Ultra Ball', icon: '🏀', price: 1200, description: 'A high-performance ball for tough catches' },
    { id: 'masterball', name: 'Master Ball', icon: '🎱', price: 5000, description: 'Guarantees a catch! Very rare.' },
  ];

  const handlePurchase = async (itemId, price) => {
    if (coins < price) {
      setPurchaseStatus('❌ Not enough coins!');
      setTimeout(() => setPurchaseStatus(''), 2000);
      return;
    }

    // In a real implementation, this would call a backend API
    // For now, we'll just update the UI optimistically
    setCoins(coins - price);
    setInventory(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
    setPurchaseStatus(`✅ Purchased 1 ${shopItems.find(i => i.id === itemId)?.name}!`);
    setTimeout(() => setPurchaseStatus(''), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1116] via-[#151821] to-[#1a1d2e] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl hover:scale-110 transition-transform">
              ⬅️
            </Link>
            <h1 className="text-2xl font-bold">💰 Pokémon Marketplace</h1>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/30">
            <span className="text-xl">🪙</span>
            <span className="font-bold text-yellow-300">{coins} Coins</span>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {purchaseStatus && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-black/90 px-6 py-3 rounded-lg border border-white/20"
        >
          {purchaseStatus}
        </motion.div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Current Inventory Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-white/5 rounded-xl p-6 border border-white/10"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🎒</span> Your Inventory
          </h2>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(inventory).map(([key, count]) => {
                const item = shopItems.find(i => i.id === key);
                return (
                  <div key={key} className="bg-black/20 p-4 rounded-lg text-center">
                    <div className="text-4xl mb-2">{item?.icon}</div>
                    <div className="text-sm font-medium">{item?.name}</div>
                    <div className="text-lg font-bold text-blue-400">× {count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Shop Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🏪</span> Shop Items
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {shopItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 border border-white/10 hover:border-white/30 transition-all hover:scale-105"
              >
                <div className="text-6xl mb-3 text-center">{item.icon}</div>
                <h3 className="text-lg font-bold text-center mb-2">{item.name}</h3>
                <p className="text-xs text-gray-400 text-center mb-4 h-10">{item.description}</p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-xl">🪙</span>
                  <span className="text-xl font-bold text-yellow-300">{item.price}</span>
                </div>
                <button
                  onClick={() => handlePurchase(item.id, item.price)}
                  disabled={coins < item.price}
                  className={`w-full py-2 rounded-lg font-medium transition-all ${
                    coins < item.price
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 hover:shadow-lg'
                  }`}
                >
                  {coins < item.price ? 'Not Enough Coins' : 'Buy Now'}
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200"
        >
          <span className="font-bold">💡 Tip:</span> Catch Pokémon in the wild to earn coins! Better balls increase your catch rate.
        </motion.div>
      </div>
    </div>
  );
}
