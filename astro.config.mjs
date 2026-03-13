// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

import solidJs from '@astrojs/solid-js';

const isVercelBuild = /** @type {any} */ (globalThis).process?.env?.VERCEL === '1';

// https://astro.build/config
export default defineConfig(
  isVercelBuild
    ? {
        site: 'https://bitcraft-map-link-generator.vercel.app',
        output: 'server',
        adapter: vercel(),
        integrations: [solidJs()],
      }
    : {
        site: 'https://hu-ja-ja.github.io',
        base: '/BitCraft_Map_Link_Generator',
        output: 'static',
        integrations: [solidJs()],
      }
);