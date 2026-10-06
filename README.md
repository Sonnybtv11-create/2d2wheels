# 2D2Wheels

A 2D wheelie game in the browser. Pick one of five real electric dirt bikes, get the front wheel up, and ride as far as you can on the back wheel without looping out or setting the front down.

There's no build step and nothing to install. The display fonts load from Google Fonts; offline, the page falls back to system fonts. Open `index.html` in a browser, or serve the folder (`npm start` runs `python3 -m http.server 8080`). It works on desktop and on phones (on-screen buttons appear on touch devices).

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | `↑` / `W` / `Space` | GAS |
| Rear brake (drops the front) | `↓` / `S` | BRAKE |
| Lean back / forward | `←` `A` / `→` `D` | ◀ LEAN / LEAN ▶ |
| Retry / Menu / Sound | `R` / `Esc` / `M` | buttons |

- Hold the throttle and lean back to lift the front. The gauge in the bottom-left shows how far up the front is.
- **Green** is the zone where the wheelie is easy to hold. **Yellow** is the balance point. **Red** is past it, where the bike keeps going over unless you brake.
- Your score is the distance you cover on the back wheel. The run ends when the front wheel comes back down (once it's been up for more than 0.75 s) or when you loop out.
- Your best distance for each bike is saved in the browser.
- As you get closer to top speed the motor has less pull left, so long wheelies need you to ride the balance point and use the rear brake to correct. That's how it works on a real bike too.

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

The rider is drawn in motocross gear (helmet with peak and goggles, neck brace, jersey, knee braces, boots). Knees and elbows are placed with two-bone IK, so the same rider fits every bike's seat, pegs and bars, and leaning moves the hips and torso. Each bike has a matching rider kit.

The track is a desert motocross course at dusk: layered mesas, Joshua trees, course tape, distance boards, dust from the rear tyre, and a shadow under the bike.

## How the physics works

`js/physics.js` is a small arcade model with no DOM, so it can be tested in Node:

- The bike pitches about the rear contact patch. The bike's acceleration pushes the rider and bike's centre of mass back (nose up). Braking does the opposite. Gravity pulls the nose down until the centre of mass is over the rear axle, which is the balance point. Past that point gravity pulls the bike over.
- Each bike's handling comes from its specs. Launch acceleration scales with power-to-weight (log-compressed so the Varg is hard but still rideable), drive force fades towards the real top speed, and lighter bikes respond more to the rider leaning.
- The terrain is seeded rolling hills plus small bumps. A bump under the rear wheel knocks the nose down, and a bump under the front wheel gives a small pop.
- It runs at a fixed 240 Hz, so it behaves the same at any frame rate.

## Project layout

```
index.html        page, HUD and menus
css/style.css
js/bikes.js       bike roster, specs and sources
js/physics.js     wheelie simulation and terrain (no DOM)
js/bikeart.js     traced bike art, wheels, rider and kits (no DOM)
js/render.js      canvas drawing: sky, track, dust, gauge
js/game.js        game loop, input, audio, menus, saved bests
tests/            node:test suites for the physics and the art data
```

Run the tests with `npm test` (Node 18+). They check that the art's calibration matches the physics (wheelbase and wheel size), that every bike can lift, that pinning the throttle loops out but leaves time to react, that more power makes the bike harder to hold, that a keyboard-style bot can hold a 150 m+ wheelie on every bike, and that the result doesn't depend on frame rate.
