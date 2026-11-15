import Phaser from 'phaser';
import { BUILDINGS } from '../config/buildings';
import type { Building, GameState } from '../systems/state';
import { TEX, texKey } from '../art/drawBuildings';
import { footprintCenter, HH } from '../art/iso';
import { fmtTime } from '../../utils/format';

const UI_DEPTH = 2_000_000;

/** Visual for one building: sprite, construction site, timer, status badge, lights and effects. */
export class BuildingView {
  readonly id: number;
  /** Tile the view was built for; a moved building gets a fresh view. */
  readonly tx: number;
  readonly ty: number;
  sprite: Phaser.GameObjects.Image;
  site: Phaser.GameObjects.Image | null = null;
  scaffold: Phaser.GameObjects.Image | null = null;
  badge: Phaser.GameObjects.Image;
  lights: Phaser.GameObjects.Image[] = [];
  timer: Phaser.GameObjects.Container;
  timerFill: Phaser.GameObjects.Rectangle;
  timerText: Phaser.GameObjects.Text;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  rocket: Phaser.GameObjects.Image | null = null;
  flame: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  key = '';
  cx: number;
  cy: number;
  depth: number;
  height: number;
  private level = -1;
  private online = true;

  constructor(private scene: Phaser.Scene, b: Building) {
    this.id = b.id;
    this.tx = b.x;
    this.ty = b.y;
    const n = BUILDINGS[b.type].size;
    const c = footprintCenter(b.x, b.y, n);
    this.cx = c.x;
    this.cy = c.y;
    this.depth = c.y + n * HH;
    const info = TEX.get(texKey(b.type, 1))!;
    this.height = info.top * 0.8;
    this.sprite = scene.add.image(c.x, c.y, info.key).setOrigin(0.5, info.originY).setDepth(this.depth);
    this.badge = scene.add.image(c.x, c.y - this.height * 0.55, 'nopower').setDepth(UI_DEPTH).setVisible(false).setScale(0.9);
    const bg = scene.add.rectangle(0, 0, 112, 30, 0x0b1020, 0.85).setStrokeStyle(2, 0xffd23f);
    const track = scene.add.rectangle(-50, 7, 100, 6, 0x2b3346).setOrigin(0, 0.5);
    this.timerFill = scene.add.rectangle(-50, 7, 100, 6, 0x3fdc7c).setOrigin(0, 0.5);
    this.timerText = scene.add.text(0, -5, '0:00', { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.timer = scene.add.container(c.x, c.y - this.height - 10, [bg, track, this.timerFill, this.timerText]).setDepth(UI_DEPTH).setVisible(false);

    if (b.type === 'mine') this.emitter = this.makeEmitter(c.x + 30, c.y - 20, { tint: [0xb9b2a6, 0x8e919b], speedY: { min: -40, max: -10 }, speedX: { min: -30, max: 30 }, lifespan: 1400, frequency: 160, scale: { start: 0.9, end: 2.2 }, alpha: { start: 0.55, end: 0 } });
    if (b.type === 'refinery') this.emitter = this.makeEmitter(c.x + 20, c.y - 150, { tint: [0x8e919b, 0x5d6270], speedY: { min: -50, max: -25 }, speedX: { min: 5, max: 20 }, lifespan: 2400, frequency: 220, scale: { start: 1, end: 3.2 }, alpha: { start: 0.5, end: 0 } });
    if (b.type === 'oxygen') this.emitter = this.makeEmitter(c.x + 26, c.y - 40, { tint: [0x7dfff0, 0xffffff], speedY: { min: -40, max: -20 }, speedX: { min: -8, max: 8 }, lifespan: 1600, frequency: 300, scale: { start: 0.5, end: 0.2 }, alpha: { start: 0.9, end: 0 } });
    if (b.type === 'ice') this.emitter = this.makeEmitter(c.x + 25, c.y - 30, { tint: [0xbfefff, 0xffffff], speedY: { min: -25, max: -5 }, speedX: { min: -25, max: 25 }, lifespan: 1200, frequency: 200, scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.8, end: 0 } });
    if (b.type === 'spaceport') {
      this.rocket = scene.add.image(c.x, c.y - 16, 'rocket').setOrigin(0.5, 180 / 190).setDepth(this.depth + 0.5).setVisible(false);
      this.flame = scene.add.particles(0, 0, 'dot', {
        tint: [0xffd23f, 0xff8a3d, 0xff4d4d], speedY: { min: 80, max: 180 }, speedX: { min: -30, max: 30 }, lifespan: 600,
        frequency: 20, scale: { start: 1.6, end: 0.2 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false,
      }).setDepth(this.depth + 0.4);
    }
  }

  private makeEmitter(x: number, y: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) {
    return this.scene.add.particles(x, y, 'dot', { ...cfg, emitting: false }).setDepth(this.depth + 0.5);
  }

  /** Apply the latest simulation state. Cheap: only touches what changed. */
  sync(b: Building) {
    const showLevel = Math.max(1, b.level);
    const key = texKey(b.type, showLevel, b.shield);
    if (key !== this.key) {
      const info = TEX.get(key)!;
      this.sprite.setTexture(key).setOrigin(0.5, info.originY);
      this.key = key;
      this.rebuildLights(info.lights);
      if (this.level >= 1 && b.level > this.level) this.pop();
    }
    if (this.level === 0 && b.level === 1) this.pop();
    this.level = b.level;

    const n = BUILDINGS[b.type].size;
    const constructing = b.level === 0;
    if (constructing && !this.site) {
      this.site = this.scene.add.image(this.cx, this.cy, `site_${n}`).setOrigin(0.5, TEX.get(`site_${n}`)!.originY).setDepth(this.depth - 0.1);
    }
    if (!constructing && this.site) {
      this.site.destroy();
      this.site = null;
    }
    const working = !!b.job;
    if (working && !this.scaffold) {
      this.scaffold = this.scene.add.image(this.cx, this.cy, `scaffold_${n}`).setOrigin(0.5, TEX.get(`scaffold_${n}`)!.originY).setDepth(this.depth + 0.3);
    }
    if (!working && this.scaffold) {
      this.scaffold.destroy();
      this.scaffold = null;
    }
    this.sprite.setAlpha(constructing ? 0.35 : 1);
    this.timer.setVisible(working);

    const def = BUILDINGS[b.type];
    const showBadge = !constructing && (!b.enabled || (!b.online && def.power > 0));
    this.badge.setVisible(showBadge).setTexture(b.enabled ? 'nopower' : 'switchedoff');
    this.online = !constructing && b.online;
    if (this.emitter) {
      const on = this.online && b.level > 0;
      if (on && !this.emitter.emitting) this.emitter.start();
      if (!on && this.emitter.emitting) this.emitter.stop();
    }
  }

  private rebuildLights(defs: { x: number; y: number; color: number; r: number }[]) {
    for (const l of this.lights) l.destroy();
    this.lights = defs.map((d) =>
      this.scene.add.image(this.cx + d.x, this.cy + d.y, 'glow').setTint(d.color).setScale(d.r / 22).setBlendMode(Phaser.BlendModes.ADD).setDepth(UI_DEPTH - 10).setAlpha(0),
    );
  }

  private pop() {
    this.sprite.setScale(1, 0.85);
    this.scene.tweens.add({ targets: this.sprite, scaleY: 1, scaleX: 1, duration: 420, ease: 'Back.Out' });
    const burst = this.scene.add.particles(this.cx, this.cy, 'dot', {
      tint: [0xffd23f, 0x7fe3ff, 0xffffff], speed: { min: 80, max: 220 }, angle: { min: 200, max: 340 },
      lifespan: 700, scale: { start: 0.8, end: 0 }, gravityY: 300, emitting: false,
    }).setDepth(UI_DEPTH);
    burst.explode(30);
    this.scene.time.delayedCall(900, () => burst.destroy());
  }

  /** Per-frame animation. `dark` 0..1 is how dark the night is. */
  update(b: Building, s: GameState, dark: number, now: number) {
    const lit = this.online ? dark * 0.95 : 0;
    for (const l of this.lights) l.setAlpha(lit);
    if (b.job) {
      const total = b.job.end - b.job.start;
      const p = Phaser.Math.Clamp((s.time - b.job.start) / total, 0, 1);
      this.timerFill.width = 100 * p;
      this.timerText.setText(`${({ shield: '🛡 ', repair: '🔧 ', clean: '🧹 ', build: '🔨 ', upgrade: '🔨 ' } as const)[b.job.kind]}${fmtTime(b.job.end - s.time)}`);
      if (b.level === 0) this.sprite.setAlpha(0.25 + 0.6 * p);
    }
    if (this.badge.visible) this.badge.setY(this.cy - this.height * 0.6 + Math.sin(now / 250) * 4);
    if (this.rocket) this.updateRocket(b, s);
  }

  private updateRocket(b: Building, s: GameState) {
    const rocket = this.rocket!;
    const flame = this.flame!;
    if (b.level === 0) {
      rocket.setVisible(false);
      return;
    }
    const c = s.cargo.active;
    let lift = 0;
    let thrust = false;
    if (c) {
      const p = (s.time - c.start) / (c.end - c.start);
      if (p < 0.15) {
        lift = Math.pow(p / 0.15, 2) * 900;
        thrust = true;
      } else if (p > 0.85) {
        lift = Math.pow((1 - p) / 0.15, 2) * 900;
        thrust = true;
      } else lift = 2000;
    }
    rocket.setVisible(lift < 1200).setY(this.cy - 16 - lift);
    flame.setPosition(this.cx, this.cy - 14 - lift);
    if (thrust && !flame.emitting) flame.start();
    if (!thrust && flame.emitting) flame.stop();
  }

  destroy() {
    this.sprite.destroy();
    this.site?.destroy();
    this.scaffold?.destroy();
    this.badge.destroy();
    this.timer.destroy();
    this.emitter?.destroy();
    this.rocket?.destroy();
    this.flame?.destroy();
    for (const l of this.lights) l.destroy();
  }
}

