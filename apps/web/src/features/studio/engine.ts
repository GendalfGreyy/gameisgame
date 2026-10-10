import type { StudioEntity, StudioScene } from '@game-is-game/shared';

export type GameStatus = 'playing' | 'won' | 'lost';

export type RuntimeState = {
  status: GameStatus;
  score: number;
  collected: number;
  totalCollectibles: number;
};

type Body = {
  entity: StudioEntity;
  vx: number;
  vy: number;
  grounded: boolean;
  alive: boolean;
};

type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
};

const MOVE_SPEED = 3.2;
const JUMP_VELOCITY = -10.5;
const MAX_FALL = 14;

function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function cloneScene(scene: StudioScene): StudioScene {
  return {
    version: scene.version,
    world: { ...scene.world },
    entities: scene.entities.map((e) => ({
      ...e,
      behaviors: [...e.behaviors],
    })),
  };
}

export class StudioRuntime {
  private readonly pristine: StudioScene;
  private scene: StudioScene;
  private bodies: Body[] = [];
  private player: Body | null = null;
  private input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
  };
  private jumpConsumed = false;
  private state: RuntimeState = {
    status: 'playing',
    score: 0,
    collected: 0,
    totalCollectibles: 0,
  };

  constructor(scene: StudioScene) {
    this.pristine = cloneScene(scene);
    this.scene = cloneScene(scene);
    this.resetBodies();
  }

  getScene(): StudioScene {
    return this.scene;
  }

  getState(): RuntimeState {
    return { ...this.state };
  }

  setInput(partial: Partial<InputState>) {
    this.input = { ...this.input, ...partial };
  }

  private resetBodies() {
    this.bodies = this.scene.entities.map((entity) => ({
      entity,
      vx: 0,
      vy: 0,
      grounded: false,
      alive: true,
    }));
    this.player = this.bodies.find((b) => b.entity.behaviors.includes('player')) ?? null;
    const spawn = this.scene.entities.find((e) => e.behaviors.includes('spawn'));
    if (this.player && spawn) {
      this.player.entity.x = spawn.x;
      this.player.entity.y = spawn.y;
    }
    this.state = {
      status: 'playing',
      score: 0,
      collected: 0,
      totalCollectibles: this.scene.entities.filter((e) => e.behaviors.includes('collectible'))
        .length,
    };
    this.jumpConsumed = false;
  }

  restart() {
    this.scene = cloneScene(this.pristine);
    this.resetBodies();
  }

  step(dtScale = 1) {
    if (this.state.status !== 'playing' || !this.player || !this.player.alive) {
      return;
    }

    const gravity = this.scene.world.gravity;
    const player = this.player;
    const e = player.entity;

    if (gravity > 0) {
      player.vx = 0;
      if (this.input.left) player.vx -= MOVE_SPEED;
      if (this.input.right) player.vx += MOVE_SPEED;
      player.vy = Math.min(MAX_FALL, player.vy + gravity * dtScale);
      if (this.input.jump && player.grounded && !this.jumpConsumed) {
        player.vy = JUMP_VELOCITY;
        player.grounded = false;
        this.jumpConsumed = true;
      }
      if (!this.input.jump) {
        this.jumpConsumed = false;
      }
    } else {
      player.vx = 0;
      player.vy = 0;
      if (this.input.left) player.vx -= MOVE_SPEED;
      if (this.input.right) player.vx += MOVE_SPEED;
      if (this.input.up) player.vy -= MOVE_SPEED;
      if (this.input.down) player.vy += MOVE_SPEED;
    }

    e.x += player.vx * dtScale;
    this.resolveSolids(player, 'x');
    e.y += player.vy * dtScale;
    player.grounded = false;
    this.resolveSolids(player, 'y');

    // World bounds clamp
    e.x = Math.max(0, Math.min(this.scene.world.width - e.w, e.x));
    e.y = Math.max(0, Math.min(this.scene.world.height - e.h, e.y));
    if (e.y + e.h >= this.scene.world.height) {
      player.grounded = true;
      player.vy = 0;
    }

    for (const body of this.bodies) {
      if (!body.alive || body === player) continue;
      const other = body.entity;
      if (!aabb(e.x, e.y, e.w, e.h, other.x, other.y, other.w, other.h)) {
        continue;
      }
      if (other.behaviors.includes('collectible')) {
        body.alive = false;
        other.w = 0;
        other.h = 0;
        this.state.score += 10;
        this.state.collected += 1;
      } else if (other.behaviors.includes('hazard')) {
        this.state.status = 'lost';
        player.alive = false;
      } else if (other.behaviors.includes('goal')) {
        this.state.status = 'won';
        player.alive = false;
      }
    }
  }

  private resolveSolids(player: Body, axis: 'x' | 'y') {
    const e = player.entity;
    for (const body of this.bodies) {
      if (!body.alive || body === player) continue;
      if (!body.entity.behaviors.includes('solid')) continue;
      const o = body.entity;
      if (!aabb(e.x, e.y, e.w, e.h, o.x, o.y, o.w, o.h)) continue;

      if (axis === 'x') {
        if (player.vx > 0) e.x = o.x - e.w;
        else if (player.vx < 0) e.x = o.x + o.w;
        player.vx = 0;
      } else {
        if (player.vy > 0) {
          e.y = o.y - e.h;
          player.grounded = true;
        } else if (player.vy < 0) {
          e.y = o.y + o.h;
        }
        player.vy = 0;
      }
    }
  }
}

export function createRuntimeFromScene(scene: StudioScene): StudioRuntime {
  return new StudioRuntime(scene);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: StudioScene,
  options?: {
    selectedId?: string | null;
    showSpawn?: boolean;
    cameraX?: number;
    cameraY?: number;
    /** When set, clear/fill this CSS-pixel viewport (play camera). Otherwise fill world bounds. */
    viewWidth?: number;
    viewHeight?: number;
  },
) {
  const camX = options?.cameraX ?? 0;
  const camY = options?.cameraY ?? 0;
  const showSpawn = options?.showSpawn ?? true;
  const viewW = options?.viewWidth ?? scene.world.width;
  const viewH = options?.viewHeight ?? scene.world.height;

  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.fillStyle = scene.world.background;
  ctx.fillRect(0, 0, viewW, viewH);

  // Soft atmosphere grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = -((camX % grid) + grid); x < viewW; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewH);
    ctx.stroke();
  }
  for (let y = -((camY % grid) + grid); y < viewH; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewW, y);
    ctx.stroke();
  }

  for (const entity of scene.entities) {
    if (entity.behaviors.includes('spawn') && !showSpawn) continue;
    if (entity.w <= 0 || entity.h <= 0) continue;

    const x = entity.x - camX;
    const y = entity.y - camY;
    ctx.fillStyle = entity.color;

    if (entity.kind === 'circle') {
      ctx.beginPath();
      ctx.ellipse(
        x + entity.w / 2,
        y + entity.h / 2,
        entity.w / 2,
        entity.h / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      const radius = Math.min(10, entity.w / 4, entity.h / 4);
      roundRect(ctx, x, y, entity.w, entity.h, radius);
      ctx.fill();
    }

    if (options?.selectedId === entity.id) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x - 2, y - 2, entity.w + 4, entity.h + 4);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Hit-test entities top-most first. */
export function pickEntityAt(
  scene: StudioScene,
  worldX: number,
  worldY: number,
): StudioEntity | null {
  for (let i = scene.entities.length - 1; i >= 0; i -= 1) {
    const e = scene.entities[i];
    if (!e) continue;
    if (worldX >= e.x && worldX <= e.x + e.w && worldY >= e.y && worldY <= e.y + e.h) {
      return e;
    }
  }
  return null;
}
