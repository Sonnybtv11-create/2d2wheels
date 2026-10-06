/*
 * The bike roster. Specs come from manufacturer and retailer listings
 * (see `sources` on each entry). The game turns peak power, weight and top
 * speed into handling. Wheelbase and wheel size match the traced art in
 * bikeart.js; `plate` colours are for the menu's number plates.
 */
(function (root) {
  'use strict';

  const BIKES = [
    {
      id: 'surron-lbx',
      name: 'Sur-Ron Light Bee X',
      maker: 'Sur-Ron',
      difficulty: 'Easy',
      peakPowerKw: 6,
      weightKg: 57,
      topSpeedKmh: 75,
      extra: '60 V 40 Ah battery',
      blurb: 'The bike that started the light e-moto craze. Light and predictable, so it’s a good one to learn on.',
      look: { wheelbase: 1.26, wheelRadius: 0.311, plate: '#97a33e', plateInk: '#f5e21b' },
      sources: [
        'https://www.visordown.com/news/sur-ron-unveils-most-powerful-light-bee-model',
        'https://ridereview.com/products/sur-ron-light-bee-x',
      ],
    },
    {
      id: 'stark-varg-mx',
      name: 'Stark Varg MX',
      maker: 'Stark Future',
      difficulty: 'Expert',
      peakPowerKw: 60,
      weightKg: 118,
      topSpeedKmh: 142,
      extra: '80 hp · 938 Nm at the wheel',
      blurb: 'A full-size electric motocross bike with more power than a 450. Even a small throttle input lifts the front.',
      look: { wheelbase: 1.48, wheelRadius: 0.349, plate: '#d4111c', plateInk: '#ffffff' },
      sources: [
        'https://www.slashgear.com/1848269/stark-varg-top-speed/',
        'https://www.1000ps.com/en-us/model/12105/stark-future-varg-mx/2024',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { BIKES };
  else root.BIKES = BIKES;
})(typeof self !== 'undefined' ? self : this);
