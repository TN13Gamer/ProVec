# LAST STAND

A fast-paced top-down sci-fi survival arena shooter built with **HTML5 Canvas**, **Vanilla JavaScript (ES Modules)**, **CSS3**, and the **Web Audio API** — with zero external libraries or frameworks.

---

## Features

- **5 Escalating Waves + Boss Fight**:
  - `01:30` countdown timer per wave.
  - Cumulative enemy unlocks from Wave 1 through Wave 5, culminating in the **OVERLORD** Boss and its minion squad.
- **5 Alien Enemy Classes + Boss**:
  - **SCOUT** — Fast, aggressive low-HP melee alien.
  - **RAIDER** — Balanced medium-speed flanker.
  - **TANK** — Heavy high-HP armored bruiser.
  - **SPITTER** — Mid-range strafing plasma-bullet shooter.
  - **LAUNCHER** — Guided bio-missile shooter (missiles can be shot down mid-air).
  - **OVERLORD (Boss)** — Massive Wave 5 boss with radial plasma bursts and a dedicated Boss Health Bar.
- **Weapons, Ammo & Reloading**:
  - **Pulse Rifle** (`30` mag / `120` reserve, `1.1s` reload, grazing obstacle ricochet).
  - **Scatter Gun** (`6` mag / `24` reserve, `2.3s` reload, 5-pellet spread).
- **Tactical Abilities**:
  - **Dash (`Shift`)**: High-speed burst with invulnerability frames (`0.5s` cooldown).
  - **Rage Mode (`Q`)**: Charges from combat; grants **`2x` Damage**, **`2x` Reload Speed**, **`1.5x` Movement Speed**, and **`50%` Damage Resistance** for `8s`.
  - **LAST STAND (Passive)**: Automatically activates **`5s` of invisibility** when dropping to critical health (`<= 25%` HP), causing enemies to lose target lock.
  - **Out-of-Combat Regeneration**: Regenerates `12 HP/s` after `5s` without taking damage.
- **Throwables & Destructible Obstacles**:
  - **Grenade** & **Flashbang** (`3s` AoE stun) collectables.
  - **Explosive Barrels** (chain-detonating AoE blasts) and **Supply Boxes** (dropping Ammo, Medkits, Grenades, and Flashbangs) with collision physics, spawned randomly each wave.
- **Procedural Web Audio & Particle Physics**:
  - Synthesized weapon, explosion, hit, damage, reload, dash, Rage, and pickup sound effects via Web Audio API.
  - Swept segment-circle bullet collision (no tunneling), impact knockback, rotating debris shards, and screen shake.

---

## Controls

| Input | Action |
| :--- | :--- |
| `W A S D` | Move |
| `Mouse` | Aim |
| `Left Click` | Shoot |
| `Mouse Scroll` | Switch Weapon (`Pulse Rifle` ↔ `Scatter Gun`) |
| `R` | Reload (also restarts on Game Over / Victory) |
| `2` | Switch Accessory (`Grenade` ↔ `Flashbang`) |
| `Right Click` | Throw Selected Accessory |
| `Shift` | Dash (`0.5s` cooldown) |
| `Q` | Activate Rage Mode (when `100%`) |
| `P` / `Esc` | Pause / Resume |

---

## Project Structure

- `index.html` — External HUD bars, tactical popups, menu modals, and `1280×720` arena canvas.
- `style.css` — Full-bleed rectangular tactical-industrial UI styling.
- `main.js` — `requestAnimationFrame` game loop, state machine, combat & physics orchestration.
- `player.js` — Player movement, weapons, ammo/reload, Dash, Rage Mode, LAST STAND, and regeneration.
- `enemy.js` — Alien sprite-sheet rendering, AI behaviors, separation, and boss attacks.
- `waves.js` — 5-wave progression, timers, and unpredictable flank spawning.
- `collision.js` — Swept segment-circle collision and knockback physics.
- `obstacles.js` — Explosive Barrels & Supply Boxes with rigid-body-style push & bounce physics.
- `pickups.js` — Collectable Ammo, Medkit, Grenade, and Flashbang drops.
- `bullets.js` — Standalone bullet manager utilities.
- `effects.js` — Particle physics, shockwaves, muzzle flashes, and screen shake.
- `sound.js` — Procedural Web Audio API sound synthesizer.
- `input.js` — Keyboard, mouse, scroll wheel, and scaled canvas pointer handler.
- `ui.js` — Arena map background renderer and external DOM HUD/menu controller.
- `assets/` — Arena map (`map.jpg`) and alien/projectile sprites (`assets/sprites/`).

---

## Running Locally

Because the game uses ES Modules (`type="module"`), serve the folder over HTTP:

```bash
npx serve .
```

Then open the local URL shown in your terminal (e.g. `http://localhost:3000` or `http://localhost:4173`).
