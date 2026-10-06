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
      weightKg: 56,
      topSpeedKmh: 75,
      extra: '60 V 32 Ah battery · 2024 model',
      blurb: 'The bike that started the light e-moto craze, and the most modified bike in the sport. Gentle stock, wild once you build it.',
      look: { wheelbase: 1.26, wheelRadius: 0.311, plate: '#97a33e', plateInk: '#f5e21b' },
      sources: [
        'https://psxdigital.com/powersports-marketing-automation/productDetails/8/2023/SURRON/ELECTRIC%20BIKE/Light%20Bee/X',
        'https://ridereview.com/products/sur-ron-light-bee-x',
      ],
    },
    {
      id: 'stark-varg-mx',
      name: 'Stark Varg MX',
      maker: 'Stark Future',
      difficulty: 'Expert',
      peakPowerKw: 45,
      weightKg: 118,
      topSpeedKmh: 142,
      extra: 'MX 1.2 · 60 hp, 80 hp as an Alpha · 7.2 kWh',
      blurb: 'A full-size electric motocross bike. Even the 60 hp Standard lifts the front with a small throttle input; the Alpha is a handful.',
      look: { wheelbase: 1.48, wheelRadius: 0.349, plate: '#d4111c', plateInk: '#ffffff' },
      sources: [
        'https://starkfuture.com/en-us-KE/products/stark-varg',
        'https://www.slashgear.com/1848269/stark-varg-top-speed/',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { BIKES };
  else root.BIKES = BIKES;
})(typeof self !== 'undefined' ? self : this);
