import { CollaborationServer } from './server';
import { CollaborativeCanvasEngine } from './canvasState';
import { PeerMessage } from './types';
import WebSocket from 'ws';

async function runSimulation() {
  const PORT = 8080;

  // 1. Start Server
  const server = new CollaborationServer(PORT);

  // Helper function to create client WebSocket with event listeners
  function setupClient(userId: string, userName: string) {
    const engine = new CollaborativeCanvasEngine(userId, userName);
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    // Register typed event handlers
    engine.on('state:changed', (oldMode, newMode) => {
      console.log(`[${userName}] State Transition: ${oldMode} ➔ ${newMode}`);
    });

    engine.on('shape:added', (shape) => {
      console.log(`[${userName}] Shape Sync Event (Added):`, shape);
    });

    engine.on('shape:updated', (shape) => {
      console.log(`[${userName}] Shape Sync Event (Updated):`, shape);
    });

    ws.on('open', () => {
      // Send initial presence update
      const presence = engine.updatePresence({ x: 10, y: 10 }, null);
      const msg: PeerMessage = { type: 'PRESENCE_UPDATE', presence };
      ws.send(JSON.stringify(msg));
    });

    ws.on('message', (data: Buffer) => {
      const msg: PeerMessage = JSON.parse(data.toString());
      switch (msg.type) {
        case 'SYNC_UPDATE':
          engine.applyRemoteUpdate(new Uint8Array(msg.update));
          break;
        case 'PRESENCE_UPDATE':
          console.log(`[${userName}] Received Presence update from User ${msg.presence.userId}`);
          break;
      }
    });

    return { engine, ws };
  }

  // Allow WS server to boot
  await new Promise((r) => setTimeout(r, 500));

  // 2. Client Alice setup
  const alice = setupClient('usr-1', 'Alice');

  // 3. Client Bob setup
  const bob = setupClient('usr-2', 'Bob');

  await new Promise((r) => setTimeout(r, 500));

  // 4. Simulate Alice drawing a rectangle
  console.log('\n--- Simulation: Alice changes state and draws a rectangle ---');
  alice.engine.setMode('DRAW_RECT');
  alice.engine.handlePointerDown({ x: 50, y: 50 }, '#FF0000');

  const shapes = alice.engine.getAllShapes();
  const createdRect = shapes[0];

  alice.engine.handlePointerMove({ x: 150, y: 200 }, createdRect.id);
  alice.engine.handlePointerUp();

  // Send CRDT update from Alice to Server
  const aliceUpdate = alice.engine.encodeStateVector();
  const syncMsg: PeerMessage = {
    type: 'SYNC_UPDATE',
    update: Array.from(aliceUpdate),
  };
  alice.ws.send(JSON.stringify(syncMsg));

  await new Promise((r) => setTimeout(r, 500));

  console.log('\n--- Current State Verification ---');
  console.log("Bob's Shapes synced via CRDT:", bob.engine.getAllShapes());

  // Cleanup
  alice.ws.close();
  bob.ws.close();
  await server.close();
  process.exit(0);
}

runSimulation();