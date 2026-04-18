// Central place for business info. Update here; it propagates everywhere.

export const SITE = {
  name: 'Wilco Financial',
  legalName: 'Wilco Financial, LLC',
  url: 'https://www.wilcofin.com',
  tagline: 'Let us handle the details, so you can focus on more important things.',
  description:
    'Wilco Financial is a Tennessee-registered investment adviser based in Williamson County, serving families, individuals, small businesses, and 401(k) plans with fiduciary investment management and financial planning at a simple 0.85% fee.',
  shortDescription:
    'Fiduciary investment management and financial planning from Williamson County, TN. Simple 0.85% fee. Assets custodied at Charles Schwab.',
  advisorName: 'Jon Gillett',
  fee: '0.85%',
  swaDiscount: '20%',
  swaEffectiveFee: '0.68%',
} as const;

export const CONTACT = {
  phone: '(615) 237-8750',
  phoneHref: 'tel:+16152378750',
  email: 'info@wilcofin.com',
  emailHref: 'mailto:info@wilcofin.com',
  addressLine1: '6688 Nolensville Rd',
  addressLine2: 'Ste 108 #3029',
  city: 'Brentwood',
  state: 'TN',
  zip: '37027',
  country: 'US',
  region: 'Williamson County',
  calendlyUrl: 'https://calendly.com/wilcofinancial/30min',
  hours: 'Mon–Fri 8:00am – 5:00pm CT',
} as const;

export const SOCIAL = {
  facebook: '',
  twitter: '',
  instagram: '',
  linkedin: 'https://www.linkedin.com/in/jongillett',
} as const;

export const NAV = [
  { label: 'Home', href: '/' },
  {
    label: 'About',
    href: '/about',
    children: [
      { label: 'About Us', href: '/about' },
      { label: 'What is a Fiduciary', href: '/fiduciary' },
      { label: 'Our Fees', href: '/fees' },
      { label: 'Form ADV', href: '/form-adv' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
  {
    label: 'Services',
    href: '/services',
    children: [
      { label: 'Investment Management', href: '/services/investment-management' },
      { label: 'Financial Planning', href: '/services/financial-planning' },
      { label: 'SWA Pilots & Employees', href: '/southwest-airlines' },
      { label: 'Retirement Planning', href: '/services/retirement-planning' },
      { label: 'Tax Planning', href: '/services/tax-planning' },
      { label: 'Estate Planning', href: '/services/estate-planning' },
      { label: 'Multi-Generational Planning', href: '/services/multi-generational-planning' },
      { label: 'Charitable Planning', href: '/services/charitable-planning' },
    ],
  },
  { label: 'Articles', href: '/articles' },
  { label: 'FAQ', href: '/faq' },
] as const;

export const DISCLOSURE = `WILCO FINANCIAL, LLC is a state registered investment adviser. WILCO FINANCIAL, LLC may only transact business or render personalized investment advice in those states and international jurisdictions where we are registered, filed notice, or otherwise excluded or exempted from registration requirements. The purpose of this web site is for information distribution on products and services. Any communications with prospective clients residing in states or international jurisdictions where WILCO FINANCIAL, LLC and its representatives are not registered or licensed shall be limited so as not to trigger registration or licensing requirements. Nothing on this web site should be construed as personalized investment advice, which can only be provided in one-on-one communications.`;
