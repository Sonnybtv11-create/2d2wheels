# 2D2Wheels

A 2D wheelie game in the browser. Ride a Sur-Ron Light Bee X or a Stark Varg MX: pop the front wheel up and keep it there, over logs, rocks and tyre stacks, through mud and puddles, and away from the police. Choose the time of day, the weather and how wanted you are. Spend the points you score on real upgrade parts, each with the specs and features of the real product, and each one changing how the bike looks.

There's no build step and nothing to install. The display fonts load from Google Fonts; offline, the page falls back to system fonts. Open `index.html` in a browser, or serve the folder (`npm start` runs `python3 -m http.server 8080`). It works on desktop and on phones (on-screen buttons appear on touch devices).

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | `↑` / `W` / `Space` | GAS |
| Brake (drops the front) | `↓` / `S` | BRAKE |
| Lean back / forward | `←` `A` / `→` `D` | ◀ LEAN / LEAN ▶ |
| Ride mode (power map) | `Q` | MODE |
| E-Clutch (if fitted) | `Shift` | CLUTCH |
| Anti-loop on/off (if fitted) | `E` | ASSIST |
| Retry / Menu / Sound | `R` / `Esc` / `M` | buttons |

- **The pop:** on the gas, snap into a lean-back and the front comes up. Dip forward first to load the fork for a bigger pop. Then hold the wheelie with the throttle and the brake.
- **The front wheel can come down.** Riding on two wheels is fine, but you're faster on one: in a wheelie the bike slips through the air more easily and can go past its usual top speed. The gauge in the bottom-left shows how far up the front is.
- **Obstacles:** logs and rocks can be ridden over, but they knock speed off and jolt the suspension. Tyre stacks can't: get the front wheel over them or you go over the bars. Cones get knocked flying. Clearing an obstacle with the front up scores a bonus. A marker on the right edge warns you about the next obstacle before it comes on screen.
- **Police:** a cruiser sets off a few seconds after you, and it gets faster the longer you ride. After about a minute it's faster than any bike on two wheels, so you need to wheelie to stay ahead. If it reaches you, you're busted. Letting it get within a few metres and then pulling away scores a close call.
- **Wanted level** (picked in the garage) sets how hard they come after you, and multiplies every point you score:

  | Wanted | What changes | Points |
  | --- | --- | --- |
  | ★ | A slow cruiser that sets off late | ×1 |
  | ★★ | The standard chase | ×1.5 |
  | ★★★ | Faster, and cruisers parked by the track lay stingers (spike strips) ahead of you. Get the front wheel over them | ×2 |
  | ★★★★ | A helicopter keeps you in its searchlight, so the cars never fall far behind | ×3 |
  | ★★★★★ | An unmarked interceptor replaces the cruiser | ×4 |
- **Scoring:** 1 point per metre on two wheels, 2 on the back wheel and 4 in the sweet spot just under the balance point (the gauge glows). Plus bonuses for obstacles and stingers cleared, cones and close calls. Everything is multiplied by your wanted level, and it all goes into your bank for the workshop.
- **The strip at the top** shows the police behind you, then the obstacles (tyre stacks in red), mud, whoops and puddles ahead.
- A run ends when you loop out, go over the bars, hit a tyre stack or a stinger, or get busted. Your best score, furthest distance, points and parts are saved in the browser.

### Time of day and weather

Pick them in the garage. **Sunset** starts in daylight and runs into the night over about a minute; dawn does the opposite, and day and night barely change. The sky, mesas and ground colours follow the sun. When it gets dark the bike's headlight clicks on (it points wherever the bike points, so it lights up the sky in a big wheelie), and the police car's headlights and light bar light the track.

- **Windy:** gusts come and go. The tape bellies, windsocks swing, the scrub sways, and dust and leaves blow across the screen. A headwind slows you and lifts the nose; a tailwind does the opposite. The HUD shows the wind's speed and direction.
- **Rain:** streaks blow sideways with the wind and your speed, and splash on the ground. The track gets wet (less grip), puddles fill with water (even less grip, and a rooster tail of spray), and the dust settles.
- **Storm:** heavy rain, strong wind, dark clouds, lightning flashes, and thunder that rolls in a moment later.
- **Random** picks one of these each run.

## The bikes

| Bike | Stock | Peak power | Weight | Top speed |
| --- | --- | --- | --- | --- |
| Sur-Ron Light Bee X | 2024 model, 60 V 32 Ah | 6 kW | 56 kg | 75 km/h |
| Stark Varg MX | MX 1.2 Standard, 7.2 kWh | 45 kW (60 hp); 60 kW (80 hp) as an Alpha | 118 kg | 142 km/h |

The Sur-Ron is the bike that started the light e-moto craze and the most modified bike in the sport, so it's gentle stock and wild once you build it. The Varg is a full-size electric motocross bike. Stark doesn't publish a top speed; 142 km/h is where its dash reportedly stops counting.

Specs come from manufacturer and retailer listings, and each bike's sources are in `js/bikes.js` and linked in the game menu. This is a fan game and isn't affiliated with any of these brands.

## The workshop

The points you score go into a bank, and the workshop (a tab in the garage) spends them on real parts. Prices are about ten points per US dollar of the real part. Each card shows the part's real specs and features, what it changes compared with your current build, and a link to where the figures came from. Where a maker didn't publish something (most part weights, some prices), the card says it's an estimate. Hover over a part to preview it on the bike.

**Sur-Ron Light Bee X**
- **Controller:** stock (Sport/Eco), ASI BAC4000, Torp TC500, KO Moto Pro, Torp TC1000 v2 or EBMX X-9000 V3.
- **Motor:** stock, Torp TM40 or TM40 PRO.
- **Battery:** stock 60 V, or a 72 V pack from eWatt, Chi Battery Systems or EBMX.
- **Rear sprocket:** 42T, 48T (stock), 52T or 58T.
- **Fork:** stock, FastAce AHX12RV 3.0, KKE Gold or EXT Ferro.
- **Shock:** stock, KKE, FastAce BDA53RC or EXT Arma MX.
- **Tyres:** stock CST, Kenda Washougal III, Dunlop Geomax MX34 or Michelin StarCross 5.
- **Brakes:** stock, oversize rotors or Magura MT7 Pro.
- **Lights:** stock, Baja Designs S1 or Squadron 2.0 Pro.
- **Wheels:** stock, Warp 9 (five colours) or KKE.
- **Frame colour:** Sur-Ron's factory colours.

**Stark Varg MX**
- **Power:** Standard or Alpha.
- **Suspension:** stock KYB or the KYB Factory A-Kit.
- **Tyres:** Pirelli MX32 Mid Soft (stock) or Mid Hard, or Dunlop MX34 or MX14.
- **Gearing:** 13/45, 13/48 (stock) or 13/49.
- **Brakes:** stock, or the Varg SM's Brembo monoblock and 320 mm disc.
- **Lights:** the MX has none; fit the Varg EX headlamp.
- **Colour:** Stark Red, Snow White or Forest Grey.

How parts change the bike:
- **Power** is the lowest of what the controller, motor and battery can deliver. The stock Sur-Ron pack can only feed about 8.5 kW, so a big controller needs a 72 V battery before it shows, and the motor after that.
- **Top speed** scales with pack voltage and gearing; gearing also scales the pull off the line.
- **Suspension** sets spring rates, damping and travel. Better damping loses less speed over logs and rocks, and stiffer fork springs give a bigger pop.
- **Tyres** change grip on dry dirt, in the wet and in mud. **Brakes** change how hard the rear brake pulls the nose down. **Lights** set how far and how wide the beam reaches at night.
- **Perks** are features the real products advertise:
  - **Ride modes:** Sur-Ron Sport/Eco (Eco caps you at 47 km/h with a softer throttle), the Varg's five maps. Press `Q`.
  - **Traction control:** Torp TC1000, Varg Alpha. A spinning tyre pushes less than one at the limit of grip; traction control keeps it at the limit, which matters in the wet and in mud.
  - **Anti-loop:** EBMX X-9000 V3, Torp TC1000. It looks at the pitch and how fast it's rising, cuts the power just below the sweet spot, then drags the motor to bring the nose down. `E` switches it off when you want to chase ×4.
  - **Launch control:** EBMX, Torp. Hold gas and brake at the start, let go of the brake: full throttle at the limit of grip with the front held low.
  - **E-Clutch:** EBMX. Hold `Shift` with the gas and the motor revs without driving; let go and it bites, for a clutch-up wheelie much bigger than a lean pop.
  - **Regen:** ASI, Torp TC500, EBMX, the Varg's engine braking. Rolling off slows you and settles the nose.
  - **Field weakening:** ASI BAC4000. About 20% more top speed.
- **Every part changes the look:** fork tubes and clamps, shock spring and reservoir, motor cover, controller box, battery badge, tyre tread and sidewall colours, rims and spokes, brake discs and calipers, sprocket, lamp, and the frame or plastics colour.

## Art

Both bikes are vectorised straight from side-on product photos: a green Sur-Ron Light Bee X and a red Stark Varg MX. `tools/vectorize_bike.py` splits each photo into its colour classes (frame green, decal yellow, red plastics, neutrals), cuts each class into shade bands that follow the real lighting, and traces every band into polygons (`js/traced/`). The traces stay in the photo's own pixel coordinates; `js/bikeart.js` calibrates them (both axle centres, the real wheelbase and the tyre radius) and converts them to metres when the page loads, so wheel size, seat height and peg position keep their real proportions.

Anything that moves or can be upgraded is cut out of the trace and drawn by code from a style: the wheels and tyres, brakes, chain and sprockets, the fork (its stanchions and guards slide with the suspension), the rear shock, motor cover, controller, lamp, number plate and bars. That's how fitted parts restyle the bike. A new frame or plastics colour re-maps the traced shade bands onto the new colour, so it keeps the photo's lighting.

The rider is drawn in motocross gear (helmet with peak and goggles, neck brace, jersey, knee braces, boots). Knees and elbows are placed with two-bone IK, so the same rider fits every bike's seat, pegs and bars, and leaning moves the hips and torso. Each bike has a matching rider kit.

The track is a desert motocross course: layered mesas, Joshua trees, course tape and windsocks, distance boards, dust from the rear tyre, and a shadow under the bike. Both wheels move on their suspension as you ride: the front slides along the fork, the rear swings with the shock, and you can see them soak up landings and bumps.

## How the physics works

`js/physics.js` is a small arcade model with no DOM, so it can be tested in Node. The feel knobs live together in `TUNE`.

- The chassis has two degrees of freedom: heave (up and down) and pitch about the rear axle. A rear shock and a front fork hold it up, each a spring with a damper. Rebound is damped harder than compression, like a real shock, so a hit is soaked up instead of springing the bike into the air. At the end of their travel the shock and fork stop hard, with a clunk.
- Each wheel follows the ground under it, allowing for the tyre's curve, so bumps, logs and rocks push the wheel up through its suspension. Landing on the front loads the fork and the nose bounces; braking hard with both wheels down dives the fork.
- Drive force at the rear tyre lifts the nose and the brake pulls it down. Gravity pulls the nose down until the centre of mass passes over the rear axle (the balance point), and past that it pulls the bike over. Gravity is felt in the chassis's accelerating frame, so a compression lightens the nose and a drop off a crest makes it heavy.
- Rear grip depends on the load on the rear tyre and on the surface: dry, wet, mud or a puddle. Ask for more than the tyre can give and it spins.
- Air drag acts at the centre of mass, so it cancels out of the pitch balance, as on a real bike, and the throttle keeps its bite at top speed. In a wheelie the bike gets an arcade speed boost, which is felt in speed but not in pitch.
- The pop: snapping into a lean-back on the gas, with the front down or only just up, kicks the nose up. Loading the fork first (leaning forward) makes it bigger.
- In the air, only the wheels move the bike: gas rotates it nose-up, the brake nose-down.
- Wind pushes on the rider, high above the centre of mass. A headwind lifts the nose and slows you, a tailwind does the opposite.
- The police car accelerates to a target speed set from the bike's top speed. The target climbs over time and goes up further when the car falls far behind. The wanted level sets the start, the climb and the catch-up, and from three stars spike strips are laid at least 55 m ahead (about three seconds) and clear of obstacles.
- It runs at a fixed 240 Hz, so it behaves the same at any frame rate.

The tuning was checked with simulated players that have human limits: 120–280 ms reactions, noisy judgement of the angle, on/off keys. They played every bike over many seeded runs, with the police and in every kind of weather, and the same kind of controller played the real game in a browser through key presses. With the police on, typical runs last somewhere between half a minute and a minute or more, and end in a mix of tyre stacks, loop-outs and busts.

## Project layout

```
index.html        page, HUD and menus
css/style.css
js/bikes.js       bike roster, specs and sources
js/physics.js     bike, suspension, perks, terrain, obstacles, weather and police (no DOM)
js/parts.js       workshop parts: real specs, effects, perks and looks (no DOM)
js/bikeart.js     traced bike art, wheels, rider and kits (no DOM)
js/traced/        photo-vectorised bike layers
tools/            vectorize_bike.py, the photo vectoriser (needs OpenCV)
js/atmosphere.js  time of day, rain, wind, lightning and lighting
js/render.js      canvas drawing: sky, track, obstacles, police car, gauge
js/game.js        game loop, input, scoring, HUD, synthesized audio, menus
tests/            node:test suites for the physics and the art data
```

Run the tests with `npm test` (Node 18+). They check that the art's calibration matches the physics (wheelbase and wheel size), that the bike settles on its suspension at rest, that the pop lifts the front quickly and that pinning the throttle loops out but leaves time to react, that the front can come back down and the fork dives under braking, that a hard landing is absorbed, that a careful rider can hold a wheelie for a minute on every bike, that a wheelie is faster than riding on two wheels, that a tyre stack crashes you unless you pop over it, that the police catch a slow rider but not a fast wheelie, that wet ground has less grip and wind pushes the right way, and that the result doesn't depend on frame rate. Higher wanted levels catch a slow rider sooner, and a stinger ends the run unless the front wheel is up.

`tests/parts.test.js` covers the workshop:
- Every slot has a stock option, and a stock build is the stock bike.
- The Sur-Ron battery gates a big controller's power, and a 72 V pack adds top speed.
- The Alpha has traction control, and it gets the Varg off the line quicker in the wet.
- Anti-loop stops a pinned throttle from looping the bike.
- Dropping the E-Clutch lifts the front harder than a lean pop.
- Eco mode holds the cap, launch control beats a raw launch, and regen slows you when you roll off.
- Better suspension loses less speed over a log.
- Every part draws.
