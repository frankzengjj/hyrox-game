import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  // Phaser alone is ~1.2 MB minified; one chunk is fine for a game.
  build: { chunkSizeWarningLimit: 1600 },
});
