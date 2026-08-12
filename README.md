# THEOS-2 MAE SAI COMMAND

**Multi-Sensor Geospatial Serious Game & Integrated Disaster Decision Support System**
ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย

Interactive command-centre prototype for *The GEO Quest 2026* (GISTDA). The learner plays the
Mae Sai District Flood Incident Command Post across three acts, deciding under evidence that is
never complete.

---

## Run

> ⚠️ **Do not double-click the `index.html` in the project root.** That is the Vite development
> entry — it only points at `src/main.jsx` and cannot render on its own, so you get a white screen.
> (It now shows an instruction card instead of a blank page if you try.)
> อย่าดับเบิลคลิก `index.html` ที่อยู่ในโฟลเดอร์หลัก — เป็นไฟล์สำหรับตอนพัฒนา จะขึ้นจอขาว

**Option 1 — development server**

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

**Option 2 — standalone build (for exhibition, classroom, or judging)**

```bash
npm run build
```

This produces **one single file**: `dist/index.html` (~744 KB). HTML, CSS, JavaScript, fonts and
every graphic are inlined — there are zero external requests. Double-click it and it runs from
`file://` with no server, no install, no login and no internet, which is exactly what the proposal
requires for booth and classroom use. You can email it or put it on a USB stick as-is.

**Keyboard:** `1` / `2` / `3` jump between acts · `Space` runs or pauses the mission clock.

**Tested viewports:** 1280×720, 1366×768, 1600×1000 and 1920×1080 — no horizontal overflow, no
collapsed panels. Below ~1280 wide the layout is not designed to reflow; it is a desktop /
touchscreen kiosk interface.

---

## Demo / recording script

Every step below is verified working end to end. `NEXT ACT ▶` in the top bar carries the run
forward, so the whole demo can be driven without touching the act switcher.

**ACT I — T−48 h**
1. Press `I` (or key `1`).
2. Left panel: `THEOS-2 Optical` and `Sphere Elevation` are ticked on open. Untick/re-tick freely —
   a layer is charged once per round, so re-ticking is free.
3. Click any pulsing red marker on the river. The `Missing Flood Wall` card pops up anchored to it,
   with that marker's ID and gap length. Click again (or ✕) to close.
4. Right panel `OVERVIEW`: `SANDBAGS (BIG BAG)` → −800 AP, `GROUND PATROL` → −250 AP.
5. Press `NEXT ACT ▶`.

**ACT II — T+0 h**
1. Screen flips to SAR radar; optical layers show `CLOUD COVER 100%` struck through.
2. `SAR Flood Extent` is already on — untick/re-tick to show the sensor handover.
3. Click the flashing red ✕ on the road. It expands the route card: debris run-out, detection time,
   which community is cut off, exits remaining. `COMPUTE DETOUR` calls the Sphere Routing API.
4. Right panel `OVERVIEW` → `TACTICAL ACTIONS` → `EVACUATION ALERT` (800 AP).
   Trust drops **42% → 12%** — the late-warning branch, −30 once, per the proposal.
   Hover the `TRUST INDEX` gauge for the breakdown of why it moved.
5. Press `NEXT ACT ▶`.

**ACT III — AAR**
1. After Action Review loads.
2. Drag the centre handle across the before/after image. `CHANGE DETECTION` overlays the change
   polygons.
3. Right panel `RELIEF BUDGET · งบเยียวยา` shows ฿9,000 flat + ฿10,000 mud top-up + ฿1,500 survey,
   with live totals. `Open Roof-by-Roof Adjudication` jumps to the `DECISIONS` tab where the rates
   are actually applied.

`Reset mission` (↺, top right) returns everything to a clean T−48 state for another take.

## Where everything lives

The entire application is one self-contained file: **`src/App.jsx`**. No images, no fonts, no
external requests — the terrain, SAR backscatter, drainage network and building footprints are all
generated procedurally from a seeded PRNG so they are identical on every run.

| Section | Contents |
| --- | --- |
| 1 · Mission constants | Every threshold from the proposal, in one editable block |
| 2 · Utilities | Seeded PRNG, Catmull-Rom smoothing, clock formatting |
| 3 · Procedural terrain | SVG filter defs, optical / mud / SAR scenes |
| 4 · UI atoms | Panel, provenance chip, arc gauge, sparkline, meter |
| 5 · Game engine | `useEngine()` — the state machine |
| 6–11 | Map canvas, layer catalogue, top bar, Act 1 & 2 shell |
| 12 | Act 3 After Action Review |
| 13 | Root |

Accuracy note from the proposal is honoured: station critical levels and relief rates are **not**
hard-coded through the logic — they sit in the constants block at the top of the file and can be
revised without touching behaviour.

---

## The three acts

| Act | Window | Question the learner must answer |
| --- | --- | --- |
| **I** — Seeing the Unseen Upstream<br>มองต้นน้ำที่มองไม่เห็น | T−48 → T−0 h | Where do I point a limited number of THEOS-2 swaths inside a catchment I have no jurisdiction over — and do I warn? |
| **II** — The Day Clouds Covered the Basin<br>วันที่เมฆบังทั้งลุ่มน้ำ | T+0 → T+36 h | Optical is blind. Which of the four watch communities gets the resources first? |
| **III** — Water Recedes, Mud Remains<br>เมื่อน้ำลดแต่โคลนยังอยู่ | T+36 h → | Which roofs are paid, which are refused, and who pays for the roofs the evidence cannot resolve? |

The **Act Switcher** in the top navigation moves between them at any time. An act entered for the
first time via the switcher is seeded with presentation-fidelity values (Act II opens at 1,250 AP /
42% trust / 100% cloud); an act reached by actually playing carries the learner's real state forward.

---

## Decision rule as implemented

```
SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P
```

| | Definition | Provenance |
| --- | --- | --- |
| **W** | Ban Tham Pha Chom level ÷ 4.20 m critical | วัดจริง — measured |
| **R** | Ban Jotada (Myanmar) accumulated rainfall, normalised | วัดจริง — measured |
| **L** | New landslide scars found in the catchment | วัดจากภาพ — image-derived |
| **N** | 1 − (current channel width ÷ 150 m) | วัดจากภาพ — image-derived |
| **P** | Households inside each community's flood reach | ค่าสถานการณ์ — scenario |

**Veto 1** — level ≥ 4.20 m ⇒ evacuate immediately, waiting for the next image pass stops being a
legal option. Fires once, banners the whole HUD.

**Veto 2** — cloud cover, or optical evidence older than 48 h ⇒ L's weight is cut to 0.08 and the
confidence readout is flagged. Visible live in the SFVI panel.

**Tie-break** — equal scores go to the community with fewer remaining exit routes. Sai Lom Joy and
Koh Sai are deliberately tuned to tie at identical P, so the rule has to do real work; Sai Lom Joy
wins on its single exit road.

**Trust model** — false alarms compound **−5 / −15 / −40**; a late warning costs **−30** once, but
with real casualties. There is no strategy that always wins, which is the point.

**Always available** — “ยังไม่สั่งการ รอภาพรอบหน้า”. The clock advances three hours and the cost of
waiting for better evidence goes on the record.

---

## Data provenance

Every number carries one of four tags, per the proposal's rule that nothing on screen may look
equally real:

| Tag | Thai | Meaning |
| --- | --- | --- |
| `MEASURED` | วัดจริง | Ground gauging station, Dept. of Water Resources |
| `IMAGE` | วัดจากภาพ | Analysed from THEOS-2 Level 3 Ortho |
| `RADAR` | เรดาร์ | RADARSAT-2 via GISTDA เช็คน้ำ / Disaster Platform |
| `SCENARIO` | ค่าสถานการณ์ | Simulated by the team — not measured |

---

## Export

`EXPORT REPORT` in Act III writes a UTF-8 BOM CSV containing final state, the SFVI factor
breakdown, the full roof-by-roof adjudication with outcomes, and the decision log — the teacher-mode
class record described in the proposal.

---

## Deliberate deviations from the mock-ups

The mock-ups show a **6.35 m** river level. The proposal fixes the Ban Tham Pha Chom critical level
at **4.20 m**, and that number drives W, Veto 1, and the warning band. Since the document is the
source of truth for game logic, the gauge runs on the 4.20 m scale and opens at 3.62 m. Everything
else — layout, palette, panel copy, alert strings, AAR figures — follows the mock-ups.
