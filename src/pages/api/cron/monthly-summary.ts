// Monthly summary cron. Fires at 13:00 UTC (~8 AM CT) on the 25th of
// every month via Vercel Cron (see vercel.json). Emails a plain-English
// operations recap to info@wilcofin.com: what got published, what's
// coming, anything worth attention.
//
// Auth: Vercel Cron sends an Authorization header of value
//   `Bearer <CRON_SECRET>` where CRON_SECRET is the env var Vercel
// auto-generates when you enable crons. We verify that so random
// internet traffic can't trigger emails.
//
// Also callable manually for testing via curl with the same header.
export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { getCollection } from 'astro:content';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const shortDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const monthYear = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

export const GET: APIRoute = async ({ request }) => {
  // Auth: Vercel Cron → Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'RESEND_API_KEY missing' }, 500);

  // Collect article stats from the content collection (same source of
  // truth the public site uses). pubDate is coerced to a Date by Zod.
  const all = await getCollection('articles');
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const published = all
    .filter((a) => !a.data.draft && a.data.pubDate.valueOf() <= now.valueOf())
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const publishedThisMonth = published.filter(
    (a) => a.data.pubDate >= thisMonthStart && a.data.pubDate < nextMonthStart,
  );

  const publishedLast30 = published.filter((a) => a.data.pubDate >= thirtyDaysAgo);

  const scheduled = all
    .filter((a) => !a.data.draft && a.data.pubDate.valueOf() > now.valueOf())
    .sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());

  const nextUp = scheduled.slice(0, 3);
  const nextScheduled = scheduled[0];
  const monthsOfRunway = scheduled.length;

  // Render the email
  const subject = `Wilco site summary — ${monthYear(now)}`;

  const listHtml = (items: typeof published, limit = 5) => {
    const top = items.slice(0, limit);
    if (top.length === 0) return '<p style="color:#5a6582; margin:0;"><em>(none)</em></p>';
    return (
      '<ul style="margin:0; padding-left:18px; line-height:1.55;">' +
      top
        .map(
          (a) =>
            `<li style="margin-bottom:6px;"><a href="https://www.wilcofin.com/articles/${esc(a.id)}" style="color:#011342; text-decoration:underline;">${esc(a.data.title)}</a> <span style="color:#5a6582; font-size:12px;">— ${esc(shortDate(a.data.pubDate))}</span></li>`,
        )
        .join('') +
      '</ul>'
    );
  };

  const cardStyle =
    'background:#ffffff; border:1px solid #e5e9f2; border-left:4px solid #81c460; border-radius:10px; padding:18px 20px; margin-bottom:18px;';
  const h2Style =
    'font-family:Georgia,serif; color:#011342; font-size:18px; margin:0 0 10px; font-weight:700;';
  const statStyle =
    'display:inline-block; margin-right:18px; font-size:14px;';
  const statNumber =
    'color:#011342; font-weight:700; font-size:22px; font-family:Georgia,serif;';
  const statLabel =
    'color:#5a6582; font-size:12px; text-transform:uppercase; letter-spacing:0.06em;';

  const html = `
<!doctype html>
<html>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#1a2238; background:#f7f9fc; margin:0; padding:24px 0;">
  <div style="max-width:640px; margin:0 auto; padding:0 20px;">

    <div style="text-align:center; padding-bottom:16px; border-bottom:2px solid #81c460; margin-bottom:24px;">
      <div style="color:#6aad4a; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase;">Monthly Summary</div>
      <h1 style="font-family:Georgia,serif; color:#011342; font-size:26px; margin:8px 0 0; font-weight:700;">${esc(monthYear(now))}</h1>
      <div style="color:#5a6582; font-size:13px; margin-top:4px;">Wilco Financial · wilcofin.com</div>
    </div>

    <div style="${cardStyle}">
      <h2 style="${h2Style}">At a glance</h2>
      <div>
        <div style="${statStyle}"><div style="${statNumber}">${publishedLast30.length}</div><div style="${statLabel}">published (30d)</div></div>
        <div style="${statStyle}"><div style="${statNumber}">${published.length}</div><div style="${statLabel}">published (total)</div></div>
        <div style="${statStyle}"><div style="${statNumber}">${scheduled.length}</div><div style="${statLabel}">scheduled ahead</div></div>
      </div>
    </div>

    <div style="${cardStyle}">
      <h2 style="${h2Style}">Published this month</h2>
      ${listHtml(publishedThisMonth, 10)}
    </div>

    <div style="${cardStyle}">
      <h2 style="${h2Style}">Coming up next</h2>
      ${
        nextScheduled
          ? `<p style="margin:0 0 10px; color:#1a2238;"><strong>Next auto-publish:</strong> ${esc(shortDate(nextScheduled.data.pubDate))} — ${esc(nextScheduled.data.title)}</p>`
          : '<p style="margin:0 0 10px; color:#5a6582;"><em>No more scheduled articles — worth queuing up more in the admin.</em></p>'
      }
      ${nextUp.length > 1 ? `<div style="color:#5a6582; font-size:13px; margin-top:8px;">Then:</div>${listHtml(nextUp.slice(1), 10)}` : ''}
      ${
        monthsOfRunway > 0
          ? `<p style="color:#5a6582; font-size:13px; margin:14px 0 0;">You have <strong style="color:#011342;">${monthsOfRunway}</strong> article${monthsOfRunway === 1 ? '' : 's'} queued — roughly ${monthsOfRunway} month${monthsOfRunway === 1 ? '' : 's'} of runway at the current monthly cadence.</p>`
          : ''
      }
    </div>

    <div style="${cardStyle}">
      <h2 style="${h2Style}">What to check (5 min)</h2>
      <ol style="margin:0; padding-left:18px; line-height:1.6; color:#1a2238; font-size:14px;">
        <li><strong>Google Search Console</strong> → <a href="https://search.google.com/search-console" style="color:#011342;">Performance</a> → skim the top 10 queries people searched to land on wilcofin.com. Any surprises → consider writing a deeper article on that topic.</li>
        <li><strong>GSC → Pages</strong> — should show ~37 indexed. Flag anything marked "Crawled but not indexed."</li>
        <li><strong>Contact inbox</strong> — any Wilco Contact Form emails you haven't replied to? Leads go stale fast.</li>
        <li><strong>Admin</strong> (<a href="https://www.wilcofin.com/admin" style="color:#011342;">/admin</a>) — glance at any articles flagged as drafts.</li>
      </ol>
    </div>

    <div style="text-align:center; color:#5a6582; font-size:12px; padding:8px 0;">
      Automated summary. Sent on the 25th of every month.<br />
      <a href="https://www.wilcofin.com" style="color:#011342; text-decoration:underline;">wilcofin.com</a>
    </div>

  </div>
</body>
</html>
  `.trim();

  const textBody = [
    `Wilco site summary — ${monthYear(now)}`,
    '',
    `Published in the last 30 days: ${publishedLast30.length}`,
    `Published total: ${published.length}`,
    `Scheduled ahead: ${scheduled.length}`,
    '',
    'Published this month:',
    ...(publishedThisMonth.length === 0
      ? ['  (none)']
      : publishedThisMonth.map((a) => `  - ${a.data.title} (${shortDate(a.data.pubDate)})`)),
    '',
    'Coming up next:',
    ...(nextUp.length === 0
      ? ['  (no more scheduled — worth queuing up more)']
      : nextUp.map((a) => `  - ${shortDate(a.data.pubDate)}: ${a.data.title}`)),
    '',
    `Runway: ${monthsOfRunway} scheduled article${monthsOfRunway === 1 ? '' : 's'}.`,
    '',
    'Quick 5-min check:',
    '  1. Google Search Console → Performance → skim top queries',
    '  2. GSC → Pages → confirm ~37 indexed',
    '  3. Inbox → any Wilco Contact Form emails unanswered?',
    '  4. Admin → any articles still in draft?',
  ].join('\n');

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Wilco Site Summary <reports@wilcofin.com>',
    to: ['info@wilcofin.com'],
    subject,
    text: textBody,
    html,
  });

  if ((result as any).error) {
    console.error('[cron monthly-summary] Resend error', (result as any).error);
    return json({ ok: false, error: 'send failed', detail: (result as any).error }, 502);
  }

  return json({
    ok: true,
    publishedLast30: publishedLast30.length,
    publishedTotal: published.length,
    scheduled: scheduled.length,
  });
};
