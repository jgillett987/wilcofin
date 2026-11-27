// First-touch lead-source helpers for the public contact form.
// All values are untrusted input (query params, document.referrer, or
// hidden form fields a client can rewrite), so every field is length-
// limited, stripped of control characters (including CR/LF used in
// header injection), and HTML-escaped before it is placed in an email
// body. These values must never be copied into email headers (Subject,
// From, To, Reply-To, or custom headers).

export const LEAD_SOURCE_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'landing_path',
  'referrer',
  'first_touch',
] as const;

export type LeadSourceField = (typeof LEAD_SOURCE_FIELDS)[number];

export type LeadSource = Record<LeadSourceField, string>;

export const LEAD_SOURCE_LIMITS: Record<LeadSourceField, number> = {
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  landing_path: 500,
  referrer: 1000,
  first_touch: 40,
};

const EMPTY_LABEL = 'none / direct';

// C0 + C1 controls, DEL, and Unicode line/paragraph separators.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;

export const emptyLeadSource = (): LeadSource => ({
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_content: '',
  utm_term: '',
  landing_path: '',
  referrer: '',
  first_touch: '',
});

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cleanString(raw: unknown, max: number): string {
  if (raw == null) return '';
  let s = String(raw).replace(CONTROL_CHARS, '').trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}

function sanitizeLandingPath(raw: unknown): string {
  let s = cleanString(raw, LEAD_SOURCE_LIMITS.landing_path);
  if (!s) return '';

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) || s.startsWith('//')) {
    try {
      const url = new URL(s.startsWith('//') ? `https:${s}` : s);
      s = url.pathname || '/';
    } catch {
      return '';
    }
  }

  if (s.includes('\\') || s.startsWith('//')) return '';
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.split('?')[0].split('#')[0];
  return cleanString(s, LEAD_SOURCE_LIMITS.landing_path);
}

function sanitizeReferrer(raw: unknown): string {
  const s = cleanString(raw, LEAD_SOURCE_LIMITS.referrer);
  if (!s) return '';
  try {
    const url = new URL(s);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString().slice(0, LEAD_SOURCE_LIMITS.referrer);
  } catch {
    return '';
  }
}

function sanitizeFirstTouch(raw: unknown): string {
  const s = cleanString(raw, LEAD_SOURCE_LIMITS.first_touch);
  if (!s) return '';
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toISOString();
}

type LeadInput = { get: (name: string) => unknown } | Record<string, unknown>;

function readField(input: LeadInput, name: string): unknown {
  if (input && typeof (input as { get?: unknown }).get === 'function') {
    return (input as { get: (n: string) => unknown }).get(name);
  }
  return (input as Record<string, unknown>)[name];
}

export function parseLeadSource(input: LeadInput | null | undefined): LeadSource {
  const src = emptyLeadSource();
  if (!input) return src;
  src.utm_source = cleanString(readField(input, 'utm_source'), LEAD_SOURCE_LIMITS.utm_source);
  src.utm_medium = cleanString(readField(input, 'utm_medium'), LEAD_SOURCE_LIMITS.utm_medium);
  src.utm_campaign = cleanString(readField(input, 'utm_campaign'), LEAD_SOURCE_LIMITS.utm_campaign);
  src.utm_content = cleanString(readField(input, 'utm_content'), LEAD_SOURCE_LIMITS.utm_content);
  src.utm_term = cleanString(readField(input, 'utm_term'), LEAD_SOURCE_LIMITS.utm_term);
  src.landing_path = sanitizeLandingPath(readField(input, 'landing_path'));
  src.referrer = sanitizeReferrer(readField(input, 'referrer'));
  src.first_touch = sanitizeFirstTouch(readField(input, 'first_touch'));
  return src;
}

export function hasCampaignAttribution(src: LeadSource): boolean {
  return Boolean(
    src.utm_source ||
      src.utm_medium ||
      src.utm_campaign ||
      src.utm_content ||
      src.utm_term ||
      src.referrer,
  );
}

function formatFirstTouchDisplay(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(new Date(ms));
}

type LeadRow = { label: string; value: string };

function leadSourceRows(src: LeadSource): LeadRow[] {
  const rows: LeadRow[] = [];
  const push = (label: string, value: string, always = false) => {
    if (value || always) rows.push({ label, value: value || EMPTY_LABEL });
  };

  if (!hasCampaignAttribution(src)) {
    rows.push({ label: '', value: EMPTY_LABEL });
  } else {
    push('Source', src.utm_source, true);
    push('Medium', src.utm_medium, true);
    push('Campaign', src.utm_campaign, true);
    push('Content', src.utm_content);
    push('Term', src.utm_term);
    push('Referrer', src.referrer, true);
  }

  push('Landing', src.landing_path);
  if (src.first_touch) {
    rows.push({ label: 'First touch', value: formatFirstTouchDisplay(src.first_touch) });
  }
  return rows;
}

/** Plain-text "Lead source" block for the info@ notification. */
export function formatLeadSourceText(src: LeadSource): string {
  const lines = ['Lead source'];
  for (const row of leadSourceRows(src)) {
    if (!row.label) lines.push(row.value);
    else lines.push(`${row.label}:`.padEnd(14) + row.value);
  }
  return lines.join('\n');
}

/** HTML "Lead source" block. Values are escaped; labels are fixed. */
export function formatLeadSourceHtml(src: LeadSource): string {
  const rows = leadSourceRows(src)
    .map((row) => {
      const value = escapeHtml(row.value);
      if (!row.label) {
        return `<tr><td colspan="2" style="padding:6px 0;font-weight:600;">${value}</td></tr>`;
      }
      return `<tr><td style="padding:6px 0;color:#5a6582;font-size:14px;width:110px;vertical-align:top;">${escapeHtml(row.label)}</td><td style="padding:6px 0;font-weight:600;word-break:break-word;">${value}</td></tr>`;
    })
    .join('');

  return `
    <div style="margin-top:24px;">
      <h3 style="font-family:Georgia,serif;color:#011342;margin:0 0 8px;font-size:16px;">Lead source</h3>
      <table style="border-collapse:collapse;width:100%;">${rows}</table>
    </div>
  `;
}
