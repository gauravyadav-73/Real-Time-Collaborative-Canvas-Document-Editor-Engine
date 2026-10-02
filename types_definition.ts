import { EventEmitter } from 'events';

// ==========================================
// 1. DISCRIMINATED UNIONS FOR SHAPES
// ==========================================

export interface Point {
  x: number;
  y: number;
}

export interface BaseShape {
  id: string;
  color: string;
  strokeWidth: number;
  creatorId: string;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
}

export interface PathShape extends BaseShape {
  type: 'path';
  points: Point[];
}

export type CanvasShape = RectangleShape | CircleShape | PathShape;

// ==========================================
// 2. DISCRIMINATED UNIONS FOR WS PAYLOADS
// ==========================================

export interface UserPresence {
  userId: string;
  userName: string;
  cursor: Point | null;
  selectedShapeId: string | null;
}

export type PeerMessage =
  | { type: 'SYNC_UPDATE'; update: number[] }
  | { type: 'PRESENCE_UPDATE'; presence: UserPresence }
  | { type: 'USER_JOINED'; userId: string; userName: string }
  | { type: 'USER_LEFT'; userId: string };

// ==========================================
// 3. STRICTLY TYPED EVENT EMITTER
// ==========================================

export type CanvasEvents = {
  'shape:added': (shape: CanvasShape) => void;
  'shape:updated': (shape: CanvasShape) => void;
  'shape:deleted': (shapeId: string) => void;
  'presence:changed': (presenceMap: Map<string, UserPresence>) => void;
  'state:changed': (oldState: string, newState: string) => void;
};

export class TypedEmitter<T extends Record<string, (...args: any[]) => void>> {
  private emitter = new EventEmitter();

  on<K extends keyof T & string>(event: K, listener: T[K]): this {
    this.emitter.on(event, listener as any);
    return this;
  }

  emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): boolean {
    return this.emitter.emit(event, ...args);
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): this {
    this.emitter.off(event, listener as any);
    return this;
  }
}