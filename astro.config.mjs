import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://www.wilcofin.com',
  integrations: [mdx(), sitemap()],
  build: {
    format: 'file',
  },
  compressHTML: true,
});
