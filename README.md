# 2D2Wheels

A 2D wheelie game in the browser. Ride a Sur-Ron Light Bee X or a Stark Varg MX: pop the front wheel up and keep it there, over logs, rocks and tyre stacks, through mud and puddles, and away from the police. Choose the time of day, the weather and how wanted you are. Spend the points you score on real upgrade parts, each with the specs and features of the real product, and each one changing how the bike looks.

There's no build step and nothing to install. The display fonts load from Google Fonts; offline, the page falls back to system fonts. Open `index.html` in a browser, or serve the folder (`npm start` runs `python3 -m http.server 8080`). It works on desktop and on phones (on-screen buttons appear on touch devices).

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | `↑` / `W` / `Space` | GAS |
| Brake (drops the front) | `↓` / `S` | BRAKE |
| Lean back / forward (tuck) | `←` `A` / `→` `D` | ◀ LEAN / LEAN ▶ |
| Ride mode (power map) | `Q` | MODE |
| E-Clutch (if fitted) | `Shift` | CLUTCH |
| Anti-loop on/off (if fitted) | `E` | ASSIST |
| Arm swing (hold) | `Z` or `J` | SWING |
| Hand drag (hold) | `X` or `K` | DRAG |
| Seat surf (hold) | `C` or `L` | SURF |
| Retry / Menu / Sound | `R` / `Esc` / `M` | buttons |

- **The pop:** on the gas, snap into a lean-back and the front comes up. Dip forward first to load the fork for a bigger pop. Then hold the wheelie with the throttle and the brake.
- **Two wheels are fast, one wheel scores.** Hold → on two wheels to **tuck** down over the bars: about 17% more top speed and harder acceleration. A wheelie scores more but is slower, and the higher you hold it the slower you go (a low wheelie keeps close to top speed; one in the ×4 sweet spot is about 60% of it). So it's a trade: tuck to make ground on the police, wheelie to score when you have a gap. The gauge in the bottom-left shows how far up the front is.
- **Obstacles** ask for one of three things:
  - **Pop over:** tyre stacks and stingers. Get the front wheel over them or you crash.
  - **Tuck under:** low pipelines and boom-gate barriers. Front down and hold → to duck under. Sitting up, or with the front up, you hit them.
  - **Ride over:** logs and rocks. They knock speed off and jolt the suspension.

  Cones just get knocked flying. Clearing a hazard scores a bonus.
- **Warnings:** every hazard has plenty of warning:
  - **Trackside signs** about two seconds ahead: yellow for pop, blue for tuck.
  - **Edge markers** for the next two hazards before they're on screen, saying POP ▲, TUCK ▼ or what you're riding over, with the distance.
  - **A countdown prompt** for the next hazard that needs an action. It turns green when you're set up right and flashes red if you're late.
  - **Beeps:** rising for pop, falling for tuck.
  - **Radar icons:** tuck hazards hang from the top of the strip, pop hazards stand up from it.
  - **Reflective bands** so hazards show up at night.
- **Police:** a cruiser sets off a few seconds after you, and it gets faster the longer you ride. After about a minute it's faster than a wheelie can go, and only a tuck stays ahead of it. If it reaches you, you're busted. Letting it get within a few metres and then pulling away scores a close call.
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
- A run ends when you loop out, go over the bars, hit a tyre stack, a stinger, a pipe or a barrier, buckle your arm in a hand drag, fall off the seat, or get busted. Your best score, furthest distance, points and parts are saved in the browser.

### Tricks

The three classic e-bike video stunts. Hold the key to do one, let go to stop. The left-hand keys (`Z X C`) are for riding on the arrows, the right-hand ones (`J K L`) for riding on `WASD`, so your balance keys stay where they are.

Each one is modelled on how riders actually do it in e-bike videos:
- **Arm swing (×1.5):** the near hand comes off the bar, and the straight arm swings forward and back from the shoulder like a pendulum.
  - That's the hand on the rear brake lever, so there's no brake while you swing.
  - The swinging arm rocks the bike in time with it.
- **Hand drag (×3 while the glove is on the ground):**
  - **The pose:** the rider sits on the back of the seat and hangs off the near side, leaning back. The far hand holds the grip on a straight arm, the knees grip the seat and the feet stay on the pegs. The shoulders twist so the near one drops, and that arm hangs straight down.
  - **How the balance works:** that position moves the bike's balance point close to vertical, about 59° on the Sur-Ron and 69° on the Varg. There, the glove skims the ground (the multiplier counts while it's within a few centimetres). You hold the bike there with the throttle, as in any near-vertical wheelie. The hand mostly drags; it doesn't hold you up.
  - **Leaning on the hand:** go a few degrees further and the hand props the bike up, throwing sparks and costing speed. Drive the bike onto it with the gas and the arm buckles; the HUD shows the strain.
  - **Getting out:** let go and the hand pushes you back up while your weight comes forward. Lean forward to bring the front down.
  - Hand drags are slow-speed tricks: get the bike up high on the gas first.
- **Seat surf (×2):** climb up and stand on the back of the seat, bent forward with both hands still on the bars, the way surfing is done on these bikes.
  - Throttle and brake work as normal.
  - Your weight is higher and further back, so the bike balances about 6° lower, and leaning (← →) moves it more.
  - Any hard bump or landing throws you off.

The multipliers stack with the wheelie ones, so a hand drag in a wheelie is worth ×6. The results show how far you went doing each trick.

### Location

- **Desert track:** the full game, with obstacles, police and points for the workshop.
- **Airfield:** a flat, endless runway with no obstacles and no police, for practising wheelies, pops and tucks at speed.
  - The runway is asphalt, so it grips a little better and rolls easier than dirt. Edge lights come on at night.
  - It's practice, so it pays no points. Instead it keeps your longest wheelie and top speed there for each bike.

### Time of day and weather

Pick them in the garage. **Sunset** starts in daylight and runs into the night over about a minute; dawn does the opposite, and day and night barely change. The sky, mesas and ground colours follow the sun. When it gets dark the bike's headlight clicks on (it points wherever the bike points, so it lights up the sky in a big wheelie), and the police car's headlights and light bar light the track.

- **Rain:** streaks slant with your speed and splash on the ground. The track gets wet (less grip), puddles fill with water (even less grip, and a rooster tail of spray), and the dust settles.
- **Storm:** heavy rain, dark clouds, lightning flashes, and thunder that rolls in a moment later.
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

The track is a desert motocross course: layered mesas, Joshua trees, course tape, distance boards, dust from the rear tyre, and a shadow under the bike.

Speed is sold with near-field motion: grass and stones in the foreground stream past faster than the track (they're closer to the camera), gravel and pebbles smear into streaks, the stakes blur, speed lines appear, the ground buzzes through the camera, and the edges darken. Air rush rises with speed. The camera barely zooms out at speed (zooming out makes speed read slower), and the bike drifts back on screen so you see further ahead. Both wheels move on their suspension as you ride: the front slides along the fork, the rear swings with the shock, and you can see them soak up landings and bumps.

## How the physics works

`js/physics.js` is a small arcade model with no DOM, so it can be tested in Node. The feel knobs live together in `TUNE`.

- The chassis has two degrees of freedom: heave (up and down) and pitch about the rear axle. A rear shock and a front fork hold it up, each a spring with a damper. Rebound is damped harder than compression, like a real shock, so a hit is soaked up instead of springing the bike into the air. At the end of their travel the shock and fork stop hard, with a clunk.
- Each wheel follows the ground under it, allowing for the tyre's curve, so bumps, logs and rocks push the wheel up through its suspension. Landing on the front loads the fork and the nose bounces; braking hard with both wheels down dives the fork.
- Drive force at the rear tyre lifts the nose and the brake pulls it down. Gravity pulls the nose down until the centre of mass passes over the rear axle (the balance point), and past that it pulls the bike over. Gravity is felt in the chassis's accelerating frame, so a compression lightens the nose and a drop off a crest makes it heavy.
- Rear grip depends on the load on the rear tyre and on the surface: dry, wet, mud or a puddle. Ask for more than the tyre can give and it spins.
- Air drag acts at the centre of mass, so it cancels out of the pitch balance, as on a real bike, and the throttle keeps its bite at top speed. Sitting up in a wheelie adds drag, and a tuck cuts it. A small arcade push in a wheelie (felt in speed, not in pitch) fades out well below top speed, so a high wheelie isn't a crawl but a wheelie is never the fastest way down the track. Holding a wheelie takes throttle feathering that can't also accelerate the bike, which is why higher wheelies are slower. Lying over the tank in a tuck also moves weight forward to keep the front down.
- The pop: snapping into a lean-back on the gas, with the front down or only just up, kicks the nose up. Loading the fork first (leaning forward) makes it bigger.
- In the air, only the wheels move the bike: gas rotates it nose-up, the brake nose-down.
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
js/atmosphere.js  time of day, rain, lightning and lighting
js/render.js      canvas drawing: sky, track, obstacles, police car, gauge
js/game.js        game loop, input, scoring, HUD, synthesized audio, menus
tests/            node:test suites for the physics and the art data
```

Run the tests with `npm test` (Node 18+). They check that the art's calibration matches the physics (wheelbase and wheel size), that the bike settles on its suspension at rest, that the pop lifts the front quickly and that pinning the throttle loops out but leaves time to react, that the front can come back down and the fork dives under braking, that a hard landing is absorbed, that a careful rider can hold a wheelie for a minute on every bike, that a wheelie is faster than riding on two wheels, that a tyre stack crashes you unless you pop over it, that the police catch a slow rider but not a fast wheelie, that wet ground has less grip, and that the result doesn't depend on frame rate. Higher wanted levels catch a slow rider sooner, and a stinger ends the run unless the front wheel is up.

`tests/parts.test.js` covers the workshop:
- Every slot has a stock option, and a stock build is the stock bike.
- The Sur-Ron battery gates a big controller's power, and a 72 V pack adds top speed.
- The Alpha has traction control, and it gets the Varg off the line quicker in the wet.
- Anti-loop stops a pinned throttle from looping the bike.
- Dropping the E-Clutch lifts the front harder than a lean pop.
- Eco mode holds the cap, launch control beats a raw launch, and regen slows you when you roll off.
- Better suspension loses less speed over a log.
- Every part draws.
