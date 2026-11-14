import type Phaser from 'phaser';
import { Painter } from './painter';
import { makeRng } from '../../utils/rng';
import { shade } from './iso';

function bake(scene: Phaser.Scene, key: string, w: number, h: number, ox: number, oy: number, draw: (P: Painter) => void) {
  const g = scene.add.graphics();
  draw(new Painter(g, ox, oy));
  g.generateTexture(key, w, h);
  g.destroy();
}

export function generatePropTextures(scene: Phaser.Scene) {
  // Builder robot: yellow body, treads, arm, cyan eye.
  bake(scene, 'bot', 56, 64, 28, 50, (P) => {
    P.ellipse(0, 0, 20, 9, 0x000000, 0.3);
    P.box(0, 0, 0.26, 0.18, 8, 0x2b2f3a);
    P.box(0, 0, 0.2, 0.16, 18, 0xf2b705, 8, 0xffd23f);
    P.dome(0, 0, 9, 9, 0xf2b705, 26, 8);
    const [x, y] = P.p(0.06, 0.06, 30);
    P.g.fillStyle(0x7fe3ff, 1);
    P.g.fillCircle(x, y, 2.5);
    P.line(P.p(0.1, -0.04, 20), P.p(0.22, -0.08, 30), 0x8c95a6, 3);
  });

  // Rocket (sits on the spaceport pad)
  bake(scene, 'rocket', 70, 190, 35, 180, (P) => {
    P.ellipse(0, 0, 26, 12, 0x000000, 0.3);
    // Fins
    for (const dx of [-20, 20]) {
      const [x, y] = P.p(0, 0, 0);
      P.poly([[x + dx * 0.4, y - 40], [x + dx, y - 2], [x + dx * 0.4, y - 10]], 0xe63946, 1, 0.6);
    }
    P.lathe(0, 0, [[14, 0], [16, 10], [16, 100], [14, 120], [8, 140], [0, 156]], 0xe8edf3, 0, 10, [0xe8edf3, 0xe8edf3, 0xe8edf3, 0xe63946, 0xe63946]);
    P.lathe(0, 0, [[16.5, 60], [16.5, 70]], 0x2b6cb0, 0, 10);
    const [x, y] = P.p(0, 0, 100);
    P.g.fillStyle(0x7fe3ff, 1);
    P.g.fillCircle(x - 4, y, 4);
    P.g.lineStyle(1.5, 0x141826, 0.7);
    P.g.strokeCircle(x - 4, y, 4);
  });

  // Boulders
  for (let i = 0; i < 3; i++) {
    const rng = makeRng(400 + i);
    bake(scene, `boulder_${i}`, 140, 110, 70, 80, (P) => {
      P.ellipse(0.1, 0.1, 50, 22, 0x000000, 0.3);
      const pts: [number, number][] = [];
      const n = 8;
      for (let k = 0; k < n; k++) {
        const a = Math.PI + (k / (n - 1)) * Math.PI;
        const r = 36 + rng() * 14;
        pts.push([70 + Math.cos(a) * r * 1.1, 80 + Math.sin(a) * r * (0.9 + rng() * 0.4) - 6]);
      }
      const base: [number, number][] = [[70 + 42, 80], [70, 98], [70 - 42, 80]];
      P.poly([...pts, ...base], 0x7d808a, 1, 0.8);
      // Facets
      const apex: [number, number] = [70 - 6 + rng() * 12, 80 - 30];
      for (let k = 0; k < pts.length - 1; k++) {
        const c = shade(0x8e919b, 0.75 + (k / pts.length) * 0.6 * (k < pts.length / 2 ? 1.3 : 0.7));
        P.poly([pts[k], pts[k + 1], apex], c, 1, 0.4);
      }
      P.poly([pts[pts.length - 1], base[0], base[1], apex], 0x5f636e, 1, 0.5);
      P.poly([base[1], base[2], pts[0], apex], 0x9a9da6, 1, 0.5);
    });
  }

  // Soft round glow (night lights) and particle dot
  const glow = scene.textures.createCanvas('glow', 64, 64);
  if (glow) {
    const ctx = glow.getContext();
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    glow.refresh();
  }
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.generateTexture('dot', 16, 16);
  g.clear();
  // "No power" badge
  g.fillStyle(0x141826, 1);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0xff4d4d, 1);
  g.fillCircle(16, 16, 13);
  g.fillStyle(0xffffff, 1);
  g.fillPoints([{ x: 18, y: 5 }, { x: 10, y: 18 }, { x: 15, y: 18 }, { x: 13, y: 27 }, { x: 22, y: 13 }, { x: 17, y: 13 }], true);
  g.generateTexture('nopower', 32, 32);
  g.clear();
  // Paused (switched off) badge
  g.fillStyle(0x141826, 1);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0x8c95a6, 1);
  g.fillCircle(16, 16, 13);
  g.fillStyle(0xffffff, 1);
  g.fillRect(10, 9, 4, 14);
  g.fillRect(18, 9, 4, 14);
  g.generateTexture('switchedoff', 32, 32);
  g.destroy();
  generateSurfaceProps(scene);
}

/** Props that make the surface feel lived-in: crew, rover, lander, flag, footprints, glints, regolith grain. */
function generateSurfaceProps(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  const OUT = 0x141826;

  // Astronaut (28×40, feet at 14,37): white suit, gold visor, life-support backpack.
  g.fillStyle(0x000000, 0.3).fillEllipse(14, 37, 16, 6);
  g.fillStyle(0x9aa5b8, 1).fillRoundedRect(4, 12, 14, 15, 3); // backpack
  g.lineStyle(1, OUT, 0.8).strokeRoundedRect(4, 12, 14, 15, 3);
  g.fillStyle(0xd9dee6, 1).fillRect(9, 26, 4, 9).fillRect(15, 26, 4, 9); // legs
  g.fillStyle(0x4a5366, 1).fillRect(8, 34, 6, 3).fillRect(14, 34, 6, 3); // boots
  g.fillStyle(0xf1f4f8, 1).fillRoundedRect(8, 13, 13, 15, 4); // torso
  g.lineStyle(1, OUT, 0.8).strokeRoundedRect(8, 13, 13, 15, 4);
  g.fillStyle(0xff7a29, 1).fillRect(8, 19, 13, 2); // mission stripe
  g.fillStyle(0xe8edf3, 1).fillRect(20, 15, 4, 10); // arm
  g.fillStyle(0xf1f4f8, 1).fillCircle(15, 9, 7); // helmet
  g.lineStyle(1, OUT, 0.8).strokeCircle(15, 9, 7);
  g.fillStyle(0xffc93c, 1).fillEllipse(17, 9, 9, 7); // visor
  g.fillStyle(0xffffff, 0.8).fillEllipse(15, 7, 3, 2);
  g.generateTexture('astro', 28, 40);
  g.clear();

  // Footprint pair
  g.fillStyle(0x3a3d46, 0.55).fillEllipse(3, 3, 5, 3).fillEllipse(9, 5, 5, 3);
  g.generateTexture('step', 12, 8);
  g.clear();

  // Four-point glint for ice crystals
  g.fillStyle(0xffffff, 1);
  g.fillPoints([{ x: 8, y: 0 }, { x: 9.5, y: 6.5 }, { x: 16, y: 8 }, { x: 9.5, y: 9.5 }, { x: 8, y: 16 }, { x: 6.5, y: 9.5 }, { x: 0, y: 8 }, { x: 6.5, y: 6.5 }], true);
  g.generateTexture('glint', 16, 16);
  g.clear();

  // Flag (no wind on the Moon, so the banner hangs from a horizontal rod)
  g.fillStyle(0x000000, 0.3).fillEllipse(6, 66, 12, 4);
  g.fillStyle(0xc9d3e6, 1).fillRect(5, 6, 2, 60).fillRect(5, 6, 30, 2);
  g.fillStyle(0x2563c4, 1).fillRect(7, 8, 28, 18);
  g.fillStyle(0xffc93c, 1).fillCircle(21, 17, 6);
  g.fillStyle(0x2563c4, 1).fillCircle(24, 15, 5);
  g.lineStyle(1, OUT, 0.7).strokeRect(7, 8, 28, 18);
  g.generateTexture('flag', 40, 70);
  g.destroy();

  // Lunar rover: six wheels, deck, high-gain antenna, small solar panel.
  bake(scene, 'rover', 84, 60, 42, 46, (P) => {
    P.ellipse(0, 0, 34, 12, 0x000000, 0.3);
    for (const [u, v] of [[-0.22, 0.14], [0, 0.14], [0.22, 0.14]] as const) P.cylinder(u, v + 0.05, 6, 4, 0x2b2f3a, 0, 8);
    P.box(0, 0, 0.62, 0.32, 9, 0xd9dee6, 6, 0xeef2f7);
    P.box(-0.12, -0.02, 0.2, 0.2, 7, 0xff7a29, 15);
    P.flat(0.14, 0, 0.3, 0.3, 17, 0x1b4fa8, 1, 0.6);
    P.line(P.p(-0.22, -0.08, 22), P.p(-0.22, -0.08, 40), 0x9aa5b8, 2);
    const [x, y] = P.p(-0.22, -0.08, 42);
    P.g.fillStyle(0xdfe7f2, 1).fillEllipse(x, y, 14, 9);
    for (const [u, v] of [[-0.22, -0.18], [0, -0.18], [0.22, -0.18]] as const) P.cylinder(u, v, 6, 4, 0x2b2f3a, 0, 8);
  });

  // Descent stage left behind by the first landing: gold foil, four legs.
  bake(scene, 'lander', 150, 130, 75, 104, (P) => {
    P.ellipse(0.1, 0.1, 62, 24, 0x000000, 0.3);
    const legs: [number, number][] = [[-0.55, 0], [0, -0.55], [0.55, 0], [0, 0.55]];
    for (const [u, v] of legs.slice(0, 2)) {
      P.line(P.p(u * 0.5, v * 0.5, 36), P.p(u, v, 2), 0x9aa5b8, 3);
      P.ellipse(u, v, 9, 4, 0x6b7487, 1);
    }
    P.lathe(0, 0, [[34, 0], [34, 26], [26, 32]], 0xd4a017, 18, 8, [0xd4a017, 0xe8c04a, 0xe8c04a]);
    P.lathe(0, 0, [[34, 10], [34, 14]], 0x2b2f3a, 18, 8);
    for (const [u, v] of legs.slice(2)) {
      P.line(P.p(u * 0.5, v * 0.5, 36), P.p(u, v, 2), 0x9aa5b8, 3);
      P.ellipse(u, v, 9, 4, 0x6b7487, 1);
    }
    // Ladder
    P.line(P.p(0.18, 0.4, 20), P.p(0.3, 0.55, 2), 0xc9d3e6, 2);
    P.line(P.p(0.26, 0.34, 20), P.p(0.38, 0.49, 2), 0xc9d3e6, 2);
  });

  // Regolith grain: fine noise tiled over the ground (multiply blend).
  const grain = scene.textures.createCanvas('grain', 256, 256);
  if (grain) {
    const ctx = grain.getContext();
    const img = ctx.createImageData(256, 256);
    const rng = makeRng(31337);
    for (let i = 0; i < 256 * 256; i++) {
      let v = 205 + rng() * 50;
      if (rng() < 0.012) v = 120 + rng() * 40; // dark grains
      if (rng() < 0.006) v = 255; // glassy beads catch the sun
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v + 3;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grain.refresh();
  }
}
