// Contact-form endpoint. Runs as a Vercel serverless function.
// Receives POSTed form data, validates lightly, and sends an email
// notification to info@wilcofin.com via Resend.
//
// The Astro prerender flag is set to false so this file is NOT included
// in the static build — it's deployed as a dynamic endpoint.
export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Returns a short reason string if the submission has strong spam
 * signals — false-positive-resistant heuristics tuned for the kind of
 * random-consonant-cluster bots that hit small contact forms. Returns
 * null for legitimate-looking submissions.
 */
function looksLikeSpam(args: { name: string; email: string; message: string; phone: string }): string | null {
  const m = args.message.toLowerCase();
  const lettersOnly = m.replace(/[^a-z]/g, '');

  // 1. Vowel ratio. Real English averages 35-45% vowels per letter.
  // Random consonant strings sit below 25%. Apply only on substantial
  // messages so a real one-liner ("ok?") doesn't trip it.
  if (lettersOnly.length >= 40) {
    const vowels = (lettersOnly.match(/[aeiouy]/g) || []).length;
    const vowelRatio = vowels / lettersOnly.length;
    if (vowelRatio < 0.22) return 'low-vowel-ratio';
  }

  // 2. Single tokens longer than 22 chars. Real English caps around
  // ~18 chars except for chemical compounds. Bots produce words like
  // "YyErjcwdkdjwjjwjjdwjddjwsjf".
  const tokens = m.split(/\s+/).filter(Boolean);
  if (tokens.some((t) => t.length > 22)) return 'over-long-token';

  // 3. Embedded mention of our own domain inside the message body —
  // a common bot tell where they paste the target URL into the
  // text field. (Legitimate prospects don't write "wilcofin.com"
  // back at us inside the message.)
  if (/\bwilcofin\.com\b/i.test(args.message)) return 'self-domain-mention';

  // 4. Long run of repeating characters ("aaaaa", "wwwww") — gibberish
  // or keyboard mash.
  if (/(.)\1{4,}/.test(m)) return 'repeated-chars';

  // 5. Substantial message with zero spaces — bots that smash random
  // text without punctuation.
  if (args.message.length > 60 && !args.message.includes(' ')) return 'no-spaces';

  // 6. Name field that looks bot-generated. Real names: usually 2+
  // tokens, mostly letters. Bots: random strings like "GeraldTek".
  // We don't reject single-word names (people legitimately use them),
  // but we flag a name that has zero vowels.
  const nameLetters = args.name.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (nameLetters.length >= 6) {
    const nv = (nameLetters.match(/[aeiouy]/g) || []).length / nameLetters.length;
    if (nv < 0.15) return 'low-vowel-name';
  }

  return null;
}

export const POST: APIRoute = async ({ request }) => {
  // Resolve API key at call time (not at module load) so builds without
  // the secret still compile; only requests at runtime require it.
  // process.env is the reliable runtime reader on Vercel serverless —
  // import.meta.env in SSR mode can get replaced at build time.
  const apiKey = process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY missing at runtime');
    return json({ ok: false, error: 'Email service is not configured.' }, 500);
  }

  // Accept both application/x-www-form-urlencoded (native <form> submit)
  // and multipart/form-data (browsers sometimes send this for richer forms).
  let name = '';
  let email = '';
  let phone = '';
  let message = '';
  let trap = ''; // simple spam check

  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const body = await request.json();
      name = String(body.name ?? '');
      email = String(body.email ?? '');
      phone = String(body.phone ?? '');
      message = String(body.message ?? '');
      trap = String(body.website ?? '');
    } else {
      const form = await request.formData();
      name = String(form.get('name') ?? '');
      email = String(form.get('email') ?? '');
      phone = String(form.get('phone') ?? '');
      message = String(form.get('message') ?? '');
      trap = String(form.get('website') ?? '');
    }
  } catch (err) {
    return json({ ok: false, error: 'Could not read submission.' }, 400);
  }

  // Honeypot — hidden field only bots tend to fill. Respond OK but drop.
  if (trap.trim() !== '') return json({ ok: true, spam: true });

  // Minimal validation
  name = name.trim();
  email = email.trim();
  phone = phone.trim();
  message = message.trim();

  if (!name || name.length > 200) return json({ ok: false, error: 'Please provide your name.' }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    return json({ ok: false, error: 'Please provide a valid email address.' }, 400);
  if (!message || message.length > 8000)
    return json({ ok: false, error: 'Please include a message.' }, 400);
  if (phone.length > 40) return json({ ok: false, error: 'Phone number is too long.' }, 400);

  // Heuristic spam filter — catches the random-consonant-cluster bots
  // that fill the form with gibberish to bypass simple validation.
  // Returns a "spam" signature label if any signal trips; logged server-
  // side so we can audit false positives. Response to the client is
  // still ok:true so the bot thinks it succeeded.
  const spamReason = looksLikeSpam({ name, email, message, phone });
  if (spamReason) {
    console.warn('[contact] dropped as spam:', spamReason, '| from:', email, '| msg snippet:', message.slice(0, 80));
    return json({ ok: true, spam: true });
  }

  const resend = new Resend(apiKey);

  const subject = `New contact form — ${name}`;
  const textBody = [
    `Name:    ${name}`,
    `Email:   ${email}`,
    phone ? `Phone:   ${phone}` : null,
    '',
    'Message:',
    message,
    '',
    '---',
    'Sent from the contact form at https://www.wilcofin.com/contact',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const htmlBody = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2238;max-width:620px;">
      <h2 style="font-family:Georgia,serif;color:#011342;margin:0 0 16px;">New contact form submission</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <tr><td style="padding:6px 0;color:#5a6582;font-size:14px;width:90px;">Name</td><td style="padding:6px 0;font-weight:600;">${esc(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#5a6582;font-size:14px;">Email</td><td style="padding:6px 0;"><a href="mailto:${esc(email)}" style="color:#011342;">${esc(email)}</a></td></tr>
        ${phone ? `<tr><td style="padding:6px 0;color:#5a6582;font-size:14px;">Phone</td><td style="padding:6px 0;"><a href="tel:${esc(phone)}" style="color:#011342;">${esc(phone)}</a></td></tr>` : ''}
      </table>
      <div style="border-left:3px solid #81c460;padding:4px 14px;background:#f7f9fc;white-space:pre-wrap;line-height:1.55;">${esc(message)}</div>
      <p style="color:#5a6582;font-size:12px;margin-top:24px;">Sent from the contact form at <a href="https://www.wilcofin.com/contact" style="color:#011342;">wilcofin.com/contact</a>.</p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      // Using the verified wilcofin.com domain, with a functional-looking
      // inbox-side address. Reply-to is set to the prospect's email so
      // hitting Reply goes straight to them.
      from: 'Wilco Contact Form <contact@wilcofin.com>',
      to: ['info@wilcofin.com'],
      replyTo: email,
      subject,
      text: textBody,
      html: htmlBody,
    });
    if ((result as any).error) {
      console.error('[contact] Resend error', (result as any).error);
      return json({ ok: false, error: 'Message could not be delivered. Please try again.' }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error('[contact] Unexpected failure', err);
    return json({ ok: false, error: 'Message could not be delivered. Please try again.' }, 502);
  }
};
