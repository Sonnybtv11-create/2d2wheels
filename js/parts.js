/*
 * Workshop parts: real products for each bike, what they do in the game,
 * and how they change the bike's look. Prices are in points, about ten
 * points per US dollar of the real part. Figures come from the makers and
 * retailers linked in `src`; where a number wasn't published (most part
 * weights), the game uses an estimate and says so in `note`.
 *
 * How a build turns into handling (apply() below):
 *   - Peak power is the lowest of what the controller, motor and battery can
 *     deliver. The stock Sur-Ron pack tops out around 8.5 kW whatever drives
 *     it (Torp's figure for its TC500 on the stock battery), so the battery
 *     is what unlocks the big controllers.
 *   - Top speed scales with pack voltage and with gearing (rear sprocket).
 *     Gearing also scales the low-speed shove.
 *   - Suspension sets spring rates, damping and travel; better damping soaks
 *     up logs and rocks with less lost speed.
 *   - Tyres set grip on dry dirt, in the wet and in mud.
 *   - Perks are features the real products advertise: ride modes, traction
 *     control, anti-loop and launch control, an electronic clutch, regen and
 *     field weakening.
 */
(function (root) {
  'use strict';

  /* ---------------- Sur-Ron Light Bee X (2024 and earlier) ---------------- */

  const SURRON = [
    {
      id: 'controller', label: 'Controller',
      items: [
        {
          id: 'stock', name: 'Stock FOC controller', maker: 'Sur-Ron', price: 0,
          specs: '6 kW peak · sine-wave FOC',
          perks: ['modes'], kw: 6,
          text: 'Sport and Eco modes. Eco limits speed to about 47 km/h (29 mph) and softens the power.',
          src: ['https://sur-ron.co.nz/products/surron-light-bee-x-2025'],
        },
        {
          id: 'bac4000', name: 'ASI BAC4000 kit', maker: 'Accelerated Systems', price: 12990, usd: 1299,
          specs: '12 kW tune · field weakening · regen',
          perks: ['modes', 'fieldWeakening', 'regen'], kw: 12,
          text: 'Field weakening spins the motor past its normal limit: about 20% more top speed. Regen slows you and settles the nose when you roll off.',
          style: { controller: { c: '#2b2d31', accent: '#3aa0ff' } },
          src: ['https://www.factoryminibikes.com/products/bac4000-stage-1-power-upgrade-kit-self-install'],
        },
        {
          id: 'tc500', name: 'Torp TC500', maker: 'Torp', price: 9990, usd: 999,
          specs: '500 A phase · up to 25 kW · regen · app',
          perks: ['modes', 'regen'], kw: 25,
          text: 'Up to 25 kW, but only about 8.5 kW on the stock battery. Adjustable regen.',
          style: { controller: { c: '#b9bdc3', accent: '#e2231a' } },
          src: ['https://chargedcycleworks.com/products/torp-tc500-controller'],
        },
        {
          id: 'ko-pro', name: 'KO Moto Pro Series', maker: 'KO Moto', price: 11000, usd: 1100,
          specs: '800 A phase · 35 kW peak · Bluetooth tuning', note: 'Price estimated; not published.',
          perks: ['modes'], kw: 35,
          text: 'Keeps the stock Sport and Eco switch. Anodised case.',
          style: { controller: { c: '#2f5fd0', accent: '#16171a' } },
          variants: [
            { label: 'Blue', style: { controller: { c: '#2f5fd0' } } },
            { label: 'Red', style: { controller: { c: '#c8232c' } } },
            { label: 'Purple', style: { controller: { c: '#7b3fc4' } } },
          ],
          src: ['https://radmotousa.com/products/copy-of-ko-moto-pro-series-controller'],
        },
        {
          id: 'tc1000', name: 'Torp TC1000 v2', maker: 'Torp', price: 12950, usd: 1295,
          specs: '1000 A phase · 50 kW peak · traction control · wheelie assist',
          perks: ['modes', 'traction', 'antiLoop', 'launch'], kw: 50,
          text: 'Traction control keeps the rear hooked up on wet ground and in mud. Wheelie assist cuts the power before you loop it. Launch control for the getaway.',
          style: { controller: { c: '#c9ccd1', accent: '#1d1e21' } },
          src: ['https://chargedcycleworks.com/products/torp-tc1000-controller-for-surron-light-bee-and-segway-x260-1'],
        },
        {
          id: 'x9000', name: 'EBMX X-9000 V3', maker: 'EBMX', price: 11990, usd: 1199,
          specs: '1600 A burst · 60 kW peak · IMU · E-Clutch · regen',
          perks: ['modes', 'antiLoop', 'launch', 'clutch', 'regen'], kw: 60,
          text: 'Its motion sensor runs launch control and anti-loop. The E-Clutch lets you slip the motor like a clutch: rev it, drop it, and the front comes up hard.',
          style: { controller: { c: '#16171a', accent: '#d8262e' } },
          variants: [
            { label: 'Black', style: { controller: { c: '#16171a' } } },
            { label: 'Red', style: { controller: { c: '#c8232c', accent: '#16171a' } } },
            { label: 'White', style: { controller: { c: '#e9eaec', accent: '#16171a' } } },
            { label: 'Blue', style: { controller: { c: '#2457c5', accent: '#16171a' } } },
          ],
          src: ['https://radmotousa.com/products/ebmx-x-9000-v3-controller-kit'],
        },
      ],
    },
    {
      id: 'motor', label: 'Motor',
      items: [
        {
          id: 'stock', name: 'Stock PMSM motor', maker: 'Sur-Ron', price: 0,
          specs: 'about 17 kW with an upgraded controller', kw: 17,
          text: 'Torp rates the stock motor at about 17 kW on its big controller.',
          src: ['https://chargedcycleworks.com/products/torp-tc1000-controller-for-surron-light-bee-and-segway-x260-1'],
        },
        {
          id: 'tm40', name: 'Torp TM40', maker: 'Torp', price: 12500, usd: 1250,
          specs: '42 kW peak · 93 Nm · 10,000 rpm · 12 kg', kw: 42, kg: 2.5, note: 'Weight gain over the stock motor is an estimate.',
          text: 'A much bigger motor. Needs a big controller and battery to show it.',
          style: { motor: { cover: '#c9ccd1', ring: '#e2231a', dash: false, fins: true, hub: '#1d1e21' } },
          src: ['https://chargedcycleworks.com/products/torp-tm40-motor-for-surron-light-bee'],
        },
        {
          id: 'tm40pro', name: 'Torp TM40 PRO', maker: 'Torp', price: 12600, usd: 1260,
          specs: '50 kW peak · 86 Nm · 11,000 rpm · 12 kg', kw: 50, kg: 2.5, vmax: 1.05, note: 'Weight gain over the stock motor is an estimate.',
          text: 'Revs higher than the TM40, for a little more top end.',
          style: { motor: { cover: '#1d1e21', ring: '#e2231a', dash: false, fins: true, hub: '#c9ccd1' } },
          src: ['https://chargedcycleworks.com/products/torp-tm40-motor-for-surron-light-bee'],
        },
      ],
    },
    {
      id: 'battery', label: 'Battery',
      items: [
        {
          id: 'stock', name: 'Stock 60 V 32 Ah pack', maker: 'Sur-Ron', price: 0,
          specs: '1.9 kWh · about 8.5 kW deliverable', kw: 8.5, volts: 60,
          text: 'Fine for the stock controller. It can’t feed a big one.',
          src: ['https://chargedcycleworks.com/products/torp-tc500-controller'],
        },
        {
          id: 'ewatt', name: 'eWatt v5 Race 72 V 42 Ah', maker: 'eWatt', price: 22000, usd: 2200,
          specs: '3.0 kWh · 400 A peak · 28 kW · 17.7 kg', kw: 28, volts: 72, kg: 8, note: 'Price and weight gain are estimates.',
          text: '72 V: about 20% more top speed.',
          style: { battery: { badge: '#e9eaec', badgeInk: '#1d1e21' } },
          src: ['https://chargedcycleworks.com/products/72v-42ah-race-battery-28kw-with-qs8-connector'],
        },
        {
          id: 'chi', name: 'Chi Gladiator 72 V Max 51 Ah', maker: 'Chi Battery Systems', price: 25000, usd: 2500,
          specs: '3.7 kWh · over 30 kW continuous', kw: 30, volts: 72, kg: 9, note: 'Weight gain is an estimate.',
          text: '72 V and a big pack.',
          style: { battery: { badge: '#f2b01e', badgeInk: '#1d1e21' } },
          src: ['https://chargedcycleworks.com/products/gladiator-72v-touring-60ah-surron-battery-maximum-range'],
        },
        {
          id: 'ebmx', name: 'EBMX v5 Race 72 V 42 Ah', maker: 'EBMX', price: 22000, usd: 2200,
          specs: '3.0 kWh · 400 A peak · 32 kW · stainless case · 17.7 kg', kw: 32, volts: 72, kg: 8,
          text: 'The most power of the three, in a stainless-steel case with a colour screen.',
          style: { battery: { badge: '#c9ccd1', badgeInk: '#d8262e' } },
          src: ['https://radmotousa.com/products/ebmx-72v-42ah-v5-race-battery-32kw-for-surron-light-bee'],
        },
      ],
    },
    {
      id: 'sprocket', label: 'Rear sprocket',
      items: [
        { id: 'stock', name: '48T (stock)', maker: 'Sur-Ron', price: 0, specs: '420 chain · 1:7.6 overall', teeth: 48, text: 'The standard balance of pull and top speed.', src: ['https://sur-ron.co.nz/products/surron-light-bee-x-l1e-sprocket-48t-mpc-13204-yq2a-0000'] },
        { id: '42', name: '42T steel', maker: 'Aftermarket', price: 600, usd: 60, specs: 'taller gearing', teeth: 42, text: '14% more top speed, 12% less pull.', style: { sprocket: '#9ea2a8' }, note: 'Price estimated.' },
        { id: '52', name: 'Warp 9 52T billet', maker: 'Warp 9', price: 900, usd: 90, specs: '7075 aluminium', teeth: 52, text: '8% more pull, 8% less top speed.', style: { sprocket: '#1d1e21' }, note: 'Price estimated.', src: ['https://warp9racing.com'] },
        { id: '58', name: '58T (Sur-Ron)', maker: 'Sur-Ron', price: 700, usd: 70, specs: 'OEM part MPC 13204-YQ2A-0200', teeth: 58, text: '21% more pull, 17% less top speed. Wheelies come up very easily.', note: 'Price estimated.', src: ['https://sur-ron.co.nz/products/surron-light-bee-x-sprocket-58t-mpc-13204-yq2a-0200'] },
      ],
    },
    {
      id: 'fork', label: 'Fork',
      items: [
        { id: 'stock', name: 'Stock inverted coil fork', maker: 'Sur-Ron', price: 0, specs: '200 mm travel', text: 'Soft and simple.' },
        {
          id: 'fastace', name: 'FastAce AHX12RV 3.0', maker: 'FastAce', price: 6990, usd: 699,
          specs: '200 mm · 18-click high/low-speed compression and rebound · 3.7 kg',
          susp: { forkK: 1.15, forkC: 1.25, absorb: 0.15, pop: 1.05 },
          text: 'Proper damping: the nose settles faster after a hit.',
          style: { fork: { upper: '#1d1e21', stanchion: '#c9ccd1', decal: '#e9eaec' } },
          variants: [
            { label: 'Black', style: { fork: { upper: '#1d1e21' } } },
            { label: 'Gold', style: { fork: { upper: '#c9a14a' } } },
            { label: 'Purple', style: { fork: { upper: '#6b3fb8' } } },
          ],
          src: ['https://goldenmotor.bike/products/fastace-ahx12rv-3-0-fork-for-surron-talaria'],
        },
        {
          id: 'kke', name: 'KKE Gold fork', maker: 'KKE', price: 6490, usd: 649,
          specs: '210 mm · 55 lb spring (stock 40) · hydraulic anti-bottom-out',
          susp: { forkK: 1.37, forkC: 1.15, forkTravel: 0.01, absorb: 0.12, pop: 1.15, antiBottom: true },
          text: 'Stiffer springs: a harder pop off a loaded fork, and it won’t clunk on landings.',
          style: { fork: { upper: '#a8823c', stanchion: '#c9a14a', clamp: '#1d1e21' } },
          src: ['https://chargedcycleworks.com/products/upgraded-kke-suspension-forks-for-surron-light-bee'],
        },
        {
          id: 'ext', name: 'EXT Ferro USD 36', maker: 'EXT', price: 20000, usd: 2000,
          specs: '205 mm · 36 mm chromed stanchions · HS3 air · 4.0 kg',
          susp: { forkK: 1.25, forkC: 1.5, forkTravel: 0.005, absorb: 0.28, pop: 1.12, antiBottom: true },
          text: 'Race damping. Logs and rocks barely slow you.',
          style: { fork: { upper: '#1d1e21', stanchion: '#e6e8ea', clamp: '#c8232c', ring: '#c8232c', decal: '#c8232c' } },
          src: ['https://faster-minis.com/products/ext-ferro-fork-surron-light-bee-talaria-sting'],
        },
      ],
    },
    {
      id: 'shock', label: 'Rear shock',
      items: [
        { id: 'stock', name: 'Stock shock, 450 lb spring', maker: 'Sur-Ron', price: 0, specs: '267 mm · 210 mm wheel travel', text: 'Bouncy over whoops.' },
        {
          id: 'kke', name: 'KKE shock', maker: 'KKE', price: 3490, usd: 349,
          specs: '450 lb · air chamber', susp: { rearC: 1.2, absorb: 0.06 },
          text: 'Better damping for the money.',
          style: { shock: { spring: '#1d1e21', reservoir: '#a8823c', collar: '#a8823c' } },
          src: ['https://chargedcycleworks.com/products/upgraded-kke-suspension-forks-for-surron-light-bee'],
        },
        {
          id: 'fastace', name: 'FastAce BDA53RC', maker: 'FastAce', price: 4500, usd: 450,
          specs: '265 mm · 3-way · piggyback · 550 lb spring', susp: { rearK: 1.22, rearC: 1.3, absorb: 0.08 }, note: 'Price estimated.',
          text: 'A firmer spring and a reservoir: keeps the rear hooked up over bumps.',
          style: { shock: { spring: '#d8262e', reservoir: '#1d1e21', collar: '#1d1e21' } },
        },
        {
          id: 'ext', name: 'EXT Arma MX', maker: 'EXT', price: 11750, usd: 1175,
          specs: '4-way · hydraulic bottom-out control · 14 mm shaft', susp: { rearK: 1.15, rearC: 1.55, absorb: 0.14, antiBottom: true },
          text: 'Race shock. Big landings and whoops stop mattering.',
          style: { shock: { spring: '#c8232c', body: '#1d1e21', reservoir: '#1d1e21', collar: '#c8232c' } },
          src: ['https://faster-minis.com/products/ext-arma-mx-rear-shock-surron-talaria'],
        },
      ],
    },
    {
      id: 'tyres', label: 'Tyres',
      items: [
        { id: 'stock', name: 'CST 70/100-19', maker: 'CST', price: 0, specs: 'general off-road · 2.0 kg', text: 'An all-rounder.' },
        {
          id: 'washougal', name: 'Kenda Washougal III', maker: 'Kenda', price: 1800, usd: 180,
          specs: 'MX intermediate/hard · 2.4 kg', grip: { dry: 1.1, wet: 0.98, mud: 0.92 }, note: 'Price estimated.',
          text: 'Bites hard on dry ground.',
          style: { tyre: { tread: 'hard', wall: '#e9eaec' } },
        },
        {
          id: 'mx34', name: 'Dunlop Geomax MX34', maker: 'Dunlop', price: 2000, usd: 200,
          specs: 'soft/intermediate · 2.5 kg', grip: { dry: 1.05, wet: 1.12, mud: 1.18 }, note: 'Price estimated.',
          text: 'Digs into soft ground: better in the wet and in mud.',
          style: { tyre: { tread: 'soft', wall: '#ffd400' } },
          src: ['https://chargedcycleworks.com/en-ca/pages/sur-ron-tire-upgrade-specs-and-weights'],
        },
        {
          id: 'starcross', name: 'Michelin StarCross 5 Medium', maker: 'Michelin', price: 2200, usd: 220,
          specs: 'intermediate · 3.2 kg', grip: { dry: 1.12, wet: 1.08, mud: 1.06 }, kg: 2, note: 'Price estimated.',
          text: 'Grips everywhere, but heavy.',
          style: { tyre: { tread: 'mx', wall: '#2f5fd0' } },
          src: ['https://chargedcycleworks.com/en-ca/pages/sur-ron-tire-upgrade-specs-and-weights'],
        },
      ],
    },
    {
      id: 'brakes', label: 'Brakes',
      items: [
        { id: 'stock', name: 'Stock 4-piston, 203 mm', maker: 'Sur-Ron', price: 0, specs: 'hydraulic · mineral oil', text: 'Adequate.' },
        {
          id: 'rotor220', name: '220 mm oversize rotors', maker: 'Aftermarket', price: 1200, usd: 120, brake: 1.12, note: 'Price estimated.',
          specs: '2.3 mm 12Cr13 steel', text: 'More bite from the rear brake, for catching wheelies.',
          style: { disc: { scale: 1.08 }, rearDisc: { scale: 1.08 } },
          src: ['https://ebikesupershop.com/products/surron-light-bee-220mm-brake-rotor-upgrade'],
        },
        {
          id: 'mt7', name: 'Magura MT7 Pro HC + 220 mm', maker: 'Magura', price: 5920, usd: 592, brake: 1.3,
          specs: '4-piston forged calipers · HC lever',
          text: 'Strong and precise: the rear brake drops the nose exactly as much as you ask.',
          style: { caliper: { c: '#16171a', label: '#d7f21e', pistons: 4 }, disc: { scale: 1.08, style: 'round' }, rearDisc: { scale: 1.08, style: 'round' } },
          src: ['https://chargedcycleworks.com/products/mt7-pro'],
        },
      ],
    },
    {
      id: 'light', label: 'Lights',
      items: [
        { id: 'stock', name: 'Stock headlight', maker: 'Sur-Ron', price: 0, specs: 'small round LED', light: { len: 9, spread: 0.26, power: 0.85 }, text: 'Enough to ride home on.' },
        {
          id: 's1', name: 'Baja Designs S1 kit', maker: 'Baja Designs', price: 2000, usd: 200,
          specs: '2,320 lm spot · amber rock guard', light: { len: 14, spread: 0.24, power: 1 },
          text: 'A much longer beam.',
          style: { light: { type: 'pod', housing: '#1d1e21' } }, // amber rock guard
          src: ['https://ezeryders.com/products/s1-headlight-kit-sur-ron-talaria'],
        },
        {
          id: 'squadron', name: 'Baja Designs Squadron 2.0 Pro', maker: 'Baja Designs', price: 2760, usd: 276,
          specs: '5,921 lm · 65 W · RGBW backlight', light: { len: 18, spread: 0.36, power: 1, ground: true },
          text: 'Floods the track, and lights the ground in front of you even with the front up. The RGBW backlight comes in your colour.',
          style: { light: { type: 'square', housing: '#1d1e21', back: '#3aa0ff' } },
          variants: [
            { label: 'Blue glow', style: { light: { back: '#3aa0ff' } } },
            { label: 'Red glow', style: { light: { back: '#ff3b3b' } } },
            { label: 'Green glow', style: { light: { back: '#3bff7a' } } },
            { label: 'Amber glow', style: { light: { back: '#ffb21a' } } },
          ],
          src: ['https://ezeryders.com/products/squadron-2-0-pro-headlight-kit-sur-ron-2018-24-light-bee-x-talaria-2022-24-sting-mx3-mx4-baja-designs'],
        },
      ],
    },
    {
      id: 'wheels', label: 'Wheels',
      items: [
        { id: 'stock', name: 'Stock 19″ wheels', maker: 'Sur-Ron', price: 0, specs: 'black rims', text: 'Black rims, silver spokes.' },
        {
          id: 'warp9', name: 'Warp 9 19″/16″ set', maker: 'Warp 9', price: 5690, usd: 569, kg: -0.6, note: 'Weight saving is an estimate.',
          specs: 'billet hubs · powder-coat colours',
          text: 'Lighter wheels in the colour you pick.',
          style: { rim: '#d7f21e', hub: '#1d1e21' },
          variants: [
            { label: 'Fluoro yellow', style: { rim: '#d7f21e' } },
            { label: 'Fire red', style: { rim: '#d8262e' } },
            { label: 'Yamaha blue', style: { rim: '#2457c5' } },
            { label: 'White', style: { rim: '#e9eaec' } },
            { label: 'Nardo grey', style: { rim: '#8e9196' } },
          ],
          src: ['https://chargedcycleworks.com/products/warp9-custom-wheel-colors-for-surron-segway'],
        },
        {
          id: 'kke', name: 'KKE 19″/16″ set', maker: 'KKE', price: 4500, usd: 450, note: 'Price estimated.',
          specs: 'black rims · red nipples',
          text: 'Black with a flash of red.',
          style: { rim: '#16171a', spoke: '#d8262e', hub: '#d8262e' },
          src: ['https://chargedcycleworks.com/products/kke-19-16-wheel-set-surron-light-bee-red-nipples'],
        },
      ],
    },
    {
      id: 'paint', label: 'Frame colour',
      items: [
        { id: 'stock', name: 'Sage Green', maker: 'Sur-Ron', price: 0, specs: 'factory colour', text: 'The classic.' },
        { id: 'black', name: 'Carbon Black', maker: 'Sur-Ron', price: 3000, specs: 'factory colour (MY25)', text: 'Stealthy.', style: { paint: { ramp: ['#141518', '#26282c', '#3d4046'] } } },
        { id: 'blue', name: 'Lapis Blue', maker: 'Sur-Ron', price: 3000, specs: 'factory colour (MY25)', text: 'Deep blue.', style: { paint: { ramp: ['#14254f', '#1f3c86', '#3d63bf'] } } },
        { id: 'purple', name: 'Phantom Purple', maker: 'Sur-Ron', price: 3000, specs: 'factory colour (MY25, MY26)', text: 'Loud.', style: { paint: { ramp: ['#2b1745', '#4a2a78', '#7550b0'] } } },
      ],
    },
  ];

  /* ---------------- Stark Varg MX 1.2 ---------------- */

  const VARG = [
    {
      id: 'power', label: 'Power',
      items: [
        {
          id: 'stock', name: 'MX 1.2 Standard', maker: 'Stark Future', price: 0,
          specs: '60 hp · 5 maps on the bars · engine braking', kw: 45,
          perks: ['modes', 'regen'],
          text: 'Five power maps on the handlebar switch, and adjustable engine braking: roll off and the nose settles.',
          src: ['https://starkfuture.com/en-us-KE/products/stark-varg'],
        },
        {
          id: 'alpha', name: 'MX 1.2 Alpha', maker: 'Stark Future', price: 10000, usd: 1000,
          specs: '80 hp · 973 Nm at the wheel · traction control', kw: 60,
          perks: ['modes', 'regen', 'traction'],
          text: 'Full power, and the traction control Stark added to Alpha bikes in June 2026.',
          style: { motor: { label: '#d8262e' } },
          src: ['https://powersportsbusiness.com/news/electric/2026/06/30/stark-adds-traction-control-to-varg-lineup-as-it-captures-x-games-gold/'],
        },
      ],
    },
    {
      id: 'suspension', label: 'Suspension',
      items: [
        { id: 'stock', name: 'KYB 48 mm fork and shock', maker: 'KYB', price: 0, specs: '310 mm fork · 303 mm rear travel', text: 'Full-size motocross suspension.' },
        {
          id: 'akit', name: 'KYB Factory A-Kit', maker: 'KYB', price: 35000, usd: 3500, note: 'Stark sells it on the Factory Edition; the price here is an estimate.',
          specs: 'Kashima-coated tubes · DLC-coated stanchions and shock rod',
          susp: { forkC: 1.4, rearC: 1.35, absorb: 0.25, pop: 1.1, antiBottom: true },
          text: 'Factory race suspension. Gold Kashima tubes.',
          style: { fork: { upper: '#c9a14a', stanchion: '#2b2d31' }, shock: { body: '#c9a14a', spring: '#1d1e21' } },
          src: ['https://www.motorcycle.com/bikes/stark-future-unveils-limited-varg-mx-ex-factory-editions-44668504'],
        },
      ],
    },
    {
      id: 'tyres', label: 'Tyres',
      items: [
        { id: 'stock', name: 'Pirelli Scorpion MX32 Mid Soft', maker: 'Pirelli', price: 0, specs: 'soft/intermediate', text: 'A good all-rounder.', style: { tyre: { tread: 'mx', wall: '#ffd400' } } },
        {
          id: 'mx34', name: 'Dunlop Geomax MX34', maker: 'Dunlop', price: 2400, usd: 240, note: 'Price estimated.',
          specs: 'soft/intermediate', grip: { dry: 1.04, wet: 1.1, mud: 1.12 },
          text: 'The Factory Edition’s tyre. A little better in the wet.',
          style: { tyre: { tread: 'soft', wall: '#ffd400' } },
        },
        {
          id: 'mx14', name: 'Dunlop Geomax MX14', maker: 'Dunlop', price: 2400, usd: 240, note: 'Price estimated.',
          specs: 'sand and mud', grip: { dry: 0.94, wet: 1.15, mud: 1.45 },
          text: 'Paddle-like knobs: mud stops mattering, hard ground gets slippery.',
          style: { tyre: { tread: 'mud', wall: '#ffd400' } },
        },
        {
          id: 'midhard', name: 'Pirelli MX32 Mid Hard', maker: 'Pirelli', price: 2400, usd: 240, note: 'Price estimated.',
          specs: 'medium/hard ground', grip: { dry: 1.12, wet: 0.95, mud: 0.85 },
          text: 'Best on dry, hard dirt.',
          style: { tyre: { tread: 'hard', wall: '#ffd400' } },
        },
      ],
    },
    {
      id: 'sprocket', label: 'Gearing',
      items: [
        { id: 'stock', name: '13/48 (stock)', maker: 'Stark Future', price: 0, specs: '520 gold chain · 7075 rear sprocket', teeth: 48, text: 'As it comes.' },
        { id: '45', name: '13/45', maker: 'Supersprox', price: 900, usd: 90, specs: 'taller gearing', teeth: 45, text: '7% more top speed, 6% less pull.', style: { sprocket: '#d8262e' }, note: 'Price estimated.' },
        { id: '49', name: '13/49', maker: 'Supersprox', price: 900, usd: 90, specs: 'what many owners run', teeth: 49, text: '2% more pull.', style: { sprocket: '#1d1e21' }, note: 'Price estimated.' },
      ],
    },
    {
      id: 'brakes', label: 'Brakes',
      items: [
        { id: 'stock', name: 'Brembo, 260 mm Galfer front', maker: 'Brembo', price: 0, specs: '2-piston front · 220 mm rear', text: 'Motocross brakes.' },
        {
          id: 'sm', name: 'Varg SM Brembo monoblock', maker: 'Brembo', price: 9000, usd: 900, brake: 1.25, note: 'From the supermoto Varg; price estimated.',
          specs: '4-piston radial monoblock · 320 mm floating disc',
          text: 'The supermoto’s brakes. Big bite for steering a wheelie with the rear.',
          style: { caliper: { c: '#9a1b1f', pistons: 4 }, disc: { scale: 1.2, style: 'round', carrier: '#c9a14a' } },
          src: ['https://www.newsfilecorp.com/release/232789'],
        },
      ],
    },
    {
      id: 'light', label: 'Lights',
      items: [
        { id: 'stock', name: 'None (race bike)', maker: 'Stark Future', price: 0, specs: 'no lights', light: null, text: 'The MX has no lights. At night you ride by the moon.' },
        {
          id: 'ex', name: 'Varg EX headlamp', maker: 'Stark Future', price: 4500, usd: 450, note: 'From the enduro Varg; price estimated.',
          specs: '4,000 lm · integrated indicators', light: { len: 16, spread: 0.32, power: 1 },
          text: 'The enduro bike’s headlamp.',
          style: { light: { type: 'stock', housing: '#1d1e21' }, plate: '#1d1e21' },
          src: ['https://www.newsfilecorp.com/release/232789'],
        },
      ],
    },
    {
      id: 'paint', label: 'Colour',
      items: [
        { id: 'stock', name: 'Stark Red', maker: 'Stark Future', price: 0, specs: 'factory colour', text: 'Red plastics.' },
        { id: 'white', name: 'Stark Snow White', maker: 'Stark Future', price: 4000, specs: 'MX 1.2 colour', text: 'White plastics.', style: { paint: { ramp: ['#a7abb1', '#d9dce0', '#f4f5f7'] } } },
        { id: 'grey', name: 'Forest Grey', maker: 'Stark Future', price: 4000, specs: 'EX Factory colour', text: 'Dark green-grey.', style: { paint: { ramp: ['#25302a', '#3c4a41', '#5d6d62'] } } },
      ],
    },
  ];

  const CATALOG = { 'surron-lbx': SURRON, 'stark-varg-mx': VARG };

  // Ride modes each bike's electronics offer: share of power, top-speed cap
  // (km/h) and how quickly the throttle comes in.
  const MODES = {
    'surron-lbx': [
      { name: 'Sport', power: 1, cap: 0, ramp: 1 },
      { name: 'Eco', power: 0.55, cap: 47, ramp: 0.6 },
    ],
    'stark-varg-mx': [
      { name: 'Map 5', power: 1, cap: 0, ramp: 1 },
      { name: 'Map 4', power: 0.8, cap: 0, ramp: 0.85 },
      { name: 'Map 3', power: 0.6, cap: 0, ramp: 0.7 },
      { name: 'Map 2', power: 0.42, cap: 0, ramp: 0.6 },
      { name: 'Map 1', power: 0.25, cap: 0, ramp: 0.5 },
    ],
  };

  const PERKS = {
    modes: { label: 'Ride modes', key: 'Q', text: 'Switch power maps on the move' },
    traction: { label: 'Traction control', text: 'No wasted wheelspin in the wet or mud' },
    antiLoop: { label: 'Anti-loop', key: 'E', text: 'Cuts power just below the sweet spot, then drags the motor to bring the nose down. E switches it off' },
    launch: { label: 'Launch control', key: '↑+↓', text: 'Hold gas and brake at the start, let go of the brake' },
    clutch: { label: 'E-Clutch', key: 'Shift', text: 'Hold to rev, let go to drop the clutch' },
    regen: { label: 'Regen', text: 'Rolling off slows you and settles the nose' },
    fieldWeakening: { label: 'Field weakening', text: '20% more top speed' },
  };

  function slotsFor(bikeId) { return CATALOG[bikeId] || []; }
  function item(bikeId, slotId, itemId) {
    const slot = slotsFor(bikeId).find((s) => s.id === slotId);
    return slot && (slot.items.find((i) => i.id === itemId) || slot.items[0]);
  }

  // Merge style objects one level deep.
  function mergeStyle(into, add) {
    if (!add) return into;
    for (const k in add) {
      const v = add[k];
      into[k] = v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object' ? Object.assign({}, into[k], v) : v;
    }
    return into;
  }

  // A build: { slotId: itemId } plus { slotId + ':v': variantIndex }.
  // Returns the spec handed to the physics, the mods and perks on top, the
  // ride modes, the headlight and the look.
  function apply(bike, build) {
    build = build || {};
    const pick = (slot) => item(bike.id, slot, build[slot] || 'stock');
    const fitted = {};
    const perks = new Set();
    const style = {};
    const mods = { torque: 1, vmax: 1, grip: { dry: 1, wet: 1, mud: 1 }, brake: 1, absorb: 0, pop: 1, susp: {}, antiBottom: false };
    let kg = 0, volts = bike.id === 'surron-lbx' ? 60 : 0, light = undefined;
    const caps = [];
    for (const slot of slotsFor(bike.id)) {
      const it = pick(slot.id);
      fitted[slot.id] = it;
      for (const p of it.perks || []) perks.add(p);
      if (it.kw) caps.push(it.kw);
      if (it.kg) kg += it.kg;
      if (it.volts) volts = it.volts;
      if (it.vmax) mods.vmax *= it.vmax;
      if (it.teeth) { const r = it.teeth / 48; mods.torque *= r; mods.vmax /= r; }
      if (it.grip) for (const k in it.grip) mods.grip[k] *= it.grip[k];
      if (it.brake) mods.brake *= it.brake;
      if (it.susp) {
        for (const k of ['forkK', 'forkC', 'rearK', 'rearC']) if (it.susp[k]) mods.susp[k] = (mods.susp[k] || 1) * it.susp[k];
        for (const k of ['forkTravel', 'rearTravel']) if (it.susp[k]) mods.susp[k] = (mods.susp[k] || 0) + it.susp[k];
        mods.absorb += it.susp.absorb || 0;
        if (it.susp.pop) mods.pop *= it.susp.pop;
        if (it.susp.antiBottom) mods.antiBottom = true;
      }
      if ('light' in it) light = it.light;
      mergeStyle(style, it.style);
      const v = it.variants && it.variants[build[slot.id + ':v'] | 0];
      if (v) mergeStyle(style, v.style);
    }
    if (bike.id === 'surron-lbx' && volts) mods.vmax *= volts / 60;
    if (perks.has('fieldWeakening')) mods.vmax *= 1.2;
    mods.absorb = Math.min(0.5, mods.absorb);
    const kw = caps.length ? Math.min(...caps) : bike.peakPowerKw;
    const spec = Object.assign({}, bike, {
      peakPowerKw: kw,
      weightKg: bike.weightKg + kg,
      topSpeedKmh: Math.round(bike.topSpeedKmh * mods.vmax),
    });
    if (light === undefined) light = { len: 9, spread: 0.26, power: 0.85 };
    return { spec, mods, perks, modes: MODES[bike.id] || [MODES['surron-lbx'][0]], light, style, fitted };
  }

  // The cost to fit `itemId`, or 0 if it's already owned.
  function owned(own, bikeId, slotId, itemId) {
    return itemId === 'stock' || !!(own && own[`${bikeId}/${slotId}/${itemId}`]);
  }

  const api = { CATALOG, MODES, PERKS, slotsFor, item, apply, owned, mergeStyle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parts = api;
})(typeof self !== 'undefined' ? self : this);
