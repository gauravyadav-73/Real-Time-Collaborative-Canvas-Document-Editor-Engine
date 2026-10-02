import * as Y from 'yjs';
import { CanvasShape, CanvasEvents, TypedEmitter, UserPresence, Point } from './types';

// State Machine States & Transitions
export type ToolMode = 'SELECT' | 'DRAW_RECT' | 'DRAW_CIRCLE' | 'PAN';

export interface CanvasInteractionState {
  mode: ToolMode;
  isInteracting: boolean;
  startPoint: Point | null;
}

export class CollaborativeCanvasEngine extends TypedEmitter<CanvasEvents> {
  private doc: Y.Doc;
  private shapesMap: Y.Map<CanvasShape>;
  private userId: string;
  private userName: string;
  private activeState: CanvasInteractionState;
  private presenceMap: Map<string, UserPresence> = new Map();

  constructor(userId: string, userName: string) {
    super();
    this.userId = userId;
    this.userName = userName;
    this.doc = new Y.Doc();
    this.shapesMap = this.doc.getMap<CanvasShape>('canvas-shapes');

    this.activeState = {
      mode: 'SELECT',
      isInteracting: false,
      startPoint: null,
    };

    // Observe CRDT changes and emit typed local events
    this.shapesMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          const shape = this.shapesMap.get(key);
          if (shape) this.emit('shape:added', shape);
        } else if (change.action === 'update') {
          const shape = this.shapesMap.get(key);
          if (shape) this.emit('shape:updated', shape);
        } else if (change.action === 'delete') {
          this.emit('shape:deleted', key);
        }
      });
    });
  }

  // State Machine transition method
  public setMode(newMode: ToolMode): void {
    const oldMode = this.activeState.mode;
    if (oldMode === newMode) return;

    this.activeState = {
      mode: newMode,
      isInteracting: false,
      startPoint: null,
    };

    this.emit('state:changed', oldMode, newMode);
  }

  public getMode(): ToolMode {
    return this.activeState.mode;
  }

  // Handle interaction based on state machine mode
  public handlePointerDown(point: Point, color: string = '#000000'): void {
    this.activeState.isInteracting = true;
    this.activeState.startPoint = point;

    switch (this.activeState.mode) {
      case 'DRAW_RECT': {
        const newRect: CanvasShape = {
          id: `rect-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'rectangle',
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          color,
          strokeWidth: 2,
          creatorId: this.userId,
        };
        this.shapesMap.set(newRect.id, newRect);
        break;
      }
      case 'DRAW_CIRCLE': {
        const newCircle: CanvasShape = {
          id: `circle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'circle',
          cx: point.x,
          cy: point.y,
          radius: 0,
          color,
          strokeWidth: 2,
          creatorId: this.userId,
        };
        this.shapesMap.set(newCircle.id, newCircle);
        break;
      }
      case 'SELECT':
      case 'PAN':
        // Handle selection or view movement
        break;
    }
  }

  public handlePointerMove(currentPoint: Point, shapeIdToUpdate?: string): void {
    if (!this.activeState.isInteracting || !this.activeState.startPoint) return;

    const start = this.activeState.startPoint;

    if (shapeIdToUpdate && this.shapesMap.has(shapeIdToUpdate)) {
      const shape = this.shapesMap.get(shapeIdToUpdate)!;

      // Exhaustive shape pattern matching using Discriminated Union
      switch (shape.type) {
        case 'rectangle': {
          const updatedRect: CanvasShape = {
            ...shape,
            width: Math.abs(currentPoint.x - start.x),
            height: Math.abs(currentPoint.y - start.y),
          };
          this.shapesMap.set(shape.id, updatedRect);
          break;
        }
        case 'circle': {
          const radius = Math.sqrt(
            Math.pow(currentPoint.x - start.x, 2) + Math.pow(currentPoint.y - start.y, 2)
          );
          const updatedCircle: CanvasShape = {
            ...shape,
            radius: Math.round(radius),
          };
          this.shapesMap.set(shape.id, updatedCircle);
          break;
        }
        case 'path':
          // Path handling logic
          break;
      }
    }
  }

  public handlePointerUp(): void {
    this.activeState.isInteracting = false;
    this.activeState.startPoint = null;
  }

  // CRDT Synchronization Methods
  public applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  public encodeStateVector(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  public getAllShapes(): CanvasShape[] {
    return Array.from(this.shapesMap.values());
  }

  public updatePresence(cursor: Point | null, selectedShapeId: string | null): UserPresence {
    const presence: UserPresence = {
      userId: this.userId,
      userName: this.userName,
      cursor,
      selectedShapeId,
    };
    this.presenceMap.set(this.userId, presence);
    this.emit('presence:changed', this.presenceMap);
    return presence;
  }
}