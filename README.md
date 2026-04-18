# Wilco Financial Website

Modern, AI- and SEO-optimized static website for **Wilco Financial, LLC** — a Tennessee-registered investment adviser based in Williamson County, serving individuals, families, and Southwest Airlines employees.

Built with [Astro 5](https://astro.build/). Deploys as plain static HTML — no server, no database, no PHP, no WordPress.

---

## Quick start

```bash
# Install dependencies (one time)
npm install

# Run the dev server (auto-reloads on edits)
npm run dev
# → open http://localhost:4321

# Build for production
npm run build
# → output in ./dist/

# Preview the production build locally
npm run preview
```

---

## How to add a new article

1. Create a new file in `src/content/articles/` with a URL-friendly name — e.g. `my-article-slug.md`. The filename (without `.md`) becomes the URL: `/articles/my-article-slug`.
2. Start the file with "frontmatter" — a small block of metadata between `---` lines:

   ```md
   ---
   title: "Your article title"
   description: "1–2 sentence summary for search engines and social shares."
   pubDate: 2026-04-17
   author: Wilco Financial
   tags: ["Retirement", "Taxes"]
   ---

   Your article text starts here. Plain [Markdown](https://www.markdownguide.org/basic-syntax/) — no HTML needed.

   ## Subheadings use two pound signs

   Bullet lists:
   - one thing
   - another thing

   **Bold text** and *italics* work as you'd expect. [Links too](/contact).
   ```
3. Save the file. If the dev server is running, the article appears immediately. If you're deploying, run `npm run build` and upload the new `dist/` folder.
4. **Optional frontmatter fields:**
   - `featured: true` — mark as featured (currently shown on the home page)
   - `draft: true` — hide from production (lets you stage work in progress)
   - `updatedDate: 2026-05-01` — show a "last updated" date
   - `heroImage: "/path/to/image.jpg"` — hero image for the article

---

## How to add a new FAQ

1. Create a new file in `src/content/faqs/` — e.g. `my-faq.md`.
2. Frontmatter + answer:

   ```md
   ---
   question: "How does Wilco handle tax-loss harvesting?"
   category: "Services"
   order: 95
   ---

   Answer text here in plain Markdown.
   ```
3. `category` controls grouping on the FAQ page (existing categories: `Working With Us`, `Fees`, `Southwest Airlines`, `Services`). Use one of those or create a new one.
4. `order` controls sort order within a category — lower numbers appear first.
5. The FAQ is automatically included on `/faq` and in the page's JSON-LD structured data (so AI and search engines see it as a proper FAQ).

---

## How to edit contact info, fees, or nav

All core business data lives in one file: **`src/consts.ts`**.

Open it and edit:
- `SITE` — business name, tagline, descriptions, the advisory fee
- `CONTACT` — phone, email, address, Calendly URL, hours
- `NAV` — top navigation menu structure
- `DISCLOSURE` — the regulatory disclosure footer text

Change once, it updates everywhere (footer, structured data, all pages that reference it).

---

## File structure

```
Wilco Website/
├── src/
│   ├── components/       ← Reusable pieces (Nav, Footer, SEO, CTA)
│   ├── content/
│   │   ├── articles/     ← ★ Add articles here (.md files)
│   │   └── faqs/         ← ★ Add FAQs here (.md files)
│   ├── layouts/          ← Page wrappers (BaseLayout, PageLayout)
│   ├── pages/            ← Every .astro file here becomes a page
│   │   ├── index.astro          → /
│   │   ├── about.astro          → /about
│   │   ├── services/            → /services/*
│   │   └── ...
│   ├── styles/global.css ← All site styling
│   └── consts.ts         ← ★ Business info, nav, fees (edit here!)
├── public/               ← Static files served as-is
│   ├── logo.svg
│   ├── robots.txt
│   └── llms.txt          ← Site summary for AI crawlers
├── dist/                 ← Build output (what to upload to your host)
├── astro.config.mjs
├── package.json
└── README.md
```

---

## SEO & AI optimization — what's already built in

This site is engineered to be as discoverable as possible to both search engines and AI assistants (ChatGPT, Claude, Perplexity, Google's AI Overviews, etc.).

### Static HTML
Every page is plain HTML — no JavaScript required to read content. Search crawlers and AI scrapers see the full text immediately.

### Structured data (JSON-LD / Schema.org)
Every page includes JSON-LD that tells machines exactly what the page is:
- **`FinancialService` + `Organization`** on every page — name, address, phone, area served, services offered, and a description.
- **`FAQPage`** on the FAQ page and the SWA page.
- **`Article`** on each article — headline, publish date, modified date, author.
- **`BreadcrumbList`** on every sub-page.

You can verify these at <https://validator.schema.org/> after you deploy.

### Open Graph & Twitter Cards
Every page includes proper OG and Twitter meta tags. Links posted to Facebook, Twitter/X, LinkedIn, iMessage, etc. render with a title, description, and image.

### Canonical URLs, sitemaps, RSS
- `sitemap-index.xml` — auto-generated, lists every page
- `rss.xml` — auto-generated from your articles (submit to feed readers)
- Canonical `<link rel="canonical">` on every page

### llms.txt — the AI crawler index
A new emerging standard specifically for AI crawlers. Located at `/llms.txt`, it's a Markdown summary of the site that AI models can ingest as a compact ground truth. Update it when you add or substantially change pages.

### robots.txt
Explicitly welcomes AI crawlers (GPTBot, ClaudeBot, PerplexityBot, anthropic-ai, CCBot, Google-Extended) in addition to traditional search. You can restrict this later if you want.

### Local SEO
- `geo.region` and `geo.placename` meta tags
- `PostalAddress` in structured data with the exact office address
- Embedded Google map on the contact page

---

## Design system

- **Colors:** Navy `#011342` · Green `#81c460` · Soft background `#f7f9fc` — matches the original brand palette
- **Typography:** System sans-serif for body (fast, readable), Georgia serif for headings (professional, traditional)
- **Layouts:** Responsive down to mobile, accessible, minimal JavaScript
- All styling is hand-written CSS in `src/styles/global.css` — no frameworks to update, no framework churn

---

## What changed from the old site

- Removed the fake Lorem ipsum testimonials (can't use testimonials anyway per RIA marketing rules)
- Replaced the Bootstrap+jQuery stack with modern static HTML (Bootstrap, jQuery, OwlCarousel all gone)
- Consolidated 20+ repetitive HTML files into a Markdown content system
- Added: SWA Pilots page, Articles system, real FAQ with structured data, llms.txt, RSS, sitemap, JSON-LD, proper OG tags, privacy/terms pages
- All typos fixed (`estate-plane` → `estate-planning`, `retirment` → `retirement`, `charitable-planing` → `charitable-planning`, `finantial-services` → `financial-planning`)
- One source of truth for contact/fees/nav — edit once, updates everywhere
- No hidden fees — the fee page now does the math in both directions

---

## Deploying

The build output is **plain static HTML in `./dist/`**. It works on any static host. Cheapest and fastest options:

| Host | Cost | Notes |
|------|------|-------|
| **Cloudflare Pages** | Free | Fastest global CDN; free unlimited bandwidth; GitHub integration |
| **Netlify** | Free tier | Easy form handling, atomic deploys, good analytics |
| **Vercel** | Free tier | Similar to Netlify, owned by the Next.js company |
| **GitHub Pages** | Free | Simplest if you're on GitHub already |
| **Your current host** | $$ | Just upload `dist/` contents via SFTP |

### Cloudflare Pages (recommended)

1. Push this folder to a GitHub repository.
2. Go to pages.cloudflare.com → Create project → Connect to GitHub → select the repo.
3. Build command: `npm run build`. Build output directory: `dist`.
4. In the project settings, add your custom domain `wilcofin.com`. Cloudflare handles SSL automatically.

### Netlify

1. Push to GitHub.
2. `netlify.com` → Add new site → Import an existing project.
3. Build command: `npm run build`. Publish directory: `dist`.
4. Add domain; Netlify handles SSL.

---

## Compliance notes

- The regulatory disclosure in `src/consts.ts` (`DISCLOSURE`) appears in the footer of every page.
- The SWA/SWAPA disclaimer appears on `/southwest-airlines` and in `/terms`.
- **Do not add testimonials, client names, or performance numbers** without first clearing them against current RIA marketing rule requirements.
- Run your Form ADV review every time you meaningfully change service descriptions or fees.

---

## Next steps / ideas

- Swap in real photos of the office, the advisor(s), or Nashville/Williamson County
- Add a proper OG image (`public/og-default.png`, 1200×630) for nicer social previews
- Wire the contact form to a real backend (Netlify Forms, Formspree, or a Cloudflare Worker)
- Add a newsletter signup that actually collects addresses (ConvertKit, Buttondown, MailerLite)
- Set up Google Analytics 4 or a privacy-respecting alternative (Plausible, Fathom)
- Add more articles — every article expands your SEO footprint and gives AI more to cite
