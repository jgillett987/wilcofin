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
  // Astro 5's default CSRF check rejects any same-host POST whose Origin
  // doesn't exactly match `site` above — e.g. a visitor on wilcofin.com
  // (no www) posting to /api/contact would be blocked even though it's
  // technically same-site. We don't rely on cookies/sessions, so CSRF
  // protection isn't applicable here; spam is handled via the honeypot
  // and server-side validation.
  security: { checkOrigin: false },
  build: {
    format: 'file',
  },
  compressHTML: true,
});
