import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.wilcofin.com',
  integrations: [mdx(), sitemap()],
  // Every page stays static at build time; individual endpoints can opt
  // into server rendering by exporting `prerender = false`. The Vercel
  // adapter turns those endpoints into serverless functions — so the
  // site keeps its static-build performance with one dynamic /api/contact.
  output: 'static',
  adapter: vercel(),
  build: {
    format: 'file',
  },
  compressHTML: true,
});
