// Shared helpers for the /admin panel.
// Reads use the local filesystem (read-only — works in dev + serverless).
// Writes go through the GitHub Contents API so changes persist and trigger
// a Vercel rebuild.

import fs from 'node:fs';
import path from 'node:path';

export const ADMIN_COOKIE = 'wf_admin';

// Resolve repo root reliably in dev, build, and serverless environments.
// When the adapter bundles for Vercel, process.cwd() is the project root.
export const ROOT = process.cwd();
export const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
export const IMAGES_DIR = path.join(ROOT, 'public', 'images');

export function isAuthed(request: Request): boolean {
  const cookies = request.headers.get('cookie') || '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const expected = makeToken();
  return token === expected;
}

export function makeToken(): string {
  // Simple token = hash of admin password. Not intended to resist a determined
  // attacker, just to hide the panel. Requires ADMIN_PASSWORD env var.
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!pw) return '';
  // Use built-in crypto for a stable token
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(pw + '::wilcofin').digest('hex');
}

export function authCookieHeader(token: string): string {
  // 30-day cookie, Secure in prod, SameSite=Lax
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

// ---- Frontmatter parsing ----
export function parseFrontmatter(src: string): { data: Record<string, any>; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, any> = {};
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
  return { data, body: m[2] };
}

export function stringifyFrontmatter(data: Record<string, any>, body: string): string {
  const order = ['title', 'description', 'pubDate', 'daysAgo', 'author', 'tags', 'heroImage', 'heroVideo', 'draft'];
  const keys = Array.from(new Set([...order.filter((k) => k in data), ...Object.keys(data)]));
  const lines: string[] = ['---'];
  for (const k of keys) {
    const v = data[k];
    if (v === undefined || v === '' || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((x) => `"${x}"`).join(', ')}]`);
    } else if (k === 'pubDate' || k === 'daysAgo' || k === 'draft') {
      lines.push(`${k}: ${v}`);
    } else if (typeof v === 'string' && (v.includes(':') || v.includes('"'))) {
      lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${k}: "${v}"`);
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n') + body.replace(/^\r?\n/, '');
}

// ---- Filesystem reads ----
export function listArticles(): { slug: string; title: string; heroImage: string; pubDate: string }[] {
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'));
  const out = files.map((f) => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf8');
    const { data } = parseFrontmatter(raw);
    return { slug: f.replace(/\.md$/, ''), title: data.title || f, heroImage: data.heroImage || '', pubDate: data.pubDate || '' };
  });
  out.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  return out;
}

export function readArticle(slug: string): { data: Record<string, any>; body: string; raw: string } {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, `${slug}.md`), 'utf8');
  return { ...parseFrontmatter(raw), raw };
}

export function listImages(): string[] {
  const files = fs.readdirSync(IMAGES_DIR);
  return files.filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f)).sort();
}

// ---- GitHub write ----
// Commits a file to the configured repo via the GitHub Contents API.
// Requires env vars: GITHUB_TOKEN, GITHUB_REPO (e.g. jgillett987/wilcofin), GITHUB_BRANCH (default main).
export async function commitFile(relativePath: string, newContent: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) {
    return { ok: false, error: 'GITHUB_TOKEN and GITHUB_REPO env vars must be set on the Vercel project.' };
  }
  const apiPath = relativePath.replace(/\\/g, '/');
  const url = `https://api.github.com/repos/${repo}/contents/${apiPath}`;

  // Need current SHA to update
  let sha: string | undefined;
  try {
    const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'wilco-admin' },
    });
    if (getRes.ok) {
      const j: any = await getRes.json();
      sha = j.sha;
    }
  } catch {}

  const body = {
    message,
    content: Buffer.from(newContent, 'utf8').toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'wilco-admin',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `GitHub API ${res.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true };
}
