// @ts-check
import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';

// https://astro.build/config
export default defineConfig({
  site: 'https://hu-ja-ja.github.io',
  base: '/BitCraft_Map_Link_Generator',
  output: 'static',
  integrations: [solidJs()],
});