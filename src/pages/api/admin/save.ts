// POST /api/admin/save — validates the admin cookie, rewrites the article's
// markdown with the submitted frontmatter + body, and commits to GitHub.
// Vercel will then auto-rebuild the site.

export const prerender = false;

import type { APIRoute } from 'astro';
import { isAuthed, readArticle, stringifyFrontmatter, commitFile } from '../../../lib/admin';

export const POST: APIRoute = async ({ request, redirect }) => {
  if (!isAuthed(request)) {
    return redirect('/admin');
  }
  const form = await request.formData();
  const slug = String(form.get('slug') || '');
  if (!/^[\w-]+$/.test(slug)) {
    return new Response('Bad slug', { status: 400 });
  }

  let current;
  try {
    current = readArticle(slug);
  } catch {
    return new Response('Article not found', { status: 404 });
  }

  const data = { ...current.data };
  data.title = String(form.get('title') || '');
  data.description = String(form.get('description') || '');
  const pubDate = String(form.get('pubDate') || '');
  if (pubDate) data.pubDate = pubDate;
  data.author = String(form.get('author') || 'Wilco Financial');
  data.tags = String(form.get('tags') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const heroImage = String(form.get('heroImage') || '');
  if (heroImage) data.heroImage = heroImage;

  const bodyStr = String(form.get('body') || '');
  const out = stringifyFrontmatter(data, '\n' + bodyStr);

  const result = await commitFile(
    `src/content/articles/${slug}.md`,
    out,
    `Edit article: ${slug} (via admin)`,
  );
  if (!result.ok) {
    return new Response(
      `Save failed: ${result.error}\n\nYour edits were NOT committed. Check that GITHUB_TOKEN and GITHUB_REPO are set on the Vercel project.`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  return redirect(
    `/admin?flash=${encodeURIComponent(`Saved ${slug}. Vercel will redeploy in ~1-2 minutes.`)}`,
  );
};
