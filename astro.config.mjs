import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.wilcofin.com',
  integrations: [mdx(), sitemap()],
  output: 'static',
  adapter: vercel(),
  build: {
    format: 'file',
  },
  compressHTML: true,
});
