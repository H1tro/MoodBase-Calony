import Phaser from 'phaser';
import { BUILDINGS } from '../config/buildings';
import { MAP_SIZE } from '../config/balance';
import { store } from '../store';
import { getTerrain } from '../systems/terrain';
import { buildingAt, cyclePos, dayLength, isDay } from '../systems/selectors';
import { drawRidges, drawTerrain, groundOutline, LANDER_TILE, ROVER_LOOP } from '../art/drawTerrain';
import { TEX, texKey } from '../art/drawBuildings';
import { footprintCenter, HH, HW, mix, tileTop, WORLD_H, WORLD_W, worldToTile } from '../art/iso';
import { BuildingView } from '../entities/BuildingView';
import { BuilderBot } from '../entities/BuilderBot';
import { Astronaut } from '../entities/Astronaut';
import { Rover } from '../entities/Rover';
import { networkStatus, opsCenter } from '../systems/monitoring';

const DRAG_THRESHOLD = 8;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.6;
const SHADOW_DEPTH = 0.8;
const UI_DEPTH = 2_000_000;
const MAX_STEPS = 220;

type Caster = { src: Phaser.GameObjects.Image; sh: Phaser.GameObjects.Image };

/** The lunar map: terrain, buildings, robots, crew, day/night, camera and input. */
export class MoonScene extends Phaser.Scene {
  private views = new Map<number, BuildingView>();
  private shadows = new Map<number, Phaser.GameObjects.Image>();
  private propCasters: Caster[] = [];
  private bots: BuilderBot[] = [];
  private crew: Astronaut[] = [];
  private steps: Phaser.GameObjects.Image[] = [];
  private iceSpots: { x: number; y: number }[] = [];
  private rover!: Rover;
  private night!: Phaser.GameObjects.Rectangle;
  private hover!: Phaser.GameObjects.Graphics;
  private selection!: Phaser.GameObjects.Graphics;
  private ghostCells!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private tooltip!: Phaser.GameObjects.Container;
  private tipTitle!: Phaser.GameObjects.Text;
  private tipSub!: Phaser.GameObjects.Text;
  private tipBg!: Phaser.GameObjects.Rectangle;
  private hoverId: number | null = null;
  private dirty = true;
  private unsub: (() => void) | null = null;
  private hoverTile: { x: number; y: number } | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private glintTimer = 0;
  /** Graphics quality 'low' (from Options): no grain, glints, cast shadows or footprints. */
  private lowGfx = false;
  private cables!: Phaser.GameObjects.Graphics;
  private beams!: Phaser.GameObjects.Graphics;
  /** Report 'map-ready' after the first rendered frame (the launch sequence waits for it). */
  private reportReady = false;

  // Camera interaction
  private downAt: { x: number; y: number } | null = null;
  private travel = 0;
  private dragging = false;
  private velocity = new Phaser.Math.Vector2();
  private pinchDist = 0;

  constructor() {
    super('moon');
  }

  create() {
    // The scene is restarted when a new colony launches, so reset per-run state here.
    this.views = new Map();
    this.shadows = new Map();
    this.propCasters = [];
    this.bots = [];
    this.crew = [];
    this.steps = [];
    this.iceSpots = [];
    this.hoverId = null;
    this.hoverTile = null;
    this.downAt = null;
    this.dragging = false;
    this.velocity.set(0, 0);
    this.dirty = true;
    this.reportReady = true;
    const s = store.state;
    const terrain = getTerrain(s.seed, s.difficulty);
    drawRidges(this.add.graphics().setDepth(-1), s.seed);
    drawTerrain(this.add.graphics().setDepth(0), terrain, s.seed);

    // Fine regolith grain over the ground only.
    const low = store.profile.settings.graphics === 'low';
    this.lowGfx = low;
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillPoints(groundOutline(), true);
    if (!low) this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grain').setOrigin(0).setTileScale(1, 0.55)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.85).setDepth(0.5).setMask(maskG.createGeometryMask());

    // Boulders are depth-sorted props that cast shadows.
    terrain.tiles.forEach((k, i) => {
      const x = i % MAP_SIZE;
      const y = Math.floor(i / MAP_SIZE);
      if (k === 'ice') this.iceSpots.push(tileTop(x + 0.5, y + 0.5));
      if (k !== 'boulder') return;
      const p = tileTop(x, y);
      const img = this.add.image(p.x, p.y + HH + 14, `boulder_${(x * 7 + y) % 3}`).setOrigin(0.5, 80 / 110).setScale(0.75).setDepth(p.y + 2 * HH);
      this.addPropShadow(img);
    });

    // The first landing site: descent stage, flag and the crew's first footprints.
    const lp = tileTop(LANDER_TILE.x, LANDER_TILE.y);
    this.addPropShadow(this.add.image(lp.x, lp.y, 'lander').setOrigin(0.5, 104 / 130).setDepth(lp.y));
    const fp = tileTop(LANDER_TILE.x + 1.1, LANDER_TILE.y + 0.9);
    this.addPropShadow(this.add.image(fp.x, fp.y, 'flag').setOrigin(6 / 40, 66 / 70).setDepth(fp.y));
    for (let i = 0; i < 26; i++) {
      const a = i * 0.7;
      const r = 30 + i * 6;
      this.add.image(lp.x + Math.cos(a) * r, lp.y + 20 + Math.sin(a) * r * 0.5, 'step').setDepth(0.9).setAlpha(0.5).setRotation(a);
    }

    this.rover = new Rover(this, ROVER_LOOP.map(([x, y]) => tileTop(x, y)));

    this.cables = this.add.graphics().setDepth(0.86);
    this.beams = this.add.graphics().setDepth(1_600_000);
    this.hover = this.add.graphics().setDepth(1);
    this.selection = this.add.graphics().setDepth(1);
    this.ghostCells = this.add.graphics().setDepth(1.5);
    this.ghost = this.add.image(0, 0, texKey('solar', 1)).setAlpha(0.7).setVisible(false).setDepth(1_900_000);

    // Night: a multiply overlay over the whole world; building lights sit above it.
    this.night = this.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(1_500_000);

    // Desktop hover tooltip
    this.tipBg = this.add.rectangle(0, 0, 10, 10, 0x0b1020, 0.9).setStrokeStyle(2, 0x2c3f70).setOrigin(0.5, 1);
    this.tipTitle = this.add.text(0, 0, '', { fontFamily: '"Baloo 2", system-ui, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5, 1);
    this.tipSub = this.add.text(0, 0, '', { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', color: '#9fc3ff' }).setOrigin(0.5, 1);
    this.tooltip = this.add.container(0, 0, [this.tipBg, this.tipTitle, this.tipSub]).setDepth(UI_DEPTH + 10).setVisible(false);

    this.setupCamera();
    this.setupInput();
    this.unsub = store.subscribe(() => (this.dirty = true));
    this.events.once('shutdown', () => this.unsub?.());
  }

  private addPropShadow(src: Phaser.GameObjects.Image) {
    if (this.lowGfx) return;
    const sh = this.add.image(src.x, src.y, src.texture.key).setOrigin(src.originX, src.originY).setScale(src.scaleX, -src.scaleY)
      .setTint(0x000000).setDepth(SHADOW_DEPTH);
    this.propCasters.push({ src, sh });
  }

  // ------------------------------------------------------------------ camera
  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    const cc = store.state.buildings.find((b) => b.type === 'command')!;
    const c = footprintCenter(cc.x, cc.y, 3);
    const fit = Phaser.Math.Clamp(Math.min(this.scale.width / 1500, this.scale.height / 900), 0.45, 1.1);
    cam.setZoom(fit);
    cam.centerOn(c.x, c.y);
    const onResize = (size: Phaser.Structs.Size) => cam.setSize(size.width, size.height);
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  private zoomAt(factor: number, sx: number, sy: number) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
    cam.preRender();
    const after = cam.getWorldPoint(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  /** Public so React zoom buttons can call it. */
  zoomBy(factor: number) {
    this.zoomAt(factor, this.scale.width / 2, this.scale.height / 2);
  }

  // ------------------------------------------------------------------ input
  private setupInput() {
    this.input.addPointer(1);
    const cam = this.cameras.main;
    // Keyboard camera (desktop). Capture is off so React shortcuts still receive keys.
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E', false) as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        // Right-click: cancel placement or deselect.
        this.downAt = null;
        if (store.ui.placing) store.cancelPlacement();
        else store.select(null);
        return;
      }
      this.downAt = { x: p.x, y: p.y };
      this.travel = 0;
      this.dragging = false;
      this.velocity.set(0, 0);
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) this.pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDist > 0) this.zoomAt(d / this.pinchDist, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        this.pinchDist = d;
        this.dragging = true;
        return;
      }
      if (p.isDown && this.downAt) {
        const dx = p.x - p.prevPosition.x;
        const dy = p.y - p.prevPosition.y;
        this.travel += Math.abs(dx) + Math.abs(dy);
        if (this.travel > DRAG_THRESHOLD) {
          this.dragging = true;
          cam.scrollX -= dx / cam.zoom;
          cam.scrollY -= dy / cam.zoom;
          this.velocity.set(dx / cam.zoom, dy / cam.zoom);
        }
        this.setHoverBuilding(null);
        return;
      }
      const w = cam.getWorldPoint(p.x, p.y);
      if (!p.wasTouch && !store.ui.placing) this.setHoverBuilding(this.pickBuilding(w.x, w.y));
      const t = worldToTile(w.x, w.y);
      if (!this.hoverTile || t.x !== this.hoverTile.x || t.y !== this.hoverTile.y) {
        this.hoverTile = t;
        if (store.ui.placing && !p.wasTouch) this.moveGhostTo(t.x, t.y);
        this.drawHover();
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pinchDist = 0;
      if (!this.downAt) return;
      this.downAt = null;
      if (this.dragging) return;
      const w = cam.getWorldPoint(p.x, p.y);
      this.click(w.x, w.y, !p.wasTouch);
    });

    this.input.on('gameout', () => this.setHoverBuilding(null));

    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(dy > 0 ? 0.9 : 1.1, p.x, p.y);
    });
  }

  private setHoverBuilding(id: number | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.input.setDefaultCursor(id !== null ? 'pointer' : 'default');
    this.refreshTooltip();
  }

  private refreshTooltip() {
    const id = this.hoverId;
    const b = id !== null ? store.state.buildings.find((x) => x.id === id) : undefined;
    const v = id !== null ? this.views.get(id) : undefined;
    if (!b || !v || store.ui.selectedId === id) {
      this.tooltip.setVisible(false);
      return;
    }
    const def = BUILDINGS[b.type];
    const status = b.level === 0 ? '🔨 under construction'
      : b.job ? '🔨 upgrading'
      : !b.enabled ? '⏸ switched off'
      : def.power > 0 && !b.online ? '⚡ NO POWER'
      : '● online';
    this.tipTitle.setText(`${def.icon} ${def.name}${b.level > 0 ? `  Lv ${b.level}` : ''}`);
    this.tipSub.setText(`${status} · click for details`);
    const w = Math.max(this.tipTitle.width, this.tipSub.width) + 22;
    this.tipBg.setSize(w, 48);
    this.tipTitle.setPosition(0, -24);
    this.tipSub.setPosition(0, -7);
    this.tooltip.setPosition(v.cx, v.cy - v.height - (b.job ? 46 : 14)).setVisible(true);
  }

  private moveGhostTo(tx: number, ty: number) {
    const type = store.ui.placing;
    if (!type) return;
    const n = BUILDINGS[type].size;
    const off = Math.floor((n - 1) / 2);
    const x = Phaser.Math.Clamp(tx - off, 0, MAP_SIZE - n);
    const y = Phaser.Math.Clamp(ty - off, 0, MAP_SIZE - n);
    const g = store.ui.ghost;
    if (!g || g.x !== x || g.y !== y) store.setGhost(x, y);
  }

  private click(wx: number, wy: number, mouse: boolean) {
    const t = worldToTile(wx, wy);
    if (store.ui.placing) {
      this.moveGhostTo(t.x, t.y);
      // Mouse: a left click places the building right away. Touch: tap to position, then press Build.
      if (mouse) store.confirmPlacement();
      return;
    }
    const hit = this.pickBuilding(wx, wy);
    if (hit !== null) {
      store.select(hit);
      return;
    }
    const b = buildingAt(store.state, t.x, t.y);
    store.select(b ? b.id : null);
  }

  /** Pixel-accurate hit test against building sprites (front-most first). */
  private pickBuilding(wx: number, wy: number): number | null {
    const views = [...this.views.values()].sort((a, b) => b.depth - a.depth);
    for (const v of views) {
      for (const spr of v.site ? [v.site, v.sprite] : [v.sprite]) {
        if (!spr.getBounds().contains(wx, wy)) continue;
        const lx = Math.floor(wx - (spr.x - spr.displayOriginX));
        const ly = Math.floor(wy - (spr.y - spr.displayOriginY));
        if ((this.textures.getPixelAlpha(lx, ly, spr.texture.key) ?? 0) > 40) return v.id;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ drawing helpers
  private diamondPath(g: Phaser.GameObjects.Graphics, x: number, y: number, n = 1) {
    const p = tileTop(x, y);
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x + HW * n, p.y + HH * n);
    g.lineTo(p.x, p.y + HH * 2 * n);
    g.lineTo(p.x - HW * n, p.y + HH * n);
    g.closePath();
  }

  private drawHover() {
    this.hover.clear();
    const t = this.hoverTile;
    if (!t || store.ui.placing || t.x < 0 || t.y < 0 || t.x >= MAP_SIZE || t.y >= MAP_SIZE) return;
    this.diamondPath(this.hover, t.x, t.y);
    this.hover.fillStyle(0xffffff, 0.12);
    this.hover.fillPath();
    this.hover.lineStyle(2, 0xffffff, 0.5);
    this.hover.strokePath();
  }

  private drawGhost() {
    const { placing, ghost } = store.ui;
    this.ghostCells.clear();
    if (!placing || !ghost) {
      this.ghost.setVisible(false);
      return;
    }
    const check = store.ghostCheck()!;
    for (const c of check.cells) {
      if (c.x < 0 || c.y < 0 || c.x >= MAP_SIZE || c.y >= MAP_SIZE) continue;
      this.diamondPath(this.ghostCells, c.x, c.y);
      const col = check.ok ? 0x3fdc7c : 0xff4d4d;
      this.ghostCells.fillStyle(col, 0.45);
      this.ghostCells.fillPath();
      this.ghostCells.lineStyle(2, col, 1);
      this.ghostCells.strokePath();
    }
    const n = BUILDINGS[placing].size;
    const moved = store.ui.moving !== null ? store.state.buildings.find((b) => b.id === store.ui.moving) : undefined;
    const info = TEX.get(texKey(placing, Math.max(1, moved?.level ?? 1), moved?.shield ?? 0))!;
    const c = footprintCenter(ghost.x, ghost.y, n);
    this.ghost.setTexture(info.key).setOrigin(0.5, info.originY).setPosition(c.x, c.y).setVisible(true);
    this.ghost.setTint(check.ok ? 0xffffff : 0xff8080);
  }

  private drawSelection(now: number) {
    this.selection.clear();
    const id = store.ui.selectedId;
    const b = id !== null ? store.state.buildings.find((x) => x.id === id) : undefined;
    if (!b) return;
    const n = BUILDINGS[b.type].size;
    this.diamondPath(this.selection, b.x, b.y, n);
    const a = 0.55 + 0.35 * Math.sin(now / 220);
    this.selection.fillStyle(0x7fe3ff, 0.18);
    this.selection.fillPath();
    this.selection.lineStyle(4, 0x7fe3ff, a);
    this.selection.strokePath();
  }

  // ------------------------------------------------------------------ sync with simulation
  private sync() {
    const s = store.state;
    const seen = new Set<number>();
    for (const b of s.buildings) {
      seen.add(b.id);
      let v = this.views.get(b.id);
      if (v && (v.tx !== b.x || v.ty !== b.y)) {
        // The building was moved: rebuild its visuals at the new tile.
        v.destroy();
        this.shadows.get(b.id)?.destroy();
        this.shadows.delete(b.id);
        this.views.delete(b.id);
        v = undefined;
      }
      if (!v) {
        v = new BuildingView(this, b);
        this.views.set(b.id, v);
        this.shadows.set(b.id, this.add.image(v.cx, v.cy, v.sprite.texture.key).setTint(0x000000).setDepth(SHADOW_DEPTH));
      }
      v.sync(b);
      const sh = this.shadows.get(b.id)!;
      if (sh.texture.key !== v.sprite.texture.key) sh.setTexture(v.sprite.texture.key);
      sh.setOrigin(v.sprite.originX, v.sprite.originY).setVisible(b.level > 0);
      // While a building is being moved, its old spot fades out.
      if (store.ui.moving === b.id) v.sprite.setAlpha(0.3);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.destroy();
        this.views.delete(id);
        this.shadows.get(id)?.destroy();
        this.shadows.delete(id);
      }
    }
    while (this.bots.length < s.builders) {
      const h = this.homeFor(this.bots.length);
      this.bots.push(new BuilderBot(this, h.x, h.y));
    }
    while (this.bots.length > s.builders) this.bots.pop()!.destroy();
    // Up to 8 crew members are drawn outside.
    const crewShown = Math.min(8, s.crew.count);
    while (this.crew.length < crewShown) this.crew.push(new Astronaut(this, this.crewHome(this.crew.length)));
    while (this.crew.length > crewShown) this.crew.pop()!.destroy();
    this.drawGhost();
    this.drawHover();
    this.refreshTooltip();
  }

  private homeFor(i: number) {
    const s = store.state;
    const station = s.buildings.find((b) => b.type === 'builderStation' && b.level > 0);
    const home = station ?? s.buildings.find((b) => b.type === 'command')!;
    const n = BUILDINGS[home.type].size;
    const c = footprintCenter(home.x, home.y, n);
    return { x: c.x - 40 + (i % 3) * 40, y: c.y + n * HH + 12 + Math.floor(i / 3) * 20 };
  }

  /** Airlock where crew member i goes in and out (CC for the first two, then habitats). */
  private crewHome(i: number) {
    const s = store.state;
    const habs = s.buildings.filter((b) => b.type === 'habitat' && b.level > 0);
    const home = i >= 2 && habs.length ? habs[(i - 2) % habs.length] : s.buildings.find((b) => b.type === 'command')!;
    const n = BUILDINGS[home.type].size;
    const c = footprintCenter(home.x, home.y, n);
    return { x: c.x + n * HW * 0.45, y: c.y + n * HH * 0.55 };
  }

  /** A random spot near a working building, for an EVA stroll. */
  private evaTarget() {
    const s = store.state;
    const list = s.buildings.filter((b) => b.level > 0);
    const b = list[Math.floor(Math.random() * list.length)];
    const n = BUILDINGS[b.type].size;
    const c = footprintCenter(b.x, b.y, n);
    const a = Math.random() * Math.PI * 2;
    const r = n * HW * (0.75 + Math.random() * 0.5);
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.5 + n * HH * 0.2 };
  }

  private leaveFootprint(x: number, y: number, flip: boolean) {
    let img: Phaser.GameObjects.Image;
    if (this.steps.length >= MAX_STEPS) {
      img = this.steps.shift()!;
      img.setPosition(x, y);
    } else img = this.add.image(x, y, 'step').setDepth(0.9);
    img.setAlpha(0.7).setFlipX(flip);
    this.steps.push(img);
  }

  /** Monitoring links: cables on the ground, radio beams in the air, with data packets flowing when active. */
  private drawNetwork(time: number) {
    const s = store.state;
    const g = this.cables;
    const air = this.beams;
    g.clear();
    air.clear();
    const ops = opsCenter(s);
    if (!ops) return;
    const oc = footprintCenter(ops.x, ops.y, 2);
    for (const n of networkStatus(s)) {
      const st = n.station;
      if (!st.link) continue;
      const sc = footprintCenter(st.x, st.y, 1);
      const color = n.active ? (n.quality >= 0.5 ? 0x7fe3ff : 0xffa53c) : 0xff4d4d;
      if (st.link === 'wired') {
        const a = { x: sc.x, y: sc.y + 8 };
        const b = { x: oc.x, y: oc.y + 20 };
        g.lineStyle(5, 0x141826, 0.55).lineBetween(a.x + 2, a.y + 2, b.x + 2, b.y + 2);
        g.lineStyle(3, n.active ? 0x2b3346 : 0x5a2a2a, 1).lineBetween(a.x, a.y, b.x, b.y);
        if (n.active) {
          for (let k = 0; k < 3; k++) {
            const p = ((time / 1400 + k / 3) % 1);
            g.fillStyle(0x7fe3ff, 0.9).fillCircle(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, 3);
          }
        }
      } else {
        const a = { x: sc.x + 6, y: sc.y - 90 - st.level * 14 };
        const b = { x: oc.x + 20, y: oc.y - 110 };
        const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 60 };
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(b.x, b.y));
        const pts = curve.getPoints(24);
        // Dashed arc
        air.lineStyle(2, color, n.active ? 0.55 : 0.35);
        for (let i = 0; i < pts.length - 1; i += 2) air.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        if (n.active && n.quality >= 0.5) {
          for (let k = 0; k < 2; k++) {
            const p = curve.getPoint((time / 1100 + k / 2) % 1);
            air.fillStyle(0xffffff, 0.95).fillCircle(p.x, p.y, 3);
            air.fillStyle(color, 0.35).fillCircle(p.x, p.y, 7);
          }
        }
      }
    }
  }

  update(time: number, delta: number) {
    if (this.dirty) {
      this.dirty = false;
      this.sync();
    }
    const s = store.state;
    const dt = Math.min(0.1, delta / 1000);
    const cam = this.cameras.main;
    const paused = store.speed === 0;

    if (this.reportReady) {
      this.reportReady = false;
      // Emit after this frame renders, so the map is really on screen.
      this.game.events.once('postrender', () => this.game.events.emit('map-ready'));
    }

    // Keyboard pan (WASD / arrows) and zoom (Q / E), only while actually playing.
    const k = this.keys;
    const playing = store.screen === 'game';
    const pan = playing ? (700 * dt) / cam.zoom : 0;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= pan;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += pan;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= pan;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += pan;
    if (playing && k.Q.isDown) this.zoomBy(1 - 1.4 * dt);
    if (playing && k.E.isDown) this.zoomBy(1 + 1.4 * dt);

    // Title screen: a slow, cinematic drift across the base.
    if (store.screen === 'title') cam.scrollX += 14 * dt;

    // Inertia after a drag
    if (!this.downAt && this.velocity.lengthSq() > 0.01) {
      cam.scrollX -= this.velocity.x;
      cam.scrollY -= this.velocity.y;
      this.velocity.scale(Math.pow(0.0025, dt));
    }

    // Day / night. With no atmosphere the sky stays black; only the ground light changes.
    const sun = s.flows.sunlight;
    const dark = 1 - sun;
    this.night.setFillStyle(mix(0xffffff, 0x2c3a78, dark * 0.82));
    const flare = s.flare && s.time >= s.flare.start && s.time < s.flare.end;
    if (flare && !store.profile.settings.reduceMotion) this.night.setFillStyle(mix(0xffffff, 0xff9a66, 0.25 + 0.1 * Math.sin(time / 120)));

    // Long, sharp shadows that swing with the sun across the lunar day.
    const p = Math.min(1, cyclePos(s) / dayLength(s));
    const rot = (p - 0.5) * 2.2;
    const len = 0.32 + 0.9 * Math.pow(1 - Math.sin(p * Math.PI), 1.4);
    const alpha = 0.3 * sun;
    for (const [id, sh] of this.shadows) {
      const v = this.views.get(id)!;
      sh.setPosition(v.sprite.x, v.sprite.y).setScale(v.sprite.scaleX, -len * v.sprite.scaleY).setRotation(rot).setAlpha(this.lowGfx ? 0 : alpha);
    }
    for (const c of this.propCasters) c.sh.setScale(c.src.scaleX, -len * c.src.scaleY).setRotation(rot).setAlpha(alpha);

    for (const b of s.buildings) this.views.get(b.id)?.update(b, s, dark, time);
    this.drawNetwork(time);
    this.drawSelection(time);

    const simDt = dt * Math.max(1, store.speed);
    // Builder robots go to their job sites, otherwise park at home.
    this.bots.forEach((bot, i) => {
      const job = s.buildings.find((b) => b.job?.builder === i);
      if (job) {
        const n = BUILDINGS[job.type].size;
        const c = footprintCenter(job.x, job.y, n);
        bot.update(c.x + (i % 2 ? 26 : -26), c.y + n * HH * 0.55, true, simDt, time);
      } else {
        const h = this.homeFor(i);
        bot.update(h.x, h.y, false, simDt, time);
      }
    });

    // Crew go on EVA in daylight and take shelter at night or when a flare is coming.
    const outside = isDay(s) && sun > 0.3 && !s.flare && !paused;
    this.crew.forEach((a, i) => {
      const landed = a.update(paused ? 0 : dt, outside && i % 3 !== 2, this.crewHome(i), () => this.evaTarget());
      if (landed && !this.lowGfx) this.leaveFootprint(landed.x, landed.y, a.sprite.flipX);
    });
    // Footprints fade slowly (on the real Moon they would last for ages).
    if (Math.floor(time / 500) !== Math.floor((time - delta) / 500)) {
      for (const st of this.steps) st.setAlpha(Math.max(0.18, st.alpha - 0.004));
    }

    this.rover.update(paused ? 0 : dt, !paused && sun > 0.1);

    // Sunlight glinting off ice crystals
    this.glintTimer -= dt;
    if (!this.lowGfx && this.glintTimer <= 0 && this.iceSpots.length && sun > 0.2) {
      this.glintTimer = 0.18;
      const spot = this.iceSpots[Math.floor(Math.random() * this.iceSpots.length)];
      const g = this.add.image(spot.x + (Math.random() - 0.5) * 70, spot.y + (Math.random() - 0.5) * 30, 'glint')
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.95).setScale(0).setAlpha(0.9);
      this.tweens.add({ targets: g, scale: 0.7 + Math.random() * 0.5, duration: 260, yoyo: true, ease: 'Sine.Out', onComplete: () => g.destroy() });
    }
  }
}
