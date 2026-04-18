#!/usr/bin/env node
// Local article editor. Run `npm run edit` then visit http://localhost:4322
// Lets you list/edit/save articles in src/content/articles with a visual
// hero-image picker sourced from public/images. Local-only, never deployed.

import http from 'node:http';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseQS } from 'node:querystring';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const PORT = 4322;

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Very light YAML frontmatter parser (just enough for our fields)
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
      // array of quoted strings
      data[k] = [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    } else if (v.startsWith('"') && v.endsWith('"')) {
      data[k] = v.slice(1, -1);
    } else {
      data[k] = v;
    }
  }
  return { data, body: m[2] };
}

function stringifyFrontmatter(data, body) {
  const order = ['title', 'description', 'pubDate', 'daysAgo', 'author', 'tags', 'heroImage', 'heroVideo', 'draft'];
  const keys = [...new Set([...order.filter((k) => k in data), ...Object.keys(data)])];
  const lines = ['---'];
  for (const k of keys) {
    const v = data[k];
    if (v === undefined || v === '' || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((x) => `"${x}"`).join(', ')}]`);
    } else if (k === 'pubDate') {
      lines.push(`${k}: ${v}`);
    } else if (k === 'daysAgo' || k === 'draft') {
      lines.push(`${k}: ${v}`);
    } else if (typeof v === 'string' && (v.includes(':') || v.includes('"') || v.includes("'"))) {
      // quote strings with special chars
      lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${k}: "${v}"`);
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n') + body.replace(/^\r?\n/, '');
}

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
async function listImages() {
  const files = await fs.readdir(IMAGES_DIR);
  return files.filter((f) => IMG_EXT.test(f)).sort();
}

async function listArticles() {
  const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.md'));
  const out = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(ARTICLES_DIR, f), 'utf8');
    const { data } = parseFrontmatter(raw);
    out.push({ slug: f.replace(/\.md$/, ''), title: data.title || f, heroImage: data.heroImage || '', pubDate: data.pubDate || '' });
  }
  out.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  return out;
}

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:0;color:#1a2238;background:#f7f9fc}
  header{background:#011342;color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
  header a{color:#a2e37d;text-decoration:none;font-weight:600}
  main{max-width:1100px;margin:0 auto;padding:24px}
  h1{font-family:Georgia,serif;margin:0 0 16px;color:#011342}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05)}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #e5e9f2;vertical-align:middle}
  th{background:#eef2f8;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em}
  tr:last-child td{border-bottom:none}
  .thumb{width:64px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #e5e9f2}
  .btn{display:inline-block;padding:8px 16px;background:#81c460;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;border:none;cursor:pointer;font-size:.9rem}
  .btn:hover{background:#6aad4a}
  .btn-secondary{background:#fff;color:#011342;border:1px solid #011342}
  form label{display:block;margin:14px 0 4px;font-weight:600;font-size:.9rem}
  form input[type=text],form input[type=date],form textarea{width:100%;padding:8px 10px;border:1px solid #d7dce7;border-radius:6px;font-family:inherit;font-size:.95rem;box-sizing:border-box}
  form textarea{min-height:320px;font-family:ui-monospace,Menlo,monospace;font-size:13px}
  .img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;max-height:420px;overflow:auto;border:1px solid #d7dce7;border-radius:8px;padding:10px;background:#fff}
  .img-grid label{display:block;cursor:pointer;position:relative;margin:0;font-weight:400}
  .img-grid img{width:100%;height:90px;object-fit:cover;border-radius:4px;border:2px solid transparent;display:block}
  .img-grid input{position:absolute;top:6px;left:6px}
  .img-grid input:checked + img{border-color:#81c460;box-shadow:0 0 0 2px #81c460}
  .img-grid .name{font-size:.7rem;color:#5a6582;word-break:break-all;margin-top:2px;text-align:center}
  .actions{margin-top:20px;display:flex;gap:10px}
  .flash{background:#d8f0c6;border:1px solid #81c460;padding:10px 14px;border-radius:6px;margin-bottom:16px;color:#2d5016}
</style></head><body>
<header><div><strong>Wilco Article Editor</strong> <span style="opacity:.6;font-size:.85rem">· local</span></div><a href="/">All articles</a></header>
<main>${body}</main></body></html>`;
}

async function renderIndex(flash = '') {
  const arts = await listArticles();
  const rows = arts.map((a) => `
    <tr>
      <td>${a.heroImage ? `<img class="thumb" src="${esc(a.heroImage)}?p=${esc(String(Date.now()))}" alt="">` : ''}</td>
      <td><strong>${esc(a.title)}</strong><br><span style="color:#5a6582;font-size:.85rem">${esc(a.slug)}</span></td>
      <td style="color:#5a6582;font-size:.85rem">${esc(a.pubDate)}</td>
      <td><a class="btn" href="/edit/${esc(a.slug)}">Edit</a></td>
    </tr>`).join('');
  return layout('Articles', `
    <h1>Articles (${arts.length})</h1>
    ${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
    <p style="color:#5a6582">Note: hero images on this page are served from the site at <code>http://localhost:4321</code> — run <code>npm run dev</code> in another terminal for previews, or visit paths directly.</p>
    <table><thead><tr><th></th><th>Title</th><th>Date</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  `);
}

async function renderEdit(slug, flash = '') {
  const filepath = path.join(ARTICLES_DIR, `${slug}.md`);
  const raw = await fs.readFile(filepath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const images = await listImages();
  const currentImg = (data.heroImage || '').replace('/images/', '');
  const imgHtml = images.map((f) => `
    <label title="${esc(f)}">
      <input type="radio" name="heroImage" value="/images/${esc(f)}" ${f === currentImg ? 'checked' : ''}>
      <img src="http://localhost:4321/images/${esc(f)}" loading="lazy" alt="${esc(f)}" onerror="this.style.opacity=.3;this.title='(dev server not running)'">
      <div class="name">${esc(f)}</div>
    </label>`).join('');
  const tags = Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || '');
  return layout(`Edit: ${data.title || slug}`, `
    <h1>Edit article</h1>
    ${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
    <form method="post" action="/edit/${esc(slug)}">
      <label>Title</label>
      <input type="text" name="title" value="${esc(data.title || '')}" required>

      <label>Description</label>
      <textarea name="description" style="min-height:60px">${esc(data.description || '')}</textarea>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div><label>Publish date</label><input type="date" name="pubDate" value="${esc(data.pubDate || '')}"></div>
        <div><label>Author</label><input type="text" name="author" value="${esc(data.author || 'Wilco Financial')}"></div>
        <div><label>Tags (comma-separated)</label><input type="text" name="tags" value="${esc(tags)}"></div>
      </div>

      <label>Hero image (current: ${esc(data.heroImage || '—')})</label>
      <div class="img-grid">${imgHtml}</div>

      <label>Body (Markdown)</label>
      <textarea name="body">${esc(body)}</textarea>

      <div class="actions">
        <button type="submit" class="btn">Save</button>
        <a class="btn btn-secondary" href="/">Cancel</a>
      </div>
    </form>
  `);
}

async function handleSave(slug, bodyStr) {
  const form = parseQS(bodyStr);
  const filepath = path.join(ARTICLES_DIR, `${slug}.md`);
  const raw = await fs.readFile(filepath, 'utf8');
  const { data } = parseFrontmatter(raw);
  data.title = form.title || '';
  data.description = form.description || '';
  if (form.pubDate) data.pubDate = form.pubDate;
  data.author = form.author || 'Wilco Financial';
  data.tags = (form.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  data.heroImage = form.heroImage || data.heroImage;
  const out = stringifyFrontmatter(data, '\n' + (form.body || ''));
  await fs.writeFile(filepath, out, 'utf8');
  return `Saved ${slug}.md`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;
    if (p === '/' || p === '/index') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await renderIndex(url.searchParams.get('flash') || ''));
      return;
    }
    const editMatch = p.match(/^\/edit\/([\w-]+)$/);
    if (editMatch && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await renderEdit(editMatch[1], url.searchParams.get('flash') || ''));
      return;
    }
    if (editMatch && req.method === 'POST') {
      let buf = '';
      req.on('data', (c) => (buf += c));
      req.on('end', async () => {
        try {
          const msg = await handleSave(editMatch[1], buf);
          res.writeHead(302, { Location: `/?flash=${encodeURIComponent(msg)}` });
          res.end();
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Save error: ' + e.message);
        }
      });
      return;
    }
    // serve public/images as fallback so thumbs work even without dev server
    if (p.startsWith('/images/')) {
      const f = path.join(IMAGES_DIR, path.basename(p));
      if (fssync.existsSync(f)) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
        fssync.createReadStream(f).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Wilco Article Editor\n  ➜  http://localhost:${PORT}\n`);
});
