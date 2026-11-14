import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BackgroundScene } from './scenes/BackgroundScene';
import { MoonScene } from './scenes/MoonScene';
import { setGame } from './bridge';

/** Mounts the Phaser game full-screen behind the React HUD. */
export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // Never boot WebGL with a 0×0 canvas (framebuffer error); fall back to the window size.
    const width = Math.max(320, el.clientWidth || window.innerWidth);
    const height = Math.max(320, el.clientHeight || window.innerHeight);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      backgroundColor: '#02040a',
      width,
      height,
      scale: { mode: Phaser.Scale.RESIZE, width, height },
      scene: [BootScene, BackgroundScene, MoonScene],
      render: { antialias: true, roundPixels: false },
      input: { activePointers: 3 },
      disableContextMenu: true,
    });
    setGame(game);
    return () => {
      setGame(null);
      game.destroy(true);
    };
  }, []);

  return <div ref={host} className="absolute inset-0 touch-none select-none" />;
}
