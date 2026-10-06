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
      id: 'segway-x260',
      name: 'Segway X260',
      maker: 'Segway',
      difficulty: 'Easy',
      peakPowerKw: 5,
      weightKg: 55,
      topSpeedKmh: 75,
      extra: '0–31 mph in 4.0 s',
      blurb: 'Light, gentle power delivery. It takes a lean back to get the front up, and it stays easy to hold once it’s there.',
      look: { wheelbase: 1.27, wheelRadius: 0.301, plate: '#c9ccd1', plateInk: '#e1251b' },
      sources: [
        'https://thedrive.com/news/35096/segway-x260-dirt-ebike-75-mile-range-0-31-in-4-seconds-5000-price-tag',
        'https://ridereview.com/products/segway-dirt-ebike-x260',
      ],
    },
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
      id: 'talaria-mx4',
      name: 'Talaria Sting R MX4',
      maker: 'Talaria',
      difficulty: 'Medium',
      peakPowerKw: 8,
      weightKg: 66,
      topSpeedKmh: 85,
      extra: '60 V 45 Ah battery',
      blurb: 'Sur-Ron’s main rival. It has more torque and a longer chassis, so it lifts quicker and pulls harder at speed.',
      look: { wheelbase: 1.29, wheelRadius: 0.311, plate: '#1f62e0', plateInk: '#ffffff' },
      sources: [
        'https://www.rideandglide.co.uk/product/talaria-sting-r-mx4-electric-motorbike/',
        'https://ridethewind.ca/products/talaria-sting-r-mx4',
      ],
    },
    {
      id: 'eride-pro-ss',
      name: 'E Ride Pro-SS 3.0',
      maker: 'E Ride',
      difficulty: 'Hard',
      peakPowerKw: 16,
      weightKg: 63,
      topSpeedKmh: 97,
      extra: '0–30 mph in 2.36 s',
      blurb: '72 V and 16 kW in a light bike. The front comes up fast, so feather the throttle.',
      look: { wheelbase: 1.32, wheelRadius: 0.33, plate: '#2b2d32', plateInk: '#e0262d' },
      sources: [
        'https://www.slashgear.com/2024517/e-ride-pro-ss-3-0-top-speed-acceleration',
        'https://chargedcycleworks.com/products/e-ride-pro-ss-3-0-16kw-72v-electric-dirt-bike',
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
