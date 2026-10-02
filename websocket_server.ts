import { WebSocketServer, WebSocket } from 'ws';
import { PeerMessage } from './types';

export class CollaborationServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.init();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log('[Server] New client connected. Total clients:', this.clients.size);

      ws.on('message', (message: Buffer) => {
        try {
          const parsedMessage: PeerMessage = JSON.parse(message.toString());
          this.broadcast(parsedMessage, ws);
        } catch (err) {
          console.error('[Server] Failed to parse client message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[Server] Client disconnected. Total clients:', this.clients.size);
      });
    });

    console.log(`[Server] Collaboration WebSocket server running on port ${this.wss.options.port}`);
  }

  private broadcast(message: PeerMessage, sender: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public close(): Promise<void> {
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}