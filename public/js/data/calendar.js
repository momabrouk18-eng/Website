// Reference dates. "estimated" = not yet officially announced, or typical recurring dates.
// China announces each year's official holiday schedule around November of the year before.
export const CALENDAR = [
  // China public holidays 2026 (official schedule)
  { date: '2026-01-01', end: '2026-01-03', title: 'New Year holiday', type: 'cn' },
  { date: '2026-02-15', end: '2026-02-23', title: 'Spring Festival (Chinese New Year)', type: 'cn', note: 'Factories usually close 2–4 weeks around this. Production and shipping stop.' },
  { date: '2026-04-04', end: '2026-04-06', title: 'Qingming Festival', type: 'cn' },
  { date: '2026-05-01', end: '2026-05-05', title: 'Labour Day holiday', type: 'cn' },
  { date: '2026-06-19', end: '2026-06-21', title: 'Dragon Boat Festival', type: 'cn' },
  { date: '2026-09-25', end: '2026-09-27', title: 'Mid-Autumn Festival', type: 'cn' },
  { date: '2026-10-01', end: '2026-10-07', title: 'National Day (Golden Week)', type: 'cn', note: 'Offices closed for a week. Expect delays before and after.' },

  // Planning reminders
  { date: '2026-12-01', end: '2026-12-20', title: 'Place pre-CNY orders', type: 'plan', note: 'Orders confirmed after mid-December often slip past Chinese New Year. Confirm production slots and shipment dates now.' },
  { date: '2027-01-20', end: '2027-03-01', title: 'Chinese New Year slowdown', type: 'plan', estimated: true, note: 'Workers travel home before the holiday and many return late. Quality issues are more common in the first weeks back.' },

  // China public holidays 2027 (estimated from the lunar calendar)
  { date: '2027-01-01', end: '2027-01-03', title: 'New Year holiday', type: 'cn', estimated: true },
  { date: '2027-02-05', end: '2027-02-13', title: 'Spring Festival (Chinese New Year)', type: 'cn', estimated: true, note: 'New Year’s Day is 6 Feb 2027. Factories usually close 2–4 weeks around it.' },
  { date: '2027-04-03', end: '2027-04-05', title: 'Qingming Festival', type: 'cn', estimated: true },
  { date: '2027-05-01', end: '2027-05-05', title: 'Labour Day holiday', type: 'cn', estimated: true },
  { date: '2027-06-09', end: '2027-06-11', title: 'Dragon Boat Festival', type: 'cn', estimated: true },
  { date: '2027-09-15', end: '2027-09-17', title: 'Mid-Autumn Festival', type: 'cn', estimated: true },
  { date: '2027-10-01', end: '2027-10-07', title: 'National Day (Golden Week)', type: 'cn', estimated: true },

  // Trade fairs (typical dates — confirm on the organiser's site before booking)
  { date: '2026-10-15', end: '2026-10-19', title: 'Canton Fair, phase 1 (electronics) — Guangzhou', type: 'fair', estimated: true, url: 'https://www.cantonfair.org.cn/en-US' },
  { date: '2026-10-13', end: '2026-10-16', title: 'HKTDC Electronics Fair (Autumn) — Hong Kong', type: 'fair', estimated: true, url: 'https://www.hktdc.com/event/hkelectronicsfairae/en' },
  { date: '2026-10-11', end: '2026-10-14', title: 'Global Sources Consumer Electronics (Oct) — Hong Kong', type: 'fair', estimated: true, url: 'https://www.globalsources.com/trade-shows/' },
  { date: '2026-11-15', end: '2026-11-18', title: 'Cairo ICT — Cairo', type: 'fair', estimated: true, url: 'https://www.cairoict.com/' },
  { date: '2027-01-06', end: '2027-01-09', title: 'CES — Las Vegas', type: 'fair', estimated: true, url: 'https://www.ces.tech/' },
  { date: '2027-03-01', end: '2027-03-04', title: 'MWC — Barcelona', type: 'fair', estimated: true, url: 'https://www.mwcbarcelona.com/' },
  { date: '2027-04-11', end: '2027-04-14', title: 'Global Sources Consumer Electronics (Apr) — Hong Kong', type: 'fair', estimated: true, url: 'https://www.globalsources.com/trade-shows/' },
  { date: '2027-04-13', end: '2027-04-16', title: 'HKTDC Electronics Fair (Spring) — Hong Kong', type: 'fair', estimated: true, url: 'https://www.hktdc.com/event/hkelectronicsfairse/en' },
  { date: '2027-04-15', end: '2027-04-19', title: 'Canton Fair, phase 1 (electronics) — Guangzhou', type: 'fair', estimated: true, url: 'https://www.cantonfair.org.cn/en-US' },
  { date: '2027-06-01', end: '2027-06-04', title: 'Computex — Taipei', type: 'fair', estimated: true, url: 'https://www.computextaipei.com.tw/' },
  { date: '2027-09-03', end: '2027-09-07', title: 'IFA — Berlin', type: 'fair', estimated: true, url: 'https://www.ifa-berlin.com/' },
  { date: '2027-10-15', end: '2027-10-19', title: 'Canton Fair, phase 1 (electronics) — Guangzhou', type: 'fair', estimated: true, url: 'https://www.cantonfair.org.cn/en-US' },

  // Egypt public holidays (Islamic dates are estimated and move with the moon)
  { date: '2027-01-07', title: 'Coptic Christmas', type: 'eg' },
  { date: '2027-01-25', title: 'Revolution Day / Police Day', type: 'eg' },
  { date: '2027-03-09', end: '2027-03-12', title: 'Eid al-Fitr', type: 'eg', estimated: true },
  { date: '2027-04-25', title: 'Sinai Liberation Day', type: 'eg' },
  { date: '2027-05-01', title: 'Labour Day', type: 'eg' },
  { date: '2027-05-15', end: '2027-05-19', title: 'Arafat Day & Eid al-Adha', type: 'eg', estimated: true },
  { date: '2027-06-30', title: 'June 30 Revolution', type: 'eg' },
  { date: '2027-07-23', title: 'Revolution Day', type: 'eg' }
];

export const EVENT_TYPES = {
  cn: { label: 'China holiday', tone: 'seal' },
  fair: { label: 'Trade fair', tone: 'sky' },
  plan: { label: 'Planning', tone: 'brass' },
  eg: { label: 'Egypt holiday', tone: 'jade' },
  tr: { label: 'Türkiye holiday', tone: 'jade' },
  custom: { label: 'My event', tone: '' }
};
