# 2D2Wheels

A 2D wheelie game in the browser. Pick one of five real electric dirt bikes, pop the front wheel up and keep it there: over logs, rocks and tyre stacks, through mud and puddles, and away from the police car on your tail. Choose the time of day and the weather, or let the game pick.

There's no build step and nothing to install. The display fonts load from Google Fonts; offline, the page falls back to system fonts. Open `index.html` in a browser, or serve the folder (`npm start` runs `python3 -m http.server 8080`). It works on desktop and on phones (on-screen buttons appear on touch devices).

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | `↑` / `W` / `Space` | GAS |
| Brake (drops the front) | `↓` / `S` | BRAKE |
| Lean back / forward | `←` `A` / `→` `D` | ◀ LEAN / LEAN ▶ |
| Retry / Menu / Sound | `R` / `Esc` / `M` | buttons |

- **The pop:** on the gas, snap into a lean-back and the front comes up. Dip forward first to load the fork for a bigger pop. Then hold the wheelie with the throttle and the brake.
- **The front wheel can come down.** Riding on two wheels is fine, but you're faster on one: in a wheelie the bike slips through the air more easily and can go past its usual top speed. The gauge in the bottom-left shows how far up the front is.
- **Obstacles:** logs and rocks can be ridden over, but they knock speed off and jolt the suspension. Tyre stacks can't: get the front wheel over them or you go over the bars. Cones get knocked flying. Clearing an obstacle with the front up scores a bonus. A marker on the right edge warns you about the next obstacle before it comes on screen.
- **Police:** a cruiser sets off a few seconds after you, and it gets faster the longer you ride. After about a minute it's faster than any bike on two wheels, so you need to wheelie to stay ahead. If it reaches you, you're busted. Letting it get within a few metres and then pulling away scores a close call.
- **Scoring:** 1 point per metre on two wheels, 2 on the back wheel and 4 in the sweet spot just under the balance point (the gauge glows). Plus bonuses for obstacles cleared, cones and close calls.
- **The strip at the top** shows the police behind you, then the obstacles (tyre stacks in red), mud, whoops and puddles ahead.
- A run ends when you loop out, go over the bars, hit a tyre stack or get busted. Your best score and furthest distance for each bike are saved in the browser.

### Time of day and weather

Pick them in the garage. **Sunset** starts in daylight and runs into the night over about a minute; dawn does the opposite, and day and night barely change. The sky, mesas and ground colours follow the sun. When it gets dark the bike's headlight clicks on (it points wherever the bike points, so it lights up the sky in a big wheelie), and the police car's headlights and light bar light the track.

- **Windy:** gusts come and go. The tape bellies, windsocks swing, the scrub sways, and dust and leaves blow across the screen. A headwind slows you and lifts the nose; a tailwind does the opposite. The HUD shows the wind's speed and direction.
- **Rain:** streaks blow sideways with the wind and your speed, and splash on the ground. The track gets wet (less grip), puddles fill with water (even less grip, and a rooster tail of spray), and the dust settles.
- **Storm:** heavy rain, strong wind, dark clouds, lightning flashes, and thunder that rolls in a moment later.
- **Random** picks one of these each run.

## The bikes

I picked these from what the e-moto press and dealers describe as the best sellers and most talked-about models in 2025–26. Sur-Ron, Talaria and E Ride make up most mid-size sales, Segway's X260 is a mainstream alternative, and the Stark Varg is the full-size flagship.

| Bike | Peak power | Weight | Top speed | In-game difficulty |
| --- | --- | --- | --- | --- |
| Segway X260 | 5 kW | 55 kg | 75 km/h | Easy |
| Sur-Ron Light Bee X | 6 kW | 57 kg | 75 km/h | Easy |
| Talaria Sting R MX4 | 8 kW | 66 kg | 85 km/h | Medium |
| E Ride Pro-SS 3.0 | 16 kW | 63 kg | 97 km/h | Hard |
| Stark Varg MX | 60 kW (80 hp) | 118 kg | 142 km/h | Expert |

Specs come from manufacturer and retailer listings, and each bike's sources are in `js/bikes.js` and linked in the game menu. Published figures vary between model years and markets (for example, restricted vs unrestricted top speeds), so treat them as representative. Wheelbases are approximate. This is a fan game and isn't affiliated with any of these brands.

## Art

The bikes are vector drawings traced from side-on product photos, one per model, in the colourway shown in the menu: a red Stark Varg MX, a silver Segway X260, a green Sur-Ron Light Bee X, a blue Talaria Sting R MX4 and a black E Ride Pro-SS. `js/bikeart.js` stores each trace in the photo's own pixel coordinates along with a calibration (both axle centres, the real wheelbase and the tyre radius), and converts it to metres when the page loads. That way wheel size, seat height and peg position all keep their real proportions. The source photo for each bike is listed at the top of that file.

The Sur-Ron goes further. It's vectorised straight from a high-resolution product photo: `tools/vectorize_bike.py` splits the photo into its frame-green, decal-yellow, fork-gold and neutral colours, cuts each into shade bands that follow the real lighting, and traces every band into polygons (`js/traced/surron-lbx.js`). The game draws the wheels, chain and lower fork legs itself so they can move.

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
- The police car accelerates to a target speed set from the bike's top speed. The target climbs over time and goes up further when the car falls far behind.
- It runs at a fixed 240 Hz, so it behaves the same at any frame rate.

The tuning was checked with simulated players that have human limits: 120–280 ms reactions, noisy judgement of the angle, on/off keys. They played every bike over many seeded runs, with the police and in every kind of weather, and the same kind of controller played the real game in a browser through key presses. With the police on, typical runs last somewhere between half a minute and a minute or more, and end in a mix of tyre stacks, loop-outs and busts.

## Project layout

```
index.html        page, HUD and menus
css/style.css
js/bikes.js       bike roster, specs and sources
js/physics.js     bike, suspension, terrain, obstacles, weather and police (no DOM)
js/bikeart.js     traced bike art, wheels, rider and kits (no DOM)
js/traced/        photo-vectorised bike layers (Sur-Ron)
tools/            vectorize_bike.py, the photo vectoriser (needs OpenCV)
js/atmosphere.js  time of day, rain, wind, lightning and lighting
js/render.js      canvas drawing: sky, track, obstacles, police car, gauge
js/game.js        game loop, input, scoring, HUD, synthesized audio, menus
tests/            node:test suites for the physics and the art data
```

Run the tests with `npm test` (Node 18+). They check that the art's calibration matches the physics (wheelbase and wheel size), that the bike settles on its suspension at rest, that the pop lifts the front quickly and that pinning the throttle loops out but leaves time to react, that the front can come back down and the fork dives under braking, that a hard landing is absorbed, that a careful rider can hold a wheelie for a minute on every bike, that a wheelie is faster than riding on two wheels, that a tyre stack crashes you unless you pop over it, that the police catch a slow rider but not a fast wheelie, that wet ground has less grip and wind pushes the right way, and that the result doesn't depend on frame rate.
