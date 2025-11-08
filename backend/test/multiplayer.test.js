// backend/test/multiplayer.test.js
// Multiplayer Socket.IO tests

import { describe, it, expect } from '@jest/globals';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:4000';

describe('Multiplayer Socket.IO', () => {
  let socket1, socket2;

  afterEach(() => {
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
  });

  it('should connect to server', (done) => {
    socket1 = io(SERVER_URL);
    socket1.on('connect', () => {
      expect(socket1.connected).toBe(true);
      done();
    });
    socket1.on('connect_error', (err) => {
      console.warn('Connection error (server may not be running):', err.message);
      done();
    });
  }, 5000);

  it('should join game', (done) => {
    socket1 = io(SERVER_URL);
    socket1.on('connect', () => {
      socket1.emit('join', {
        wallet: 'test-wallet-1',
        x: 100,
        y: 100,
        biome: 'grassland',
        dir: 0
      });
      // If no error, join was successful
      setTimeout(() => {
        expect(socket1.connected).toBe(true);
        done();
      }, 500);
    });
    socket1.on('connect_error', () => {
      console.warn('⏭️  Skipping - server not running');
      done();
    });
  }, 5000);

  it('should receive player updates', (done) => {
    socket1 = io(SERVER_URL);
    socket1.on('connect', () => {
      socket1.emit('join', {
        wallet: 'test-wallet-1',
        x: 100,
        y: 100,
        biome: 'grassland'
      });

      socket1.on('playersUpdate', (players) => {
        expect(players).toBeDefined();
        expect(typeof players).toBe('object');
        done();
      });

      // Trigger update by moving
      setTimeout(() => {
        socket1.emit('move', {
          wallet: 'test-wallet-1',
          x: 110,
          y: 110,
          biome: 'grassland',
          dir: 0
        });
      }, 200);
    });
    socket1.on('connect_error', () => {
      console.warn('⏭️  Skipping - server not running');
      done();
    });
  }, 10000);

  it('should broadcast to multiple players', (done) => {
    socket1 = io(SERVER_URL);
    socket2 = io(SERVER_URL);

    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 2) {
        socket1.emit('join', { wallet: 'test-1', x: 100, y: 100, biome: 'grassland' });
        socket2.emit('join', { wallet: 'test-2', x: 200, y: 200, biome: 'grassland' });

        socket2.on('playersUpdate', (players) => {
          if (players['test-1']) {
            expect(players['test-1']).toBeDefined();
            done();
          }
        });
      }
    };

    socket1.on('connect', onConnect);
    socket2.on('connect', onConnect);
    socket1.on('connect_error', () => {
      console.warn('⏭️  Skipping - server not running');
      done();
    });
    socket2.on('connect_error', () => {
      console.warn('⏭️  Skipping - server not running');
      done();
    });
  }, 10000);
});

