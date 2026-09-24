import * as Phaser from 'phaser';
import { createAthleteTextures } from '../art/athleteTextures';
import { createEquipmentTextures } from '../art/equipmentTextures';
import { createVenueTextures } from '../art/venueTextures';
import { PLAYER_KIT } from '../art/palette';
import { DEBUG } from './flow';

/** Generates every texture in code (no image files), then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createAthleteTextures(this, 'player', PLAYER_KIT);
    createVenueTextures(this);
    createEquipmentTextures(this);
    const gallery = DEBUG && new URLSearchParams(window.location.search).has('gallery');
    this.scene.start(gallery ? 'Gallery' : 'Menu');
  }
}
