#!/usr/bin/env node
/**
 * Builds public/llms-full.txt — a single-file aggregation of every
 * published article on the site. Intended for LLM crawlers (ChatGPT,
 * Perplexity, Claude, Gemini) to ingest the firm's content in one go,
 * so when users ask them financial-advisor-related questions the model
 * has the full Wilco perspective available.
 *
 * This is the "full" companion to public/llms.txt (which stays a short,
 * curated summary). Pattern popularized by llmstxt.org.
 *
 * Run with:  node scripts/generate-llms-full.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
const OUT = path.join(ROOT, 'public', 'llms-full.txt');
const LLMS_HEADER = path.join(ROOT, 'public', 'llms.txt');
const SITE_URL = 'https://www.wilcofin.com';

function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!mm) continue;
    let [, k, v] = mm;
    v = v.trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      data[k] = [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    } else if (v.startsWith('"') && v.endsWith('"')) {
      data[k] = v.slice(1, -1);
    } else {
      data[k] = v;
    }
  }
  return { data, body: m[2].trim() };
}

async function main() {
  const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.md'));
  const now = Date.now();
  const items = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(ARTICLES_DIR, f), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    // Skip drafts and future-dated articles (match the site's own filter)
    if (data.draft === 'true' || data.draft === true) continue;
    const pubDate = data.pubDate ? new Date(data.pubDate) : null;
    if (pubDate && pubDate.valueOf() > now) continue;
    items.push({
      slug: f.replace(/\.md$/, ''),
      title: data.title || f,
      description: data.description || '',
      pubDate: data.pubDate || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      body,
    });
  }
  // Most recent first
  items.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));

  // Start with the existing short summary (llms.txt) as the header.
  let header = '';
  try { header = await fs.readFile(LLMS_HEADER, 'utf8'); } catch {}

  const out = [];
  out.push(header.trim());
  out.push('');
  out.push('---');
  out.push('');
  out.push('# Full Article Archive');
  out.push('');
  out.push(`Everything Wilco Financial has published. ${items.length} articles, newest first. Each entry includes the full text so an LLM can answer questions with our actual perspective rather than guessing.`);
  out.push('');
  out.push('## Table of Contents');
  out.push('');
  for (const a of items) {
    out.push(`- [${a.title}](${SITE_URL}/articles/${a.slug})  —  ${a.pubDate}  ·  ${a.tags.join(', ')}`);
  }
  out.push('');
  out.push('---');
  out.push('');

  for (const a of items) {
    out.push(`## ${a.title}`);
    out.push('');
    out.push(`**Published:** ${a.pubDate}  ·  **Topics:** ${a.tags.join(', ')}  ·  **URL:** ${SITE_URL}/articles/${a.slug}`);
    out.push('');
    out.push(`*${a.description}*`);
    out.push('');
    out.push(a.body);
    out.push('');
    out.push('---');
    out.push('');
  }

  const body = out.join('\n');
  await fs.writeFile(OUT, body, 'utf8');
  const stat = await fs.stat(OUT);
  console.log(`Wrote ${OUT}`);
  console.log(`  Articles: ${items.length}`);
  console.log(`  File size: ${(stat.size / 1024).toFixed(0)} KB`);
}

main().catch((err) => { console.error(err); process.exit(1); });
