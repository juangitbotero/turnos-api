'use strict';
/**
 * Direction 3 specs.
 *
 * `crop` is {x, y, w, h} in 0..1 FRACTIONS of the source screenshot, read off a
 * coordinate grid rather than guessed, so a re-export at another device
 * resolution still lands on the right control.
 *
 * ⚠️ `04-my-shifts` shows "Demo ·" on every card — rows from the video seeder
 * (`docs/go-live-cleanup.md`). It is used ONLY for tight crops that exclude
 * those lines, never as a full-screen device shot. Re-export that screen from a
 * clean account before using it more widely.
 *
 * ⚠️ `01-map` carries Apple Maps attribution. Apple restricts Maps imagery in
 * paid advertising — confirm before running the two map variants.
 */

const SPECS = [
  {
    id: 'P-pay-on-every-shift', shot: '02-list.PNG', ground: 'tint', layout: 'callout',
    kicker: 'EVERY SHIFT', crop: { x: 0.60, y: 0.288, w: 0.36, h: 0.056 },
    headline: 'Every shift shows the pay.',
    sub: 'Gross hourly rate, on the card, before you apply.',
  },
  {
    id: 'Q-full-gross', shot: '02-list.PNG', ground: 'paper', layout: 'callout',
    kicker: 'WHAT REACHES YOU', crop: { x: 0.06, y: 0.345, w: 0.78, h: 0.042 },
    headline: 'You receive the full gross.',
    sub: 'Turnos takes no cut of your pay. The company pays you directly.',
  },
  {
    id: 'R-multi-day', shot: '02-list.PNG', ground: 'ink', layout: 'callout',
    kicker: 'LONGER JOBS', crop: { x: 0.05, y: 0.392, w: 0.88, h: 0.048 },
    headline: 'Two-day jobs. One application.',
    sub: 'Apply once and the whole run is yours.',
  },
  {
    id: 'S-before-you-apply', shot: '02-list.PNG', ground: 'paper', layout: 'hero',
    kicker: 'WHAT YOU SEE FIRST', crop: { x: 0.03, y: 0.266, w: 0.94, h: 0.175 },
    headline: 'The place, the hours, the pay. Before you apply.',
    sub: '',
  },
  {
    id: 'T-on-the-map', shot: '01-map.PNG', ground: 'ink', layout: 'bleed',
    kicker: 'NEAR YOU', crop: null,
    headline: 'Shifts on your street, not across town.',
    sub: 'Sorted by how far you would actually have to walk.',
  },
  {
    id: 'U-lisbon-tonight', shot: '01-map.PNG', ground: 'tint', layout: 'callout',
    kicker: 'LISBON · BETA', crop: { x: 0.02, y: 0.088, w: 0.50, h: 0.032 },
    headline: 'Eight shifts, walking distance.',
    sub: 'Open the app and see what your city needs tonight.',
  },
  {
    id: 'V-asked-back', shot: '03-profile.PNG', ground: 'paper', layout: 'callout',
    kicker: 'REPUTATION', crop: { x: 0.05, y: 0.256, w: 0.90, h: 0.120 },
    headline: 'Do it well. Get asked back.',
    sub: 'Ratings and badges follow you to the next company.',
  },
  {
    id: 'W-available-toggle', shot: '03-profile.PNG', ground: 'tint', layout: 'callout',
    kicker: 'YOUR CALL', crop: { x: 0.03, y: 0.566, w: 0.94, h: 0.180 },
    headline: 'Switch it off when you’re busy.',
    sub: 'Companies only find you on the days you choose.',
  },
  {
    id: 'X-your-experience', shot: '03-profile.PNG', ground: 'paper', layout: 'hero',
    kicker: 'ON THE RECORD', crop: { x: 0.05, y: 0.825, w: 0.90, h: 0.062 },
    headline: 'Your experience counts from day one.',
    sub: '',
  },
  {
    id: 'Y-confirm-paid', shot: '04-my-shifts.PNG', ground: 'ink', layout: 'hero',
    kicker: 'WHEN IT LANDS', crop: { x: 0.06, y: 0.583, w: 0.88, h: 0.042 },
    headline: 'Confirm you were paid. One tap.',
    sub: '',
  },
  {
    id: 'Z-find-take-show', shot: '02-list.PNG', ground: 'ink', layout: 'bleed',
    kicker: 'IN YOUR POCKET', crop: null,
    headline: 'Find it, take it, show up.',
    sub: 'Free for workers. Now and always.',
  },
  {
    // Starts at the card glyph, not mid-word: x=0.42 clipped "full gross" and
    // the detail opened on "ss ·", which reads as a rendering fault.
    id: 'AA-pay-link', shot: '02-list.PNG', ground: 'tint', layout: 'callout',
    kicker: 'HOW YOU GET PAID', crop: { x: 0.485, y: 0.345, w: 0.325, h: 0.042 },
    headline: 'Paid by the company, not by us.',
    sub: 'Turnos never holds your wages.',
  },
];

module.exports = { SPECS };
