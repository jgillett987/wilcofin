import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanString,
  emptyLeadSource,
  escapeHtml,
  formatLeadSourceHtml,
  formatLeadSourceText,
  hasCampaignAttribution,
  LEAD_SOURCE_LIMITS,
  parseLeadSource,
} from './lead-source.ts';

const TEST_CAMPAIGN = {
  utm_source: 'linkedin',
  utm_medium: 'paid_social',
  utm_campaign: 'test2_wc_retirement_tax_dec26',
  utm_content: 'a_taxbill',
  utm_term: '',
  landing_path: '/services/retirement-planning',
  referrer: '',
  first_touch: '2026-11-26T20:15:12-06:00',
};

describe('parseLeadSource', () => {
  it('keeps the LinkedIn test-campaign fields', () => {
    const src = parseLeadSource(TEST_CAMPAIGN);
    assert.equal(src.utm_source, 'linkedin');
    assert.equal(src.utm_medium, 'paid_social');
    assert.equal(src.utm_campaign, 'test2_wc_retirement_tax_dec26');
    assert.equal(src.utm_content, 'a_taxbill');
    assert.equal(src.utm_term, '');
    assert.equal(src.landing_path, '/services/retirement-planning');
    assert.equal(src.referrer, '');
    assert.equal(src.first_touch, '2026-11-27T02:15:12.000Z');
    assert.equal(hasCampaignAttribution(src), true);
  });

  it('reads the same fields from FormData', () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(TEST_CAMPAIGN)) {
      form.set(key, value);
    }
    const src = parseLeadSource(form);
    assert.equal(src.utm_source, 'linkedin');
    assert.equal(src.landing_path, '/services/retirement-planning');
  });

  it('returns empty fields when input is missing', () => {
    const src = parseLeadSource(undefined);
    assert.deepEqual(src, emptyLeadSource());
    assert.equal(hasCampaignAttribution(src), false);
  });

  it('strips CR/LF used for header injection', () => {
    const src = parseLeadSource({
      utm_source: 'linkedin\r\nBcc: attacker@example.com',
      utm_campaign: 'ok\nSubject: spoofed',
      referrer: 'https://example.com/path\r\nX-Injected: 1',
    });
    assert.equal(src.utm_source.includes('\r'), false);
    assert.equal(src.utm_source.includes('\n'), false);
    assert.equal(src.utm_source, 'linkedinBcc: attacker@example.com');
    assert.equal(src.utm_campaign, 'okSubject: spoofed');
    assert.equal(src.referrer.includes('\r'), false);
    assert.equal(src.referrer.includes('\n'), false);
    // After URL parsing, the injected header text is not a valid part of the URL
    assert.equal(src.referrer.startsWith('https://example.com/path'), true);
  });

  it('strips other control characters', () => {
    const src = parseLeadSource({
      utm_content: `hello\u0000world\u0007\u001b`,
    });
    assert.equal(src.utm_content, 'helloworld');
  });

  it('enforces length limits', () => {
    const tooLong = 'x'.repeat(LEAD_SOURCE_LIMITS.utm_source + 50);
    const src = parseLeadSource({ utm_source: tooLong });
    assert.equal(src.utm_source.length, LEAD_SOURCE_LIMITS.utm_source);
  });

  it('keeps only the pathname from a full landing URL and rejects sneaky values', () => {
    assert.equal(
      parseLeadSource({ landing_path: 'https://evil.example/phish?x=1' }).landing_path,
      '/phish',
    );
    assert.equal(parseLeadSource({ landing_path: '//evil.example/phish' }).landing_path, '/phish');
    assert.equal(parseLeadSource({ landing_path: 'contact' }).landing_path, '/contact');
    assert.equal(parseLeadSource({ landing_path: '/ok?utm_source=x#frag' }).landing_path, '/ok');
    assert.equal(parseLeadSource({ landing_path: '/ok\\x' }).landing_path, '');
  });

  it('accepts only http(s) referrers', () => {
    assert.equal(parseLeadSource({ referrer: 'https://www.linkedin.com/in/x' }).referrer, 'https://www.linkedin.com/in/x');
    assert.equal(parseLeadSource({ referrer: 'javascript:alert(1)' }).referrer, '');
    assert.equal(parseLeadSource({ referrer: 'data:text/html,hi' }).referrer, '');
    assert.equal(parseLeadSource({ referrer: 'not a url' }).referrer, '');
  });

  it('drops invalid first-touch timestamps and normalizes valid ones', () => {
    assert.equal(parseLeadSource({ first_touch: 'not-a-date' }).first_touch, '');
    assert.equal(parseLeadSource({ first_touch: '2026-11-26T20:15:12-06:00' }).first_touch, '2026-11-27T02:15:12.000Z');
  });
});

describe('formatLeadSourceText / Html', () => {
  it('renders a clear Lead source block for the test URL campaign', () => {
    const text = formatLeadSourceText(parseLeadSource(TEST_CAMPAIGN));
    assert.match(text, /^Lead source\n/);
    assert.match(text, /Source:\s+linkedin/);
    assert.match(text, /Medium:\s+paid_social/);
    assert.match(text, /Campaign:\s+test2_wc_retirement_tax_dec26/);
    assert.match(text, /Content:\s+a_taxbill/);
    assert.equal(text.includes('Term:'), false);
    assert.match(text, /Referrer:\s+none \/ direct/);
    assert.match(text, /Landing:\s+\/services\/retirement-planning/);
    assert.match(text, /First touch:\s+Nov 26, 2026, 8:15:12 PM CST/);
  });

  it('shows none / direct when attribution is empty', () => {
    const text = formatLeadSourceText(parseLeadSource({ landing_path: '/contact' }));
    assert.match(text, /^Lead source\nnone \/ direct\nLanding:\s+\/contact$/);
    assert.equal(hasCampaignAttribution(parseLeadSource({ landing_path: '/contact' })), false);
  });

  it('HTML-escapes untrusted values and never emits raw tags', () => {
    const src = parseLeadSource({
      utm_source: '<script>alert(1)</script>',
      utm_medium: 'a" onmouseover="alert(1)',
      utm_campaign: "foo'bar",
      landing_path: '/x',
    });
    const html = formatLeadSourceHtml(src);
    assert.equal(html.includes('<script>'), false);
    assert.equal(html.includes('onmouseover="alert'), false);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /a&quot; onmouseover=&quot;alert\(1\)/);
    assert.match(html, /foo&#39;bar/);
    assert.match(html, /<h3[^>]*>Lead source<\/h3>/);
  });
});

describe('escapeHtml / cleanString', () => {
  it('escapes the five HTML-sensitive characters', () => {
    assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  });

  it('trims and caps cleanString', () => {
    assert.equal(cleanString('  hi  ', 10), 'hi');
    assert.equal(cleanString('abcdefghijK', 10), 'abcdefghij');
  });
});
