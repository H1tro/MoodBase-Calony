import Phaser from 'phaser';
import { generateBuildingTextures } from '../art/drawBuildings';
import { generatePropTextures } from '../art/drawProps';
import { notifyTexturesReady } from '../bridge';

/** Generates every procedural texture once, then starts the visible scenes. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    generatePropTextures(this);
    generateBuildingTextures(this);
    notifyTexturesReady();
    this.scene.launch('background');
    this.scene.launch('moon');
    this.scene.stop();
  }
}
