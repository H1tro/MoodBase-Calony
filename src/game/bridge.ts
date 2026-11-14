import type Phaser from 'phaser';
import type { MoonScene } from './scenes/MoonScene';

/** Thin bridge so React controls can reach the running Phaser game. */
let game: Phaser.Game | null = null;
const previews = new Map<string, string>();
const readyListeners = new Set<() => void>();

export function setGame(g: Phaser.Game | null) {
  game = g;
  previews.clear();
  // Handy for debugging in the browser console during development.
  if (import.meta.env.DEV) (window as unknown as { __game: unknown }).__game = g;
}

export function notifyTexturesReady() {
  for (const l of readyListeners) l();
}

export function onTexturesReady(l: () => void) {
  readyListeners.add(l);
  return () => {
    readyListeners.delete(l);
  };
}

/**
 * Rebuild the map for the current colony (terrain depends on difficulty).
 * Resolves only after MoonScene has created everything and rendered its first frame.
 */
export function rebuildMap(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const g = game;
    if (!g) return reject(new Error('The renderer has not started yet.'));
    const timer = setTimeout(() => {
      g.events.off('map-ready', onReady);
      reject(new Error('The map took too long to build. Try again, or close other heavy browser tabs.'));
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    g.events.once('map-ready', onReady);
    // If the map scene is already running, restart it; otherwise it will start (and report) after boot.
    if (g.scene.isActive('moon') || g.scene.isPaused('moon')) g.scene.getScene('moon').scene.restart();
  });
}

export function zoomBy(factor: number) {
  const scene = game?.scene.getScene('moon') as MoonScene | undefined;
  scene?.zoomBy(factor);
}

/** PNG data URL of a generated texture, for building cards in the React UI. */
export function texturePreview(key: string): string | null {
  if (!game || !game.textures.exists(key)) return null;
  const hit = previews.get(key);
  if (hit) return hit;
  const src = game.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const url = cropToContent(src);
  if (url) previews.set(key, url);
  return url;
}

/** Trim transparent margins so the building fills its card. */
function cropToContent(src: HTMLCanvasElement | HTMLImageElement): string | null {
  const w = src.width;
  const h = src.height;
  if (!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  const cw = Math.min(w, x1 + pad) - x0;
  const ch = Math.min(h, y1 + pad) - y0;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  return out.toDataURL('image/png');
}

/** On narrow screens only one side panel may be open at a time. */
export function announcePanelOpen(name: string) {
  window.dispatchEvent(new CustomEvent('side-panel-open', { detail: name }));
}
