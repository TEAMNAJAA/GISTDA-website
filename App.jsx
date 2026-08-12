/* ══════════════════════════════════════════════════════════════════════════════
   THEOS-2 MAE SAI COMMAND
   Multi-Sensor Geospatial Serious Game & Integrated Disaster Decision Support
   ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย

   Single-file React application. All game logic, terminology and state
   transitions are derived from the project proposal (The GEO Quest 2026):
     · 3 Acts   — T−48→T−0 · T+0→T+36 · T+36→ (AAR / relief adjudication)
     · SFVI     — 0.30W + 0.25R + 0.20L + 0.15N + 0.10P
     · Veto 1   — Ban Tham Pha Chom ≥ 4.20 m → evacuate, do not wait for imagery
     · Veto 2   — cloud cover → L older than 48 h may not carry full weight
     · Tie-break— fewer remaining exit routes wins
     · Trust    — false alarms compound −5 / −15 / −40 ; late warning −30
     · Every on-screen value is tagged with one of 4 provenance labels
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Shield, Satellite, Radar, Layers, MapPin, Crosshair, AlertTriangle, Waves,
  CloudRain, Wind, Thermometer, Droplets, Users, Truck, Package, Ship,
  Stethoscope, Plane, Siren, Megaphone, Settings, LogOut, ChevronRight,
  ChevronDown, X, Plus, Minus, MousePointer2, Maximize2, Navigation, Clock,
  Activity, TrendingUp, TrendingDown, Check, CheckCircle2, XCircle, FileText,
  Download, Lock, Fuel, Boxes, Building2, Route, ScrollText, Info, Zap,
  Target, BarChart3, ArrowRight, RotateCcw, Mountain, Search, Radio,
  Timer, ClipboardList, Hammer, Signal, Database, Split, ScanLine, Filter,
  ArrowUp, Bell, Tent, Wrench, Compass, Eye, EyeOff, Play, Gauge as GaugeIcon,
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  ReferenceArea, LabelList,
} from 'recharts'

/* ══════════════════════════════════════════════════════════════════════════
   1 · MISSION CONSTANTS — single source of truth = proposal document
   ══════════════════════════════════════════════════════════════════════════ */

const CRITICAL_LEVEL = 4.20        // m · Ban Tham Pha Chom · Dept. of Water Resources
const PREP_LEVEL     = 4.00        // m · preparedness band 4.00–4.20
const ORIG_WIDTH     = 150         // m · original Sai River channel width
const FLAT_GRANT     = 9000        // ฿/household  · Cabinet resolution 17 Sep 2024
const MUD_GRANT      = 10000       // ฿/roof       · mud-clearing top-up
const SURVEY_COST    = 1500        // ฿ · ground survey team dispatch
const INUNDATION_MIN = 7           // days of standing water → eligible
const SWATH_KM       = 10.3        // km · THEOS-2 imaging swath
const AP_MAX         = 10000
const COINS_MAX      = 14

const SFVI_WEIGHTS = { W: 0.30, R: 0.25, L: 0.20, N: 0.15, P: 0.10 }

/* Four data-provenance labels — ป้ายกำกับที่มาของข้อมูล 4 แบบ */
const SRC = {
  measured: { code: 'MEASURED', th: 'วัดจริง',      hex: '#00FF41', note: 'Ground gauging station · Dept. of Water Resources' },
  image:    { code: 'IMAGE',    th: 'วัดจากภาพ',    hex: '#38BDF8', note: 'Analysed from THEOS-2 Level 3 Ortho imagery' },
  radar:    { code: 'RADAR',    th: 'เรดาร์',       hex: '#A78BFA', note: 'RADARSAT-2 via GISTDA เช็คน้ำ / Disaster Platform' },
  scenario: { code: 'SCENARIO', th: 'ค่าสถานการณ์', hex: '#FFB300', note: 'Simulated value authored by the team — not measured' },
}

/* The four DDPM watch communities — 4 ชุมชนเฝ้าระวัง */
const COMMUNITIES = [
  { id: 'slj', name: 'Sai Lom Joy',  th: 'สายลมจอย ม.1 ต.เวียงพางคำ', households: 412, pop: 1_486, P: 0.86, exits: 1, etaMin: 95,  x: 545, y: 232 },
  { id: 'ksa', name: 'Koh Sai',      th: 'เกาะทราย ม.7 ต.แม่สาย',      households: 638, pop: 2_310, P: 0.86, exits: 2, etaMin: 128, x: 470, y: 372 },
  { id: 'mlk', name: 'Mai Lung Khon', th: 'ไม้ลุงขน',                  households: 521, pop: 1_902, P: 0.68, exits: 3, etaMin: 156, x: 566, y: 470 },
  { id: 'mdg', name: 'Muang Daeng',  th: 'เหมืองแดง',                  households: 389, pop: 1_402, P: 0.55, exits: 2, etaMin: 201, x: 430, y: 560 },
]

/* Upstream catchment sectors inside Myanmar — no ground sensors reachable */
const SECTORS = [
  { id: 'A', label: 'SECTOR A', th: 'ต้นน้ำเหนือสุด',  scars: 3, widthAt: null, x: 118, y: 96,  forestLoss: 14.2 },
  { id: 'B', label: 'SECTOR B', th: 'ไหล่เขาตะวันตก',  scars: 4, widthAt: null, x: 300, y: 74,  forestLoss: 21.7 },
  { id: 'C', label: 'SECTOR C', th: 'พื้นที่เหมืองแร่', scars: 5, widthAt: null, x: 505, y: 108, forestLoss: 38.9 },
  { id: 'D', label: 'SECTOR D', th: 'ลำน้ำคอด',        scars: 2, widthAt: 28,   x: 700, y: 168, forestLoss: 9.4 },
  { id: 'E', label: 'SECTOR E', th: 'ที่ราบก่อนเข้าเมือง', scars: 1, widthAt: 34, x: 872, y: 240, forestLoss: 4.1 },
  { id: 'F', label: 'SECTOR F', th: 'ป่าต้นน้ำฝั่งตะวันออก', scars: 2, widthAt: null, x: 250, y: 262, forestLoss: 11.8 },
]
const TOTAL_SCARS = SECTORS.reduce((s, x) => s + x.scars, 0)   // 17

/* Layer catalogue — every layer is a paid toggle (ชั้นข้อมูลมีราคาเป็นเหรียญ) */
const LAYERS = [
  { id: 'theos',      group: 'BASE LAYERS',    name: 'THEOS-2 Optical',      sub: 'Resolution: 50 cm',            cost: 3, src: 'image',    optical: true },
  { id: 'sar',        group: 'BASE LAYERS',    name: 'SAR Flood Extent',     sub: 'RADARSAT-2 · updated 2 min ago', cost: 2, src: 'radar',  actOnly: 2 },
  { id: 'elev',       group: 'BASE LAYERS',    name: 'Sphere Elevation',     sub: 'Resolution: 12.5 m',           cost: 2, src: 'measured' },
  { id: 'river',      group: 'HYDROLOGY',      name: 'River Network',        sub: 'Surface Water',                cost: 1, src: 'measured' },
  { id: 'watershed',  group: 'HYDROLOGY',      name: 'Watershed Boundary',   sub: 'Cross-border catchment',       cost: 1, src: 'scenario' },
  { id: 'roads',      group: 'INFRASTRUCTURE', name: 'Road Network',         sub: 'OpenStreetMap',                cost: 1, src: 'scenario' },
  { id: 'buildings',  group: 'INFRASTRUCTURE', name: 'Buildings Footprint',  sub: 'Latest Update',                cost: 3, src: 'image',    optical: true },
  { id: 'facilities', group: 'INFRASTRUCTURE', name: 'Critical Facilities',  sub: 'Hospitals, Schools, Etc.',     cost: 2, src: 'scenario' },
  { id: 'landx',      group: 'ANALYSIS',       name: 'LANDX Land Use',       sub: 'Upstream forest → mine/agri',  cost: 2, src: 'image',    optical: true },
  { id: 'pop',        group: 'ANALYSIS',       name: 'Community & Population', sub: '4 watch communities · DDPM', cost: 1, src: 'scenario' },
]

/* Tactical actions — costed in Action Points */
/* In the critical phase an evacuation alert is a siren + SMS broadcast, not a
   full mobilisation, so it is costed lower — otherwise the Act-2 budget of
   1,250 AP would make the single most important order impossible to give. */
const EVAC_AP = { 1: 1500, 2: 700, 3: 700 }

const TACTICAL = [
  { id: 'evac',  name: 'Evacuation Alert', th: 'ประกาศอพยพ',    icon: Megaphone,   ap: 1500, kind: 'decision' },
  { id: 'road',  name: 'Road Closure',     th: 'ปิดเส้นทาง',     icon: Hammer,      ap: 600 },
  { id: 'pump',  name: 'Water Pump',       th: 'เครื่องสูบน้ำ',   icon: Droplets,    ap: 700 },
  { id: 'drone', name: 'Drone Survey',     th: 'บิน UAV ยืนยันจุด', icon: Plane,     ap: 900 },
  { id: 'med',   name: 'Medical Team',     th: 'หน่วยแพทย์',      icon: Stethoscope, ap: 850 },
  { id: 'comm',  name: 'Communication',    th: 'ตั้งสถานีสื่อสาร', icon: Radio,      ap: 400 },
]

const QUICK_DEPLOY = [
  { id: 'bigbag', name: 'Sandbags (Big Bag)', th: 'บิ๊กแบ็ก', unit: 'Units', stock: 4250, batch: 500, ap: 800, icon: Package },
  { id: 'patrol', name: 'Ground Patrol',      th: 'ชุดลาดตระเวน', unit: 'Teams', stock: 24, batch: 2,  ap: 250, icon: Truck },
]

/* Act 2 — critical shortage board (mock-up fidelity) */
const SHORTAGE = [
  { id: 'sandbags', name: 'SANDBAGS',        icon: Package,     have: 0,   max: 5000, pct: 0 },
  { id: 'boats',    name: 'RESCUE BOATS',    icon: Ship,        have: 1,   max: 12,   pct: 8 },
  { id: 'fuel',     name: 'FUEL',            icon: Fuel,        have: 300, max: 2000, pct: 15 },
  { id: 'teams',    name: 'RESCUE TEAMS',    icon: Users,       have: 9,   max: 50,   pct: 18 },
  { id: 'medical',  name: 'MEDICAL SUPPLIES', icon: Stethoscope, have: 110, max: 500,  pct: 22 },
  { id: 'drones',   name: 'DRONES',          icon: Plane,       have: 6,   max: 20,   pct: 30 },
]

/* Resolution proof — ข้อพิสูจน์เชิงตัวเลข (pure-pixel fraction = (w−2p)/w) */
const RES_PROOF = [
  { width: '20 m', s2: 0.0,  ms: 80.0, pan: 95.0 },
  { width: '25 m', s2: 20.0, ms: 84.0, pan: 96.0 },
  { width: '30 m', s2: 33.3, ms: 86.7, pan: 96.7 },
]

/* Act-2 alert script — strings taken from the mock-up + proposal wording */
const ACT2_ALERTS = [
  { t: '09:05', tag: 'RESOURCE ALERT',  msg: 'Sandbags depleted in Sector 3', lv: 'crit' },
  { t: '09:08', tag: 'EVACUATION ALERT', msg: 'Evacuate Zone B immediately', lv: 'crit' },
  { t: '09:12', tag: 'FLOOD WARNING',   msg: 'Water level rising rapidly in Mae Sai River', lv: 'crit' },
  { t: '09:15', tag: 'ROUTE BLOCKED',   msg: 'Landslide detected on Mountain Route 7', lv: 'crit' },
]

/* ── Act 3 · After Action Review reference data ─────────────────────────── */
const AAR_TIMELINE = [
  { key: 'EARLY WARNING',    ts: '28 APR 08:00', icon: Bell,        hex: '#00FF41' },
  { key: 'RESPONSE START',   ts: '28 APR 10:30', icon: Users,       hex: '#38BDF8' },
  { key: 'EVACUATION ORDER', ts: '28 APR 15:20', icon: Megaphone,   hex: '#A78BFA' },
  { key: 'PEAK FLOOD',       ts: '30 APR 03:40', icon: Waves,       hex: '#FF003C' },
  { key: 'LANDSLIDE ALERT',  ts: '30 APR 06:10', icon: AlertTriangle, hex: '#FF7A1A' },
  { key: 'WATER RECEDING',   ts: '01 MAY 09:00', icon: Droplets,    hex: '#22D3EE' },
  { key: 'RECOVERY START',   ts: '02 MAY 08:30', icon: Wrench,      hex: '#84CC16' },
  { key: 'MISSION COMPLETE', ts: '05 MAY 18:00', icon: CheckCircle2, hex: '#38BDF8' },
]
const DECISION_SPEED = [
  { phase: 'EARLY WARNING',    min: 45, hex: '#00FF41' },
  { phase: 'RESPONSE START',   min: 38, hex: '#38BDF8' },
  { phase: 'EVACUATION ORDER', min: 52, hex: '#A78BFA' },
  { phase: 'PEAK FLOOD',       min: 96, hex: '#FF003C' },
  { phase: 'LANDSLIDE ALERT',  min: 71, hex: '#FF7A1A' },
  { phase: 'WATER RECEDING',   min: 41, hex: '#FFB300' },
  { phase: 'RECOVERY START',   min: 29, hex: '#84CC16' },
  { phase: 'MISSION COMPLETE', min: 18, hex: '#38BDF8' },
]
const COST_SUMMARY = [
  { name: 'Personnel Cost',        value: 12_450_000, hex: '#38BDF8' },
  { name: 'Equipment Cost',        value: 7_830_000,  hex: '#22D3EE' },
  { name: 'Logistics Cost',        value: 6_240_000,  hex: '#A78BFA' },
  { name: 'Infrastructure Repair', value: 8_260_000,  hex: '#FFB300' },
]
const UTILISATION = [
  { name: 'Personnel', pct: 78, have: 234,   max: 300,    unit: '' },
  { name: 'Equipment', pct: 65, have: 124,   max: 190,    unit: '' },
  { name: 'Fuel',      pct: 62, have: 9_420, max: 15_000, unit: ' L' },
  { name: 'Supplies',  pct: 58, have: 2_980, max: 5_200,  unit: '' },
]
const IMPACT_OVERVIEW = [
  { name: 'Flooded Areas',       value: '8.7 km²', icon: Waves,         src: 'radar' },
  { name: 'Landslide Zones',     value: '5',       icon: Mountain,      src: 'image' },
  { name: 'Evacuated Population', value: '12,860', icon: Users,         src: 'scenario' },
  { name: 'Relief Shelters',     value: '14',      icon: Tent,          src: 'scenario' },
  { name: 'Displaced Population', value: '6,230',  icon: Users,         src: 'scenario' },
]
const DAMAGE_STATS = [
  { name: 'Buildings Damaged',    value: '1,247',  icon: Building2, src: 'image' },
  { name: 'Roads Affected',       value: '23.6 km', icon: Route,    src: 'scenario' },
  { name: 'Critical Facilities Down', value: '8',  icon: Zap,       src: 'scenario' },
  { name: 'Bridges Affected',     value: '3',      icon: Split,     src: 'image' },
  { name: 'Deaths',               value: '57',     icon: Users,     src: 'scenario' },
  { name: 'Missing',              value: '19',     icon: Search,    src: 'scenario' },
]
const LESSONS = [
  { n: 1, txt: 'Early warning dissemination reduced impact in upstream communities.',
          th: 'การกระจายคำเตือนล่วงหน้าลดผลกระทบในชุมชนต้นน้ำ', tag: 'WARNING' },
  { n: 2, txt: 'Rapid deployment of ground patrols improved evacuation efficiency.',
          th: 'การส่งชุดลาดตระเวนอย่างรวดเร็วเพิ่มประสิทธิภาพการอพยพ', tag: 'LOGISTICS' },
  { n: 3, txt: 'Resource allocation to remote areas needs further optimization.',
          th: 'การจัดสรรทรัพยากรไปพื้นที่ห่างไกลยังต้องปรับปรุง', tag: 'RESOURCE' },
  { n: 4, txt: 'Optical imagery was unusable for 31 continuous hours — radar must be the default critical-phase sensor, not the fallback.',
          th: 'ภาพเชิงแสงใช้ไม่ได้ต่อเนื่อง 31 ชม. เรดาร์ต้องเป็นเซนเซอร์หลักของระยะวิกฤต', tag: 'SENSOR' },
  { n: 5, txt: 'Channel narrowing (150 m → 28 m) raised stage faster than discharge alone predicted; the warning threshold must be lowered.',
          th: 'ลำน้ำแคบลงทำให้ระดับน้ำขึ้นเร็วกว่าที่ปริมาณน้ำทำนาย ต้องลดเกณฑ์เตือนภัย', tag: 'HYDROLOGY' },
  { n: 6, txt: 'Evidence resolution changed relief fairness: 41% of roofs could not be adjudicated from 10 m imagery.',
          th: 'ความละเอียดของหลักฐานเปลี่ยนความเป็นธรรมของการเยียวยาได้จริง', tag: 'EQUITY' },
]

/* Act 3 · roof-by-roof relief adjudication (บัญชีหลังคาเรือน) */
const ROOFS = [
  { id: 'MS-0142', com: 'Koh Sai',       days: 9, mud: 'clear',  conf: 0.94, truth: { flat: true,  mud: true  } },
  { id: 'MS-0198', com: 'Sai Lom Joy',   days: 11, mud: 'clear', conf: 0.96, truth: { flat: true,  mud: true  } },
  { id: 'MS-0231', com: 'Mai Lung Khon', days: 4, mud: 'none',   conf: 0.89, truth: { flat: false, mud: false } },
  { id: 'MS-0277', com: 'Muang Daeng',   days: 8, mud: 'none',   conf: 0.91, truth: { flat: true,  mud: false } },
  { id: 'MS-0304', com: 'Koh Sai',       days: 7, mud: 'partial', conf: 0.52, truth: { flat: true,  mud: true  } },
  { id: 'MS-0356', com: 'Sai Lom Joy',   days: null, mud: 'partial', conf: 0.31, truth: { flat: true,  mud: false } },
  { id: 'MS-0401', com: 'Mai Lung Khon', days: 6, mud: 'clear',  conf: 0.88, truth: { flat: false, mud: true  } },
  { id: 'MS-0455', com: 'Muang Daeng',   days: null, mud: 'none', conf: 0.28, truth: { flat: false, mud: false } },
  { id: 'MS-0512', com: 'Koh Sai',       days: 12, mud: 'clear', conf: 0.97, truth: { flat: true,  mud: true  } },
  { id: 'MS-0588', com: 'Sai Lom Joy',   days: 3, mud: 'partial', conf: 0.44, truth: { flat: false, mud: true  } },
]

/* ══════════════════════════════════════════════════════════════════════════
   2 · UTILITIES
   ══════════════════════════════════════════════════════════════════════════ */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const baht = (n) => '฿ ' + fmt(n)
const pad2 = (n) => String(Math.abs(Math.trunc(n))).padStart(2, '0')

/** Deterministic PRNG so the generated terrain never re-rolls between renders. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom → cubic bezier, for smooth river / ridge geometry. */
function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/** Interpolate a point + tangent along a polyline at parameter t ∈ [0,1]. */
function pointAt(pts, t) {
  const segs = [], total = pts.reduce((acc, p, i) => {
    if (i === 0) return 0
    const l = Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])
    segs.push(l); return acc + l
  }, 0)
  let target = t * total
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const u = segs[i] === 0 ? 0 : target / segs[i]
      const a = pts[i], b = pts[i + 1]
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }
    }
    target -= segs[i]
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1]
  return { x: b[0], y: b[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }
}

/** Format the mission clock: negative = before peak flood. */
function clockLabel(min) {
  const h = Math.trunc(min / 60), m = Math.abs(min % 60)
  const sign = min < 0 ? '−' : '+'
  return `T${sign}${pad2(h)}:${pad2(m)}`
}

/** Headline clock, mock-up styling: "T−48 Hrs" / "T+0 Hrs" / "T+6:30 Hrs". */
function clockHeadline(min) {
  const h = Math.trunc(Math.abs(min) / 60), m = Math.abs(min % 60)
  const sign = min < 0 ? '−' : '+'
  return `T${sign}${h}${m ? ':' + pad2(m) : ''} Hrs`
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · PROCEDURAL TERRAIN — no external assets, fully offline-capable
   ══════════════════════════════════════════════════════════════════════════ */

const RIVER_PTS = [
  [548, -30], [536, 60], [552, 138], [524, 214], [508, 292],
  [518, 366], [494, 442], [478, 520], [488, 596], [464, 700], [456, 760],
]

function useTerrain(seed = 20240912) {
  return useMemo(() => {
    const rnd = mulberry32(seed)
    const riverPath = smoothPath(RIVER_PTS)

    /* Dendritic drainage network — recursive branching off the main stem. */
    const tribs = []
    const branch = (x, y, ang, len, depth) => {
      if (depth <= 0 || len < 5) return
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len
      tribs.push({ x1: x, y1: y, x2, y2, w: 0.25 + depth * 0.34, o: 0.16 + depth * 0.11 })
      const n = rnd() < 0.74 ? 2 : 1
      for (let i = 0; i < n; i++) {
        branch(x2, y2, ang + (rnd() - 0.5) * 0.9 + (i ? 0.46 : -0.46), len * (0.6 + rnd() * 0.24), depth - 1)
      }
    }
    for (let i = 0; i < 26; i++) {
      const t = 0.02 + (i / 26) * 0.96
      const p = pointAt(RIVER_PTS, t)
      const side = i % 2 ? 1 : -1
      branch(p.x, p.y, p.ang + side * (1.15 + (rnd() - 0.5) * 0.4), 52 + rnd() * 46, 4)
    }

    /* Distance from the river centreline — drives canopy density and the
       valley-floor lightening, so the town reads as a clearing in forest. */
    const samples = []
    for (let i = 0; i <= 90; i++) samples.push(pointAt(RIVER_PTS, i / 90))
    const distToRiver = (x, y) => {
      let m = 1e9
      for (const p of samples) {
        const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)
        if (d < m) m = d
      }
      return Math.sqrt(m)
    }

    /* Canopy stipple — this is what makes the hillsides read as forest rather
       than a flat green fill. Density falls off sharply inside the valley. */
    const canopy = []
    for (let i = 0; i < 4200; i++) {
      const x = rnd() * 1000, y = rnd() * 780 - 10
      const d = distToRiver(x, y)
      if (d < 190 && rnd() > (d / 190) ** 2.2) continue        // clearing over the town
      canopy.push({ x, y, r: 1 + rnd() * 2.5, t: rnd(), d })
    }

    /* Building footprints clustered along the urban corridor. */
    const buildings = []
    for (let i = 0; i < 1150; i++) {
      const t = 0.1 + rnd() * 0.88
      const p = pointAt(RIVER_PTS, t)
      const side = rnd() < 0.5 ? -1 : 1
      const off = 13 + Math.pow(rnd(), 1.3) * 112          // tight ribbon, not confetti
      const jitter = (rnd() - 0.5) * 9
      const x = p.x + Math.cos(p.ang + Math.PI / 2) * off * side + jitter
      const y = p.y + Math.sin(p.ang + Math.PI / 2) * off * side + jitter
      if (x < 250 || x > 780) continue
      buildings.push({
        x, y,
        w: 3.6 + rnd() * 5.4, h: 3 + rnd() * 4.6,
        r: (p.ang * 180) / Math.PI + (rnd() - 0.5) * 18,
        tone: rnd(), near: off < 62,
      })
    }

    /* Ridge lines for hill-shade contouring. */
    const ridges = []
    for (let i = 0; i < 22; i++) {
      const base = i < 11 ? 60 + i * 16 : 1000 - (i - 11) * 16 - 60
      const pts = []
      for (let k = 0; k <= 8; k++) {
        pts.push([base + (rnd() - 0.5) * 54, k * 96 - 20])
      }
      ridges.push({ d: smoothPath(pts), o: 0.05 + rnd() * 0.1 })
    }

    /* Flood-wall gaps — จุดฟันหลอ · 14 points along the embankment. */
    const gaps = []
    for (let i = 0; i < 14; i++) {
      const t = 0.16 + (i / 14) * 0.74 + (rnd() - 0.5) * 0.02
      const p = pointAt(RIVER_PTS, t)
      const side = i % 3 === 0 ? -1 : 1
      gaps.push({
        id: `FW-${String(i + 1).padStart(2, '0')}`,
        x: p.x + Math.cos(p.ang + Math.PI / 2) * 15 * side,
        y: p.y + Math.sin(p.ang + Math.PI / 2) * 15 * side,
        len: 18 + Math.round(rnd() * 46),
      })
    }

    /* Landslide scars in the Myanmar catchment (revealed by tasking). */
    const scars = []
    SECTORS.forEach((s) => {
      for (let i = 0; i < s.scars; i++) {
        const a = rnd() * Math.PI * 2, r = 18 + rnd() * 54
        scars.push({
          sector: s.id,
          x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r,
          w: 20 + Math.round(rnd() * 10),           // 20–30 m scar width
          rot: rnd() * 180,
        })
      }
    })

    return { riverPath, tribs, buildings, ridges, gaps, scars, canopy }
  }, [seed])
}

/* ── Shared SVG filter defs ─────────────────────────────────────────────── */
function TerrainDefs() {
  return (
    <defs>
      <filter id="fx-optical" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.016" numOctaves="6" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" result="c"
          values="0.10 0.22 0.05 0 0.045
                  0.16 0.34 0.07 0 0.075
                  0.07 0.15 0.06 0 0.038
                  0    0    0    0 1" />
        <feDiffuseLighting in="n" surfaceScale="2.2" diffuseConstant="1.05" lightingColor="#8fae7a" result="l">
          <feDistantLight azimuth="308" elevation="52" />
        </feDiffuseLighting>
        <feBlend in="c" in2="l" mode="multiply" />
      </filter>

      <filter id="fx-sar" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.004 0.011" numOctaves="7" seed="19" result="base" />
        <feDiffuseLighting in="base" surfaceScale="3.4" diffuseConstant="1.35" lightingColor="#ffffff" result="lit">
          <feDistantLight azimuth="292" elevation="26" />
        </feDiffuseLighting>
        <feColorMatrix in="lit" type="matrix"
          values="1.35 0 0 0 -0.42
                  1.35 0 0 0 -0.40
                  1.35 0 0 0 -0.36
                  0    0 0 0 1" />
      </filter>

      <filter id="fx-speckle">
        <feTurbulence type="turbulence" baseFrequency="0.85" numOctaves="2" seed="3" result="s" />
        <feColorMatrix in="s" type="saturate" values="0" />
      </filter>

      <filter id="fx-mud" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.007 0.018" numOctaves="6" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" result="c"
          values="0.26 0.20 0.05 0 0.085
                  0.19 0.16 0.05 0 0.062
                  0.10 0.09 0.04 0 0.036
                  0    0    0    0 1" />
        <feDiffuseLighting in="n" surfaceScale="2.4" diffuseConstant="1.0" lightingColor="#b09a72" result="l">
          <feDistantLight azimuth="308" elevation="50" />
        </feDiffuseLighting>
        <feBlend in="c" in2="l" mode="multiply" />
      </filter>

      <linearGradient id="grad-flood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.75" />
      </linearGradient>
      <radialGradient id="grad-glow">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="grad-mudriver" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8A6B3D" />
        <stop offset="55%" stopColor="#A98452" />
        <stop offset="100%" stopColor="#7C5F35" />
      </linearGradient>
      {/* Soft valley clearing — a hard-edged ellipse read as a painted oval. */}
      <radialGradient id="grad-valley-g" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#4a6338" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#40592f" stopOpacity="0.5" />
        <stop offset="78%" stopColor="#22401f" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#0e2013" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="grad-valley-m" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#6a5637" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#5b4a2f" stopOpacity="0.5" />
        <stop offset="78%" stopColor="#3d3220" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#2b2519" stopOpacity="0" />
      </radialGradient>
      {/* Valley walls: darken hard towards both map edges. */}
      <linearGradient id="grad-slopeL" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#000000" stopOpacity="0.5" />
        <stop offset="30%" stopColor="#000000" stopOpacity="0.2" />
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="grad-slopeR" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor="#000000" stopOpacity="0.5" />
        <stop offset="30%" stopColor="#000000" stopOpacity="0.2" />
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
      </linearGradient>
    </defs>
  )
}

/** Optical scene (Act 1 / AAR "before"). Mud variant is used for AAR "after".
 *  Built from explicit geometry — dark forested slopes, a stippled canopy, a
 *  cleared valley floor and dense rooftops — rather than a filter wash, which
 *  flattened into a uniform green. Filters are kept only as a subtle mottle. */
function OpticalScene({ terrain, mud = false, showBuildings = true, damaged = false }) {
  const { riverPath, tribs, buildings, ridges, canopy, scars } = terrain

  const C = mud
    ? { base: '#3a3222', floor: '#6a5637', canopyDark: '#3f3421', canopyLite: '#6d5a3a', trib: '#b0906099', ridge: '#1d1710' }
    : { base: '#1b3a22', floor: '#4a6338', canopyDark: '#15301b', canopyLite: '#3d6d40', trib: '#1a3a2299', ridge: '#08180d' }

  return (
    <g>
      {/* deep base + valley clearing */}
      <rect x="0" y="0" width="1000" height="780" fill={C.base} />
      <ellipse cx="500" cy="380" rx="290" ry="470" fill={mud ? 'url(#grad-valley-m)' : 'url(#grad-valley-g)'} />

      {/* slope shading: valley walls fall away to either side */}
      <rect x="0" y="0" width="1000" height="780" fill="url(#grad-slopeL)" />
      <rect x="0" y="0" width="1000" height="780" fill="url(#grad-slopeR)" />

      {/* ridge lines */}
      {ridges.map((r, i) => (
        <path key={`r${i}`} d={r.d} stroke={C.ridge} strokeWidth="2.4" fill="none" opacity={r.o * 3.2} />
      ))}

      {/* dendritic drainage cut into the slopes */}
      {tribs.map((t, i) => (
        <line key={`t${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={C.trib} strokeWidth={t.w * 1.3} opacity={t.o * 1.8} strokeLinecap="round" />
      ))}

      {/* canopy stipple — the forest texture */}
      {canopy.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r}
          fill={c.t > 0.5 ? C.canopyLite : C.canopyDark}
          opacity={0.5 + c.t * 0.5} />
      ))}

      {/* landslide scars on the after-image */}
      {mud && scars.map((k, i) => (
        <rect key={`s${i}`} x={k.x} y={k.y} width="6" height={26 + k.w} rx="3"
          transform={`rotate(${k.rot} ${k.x} ${k.y})`} fill="#8a4520" opacity="0.85" />
      ))}

      {/* river */}
      <path d={riverPath} stroke="#050c08" strokeWidth={mud ? 76 : 44} fill="none" opacity="0.45" strokeLinecap="round" />
      <path d={riverPath} stroke={mud ? 'url(#grad-mudriver)' : '#2f5f7e'} strokeWidth={mud ? 62 : 24}
        fill="none" strokeLinecap="round" opacity={mud ? 0.99 : 0.92} />
      <path d={riverPath} stroke={mud ? '#c9a874' : '#5d93b4'} strokeWidth={mud ? 26 : 9}
        fill="none" strokeLinecap="round" opacity={mud ? 0.55 : 0.5} />

      {/* rooftops */}
      {showBuildings && buildings.map((b, i) => {
        const gone = damaged && b.near && b.tone > 0.42
        const fill = mud
          ? (gone ? '#5c4c36' : ['#8a7358', '#9a805f', '#7b674c', '#a68a63'][Math.floor(b.tone * 4)])
          : ['#c05a3e', '#d4744c', '#6b7c8b', '#98a3b0', '#b04529', '#8d5a45'][Math.floor(b.tone * 6)]
        return (
          <rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="0.5"
            transform={`rotate(${b.r} ${b.x} ${b.y})`}
            fill={fill} opacity={gone ? 0.45 : mud ? 0.85 : 0.96} />
        )
      })}

      {/* fine mottle so the render does not look vector-clean */}
      <rect x="0" y="0" width="1000" height="780" filter="url(#fx-speckle)" opacity={mud ? 0.13 : 0.16}
        style={{ mixBlendMode: 'overlay' }} />
      <rect x="0" y="0" width="1000" height="780" filter={mud ? 'url(#fx-mud)' : 'url(#fx-optical)'}
        opacity="0.24" style={{ mixBlendMode: 'soft-light' }} />
    </g>
  )
}

/** SAR radar scene (Act 2) — black backscatter with bright drainage filaments. */
function SarScene({ terrain, floodPhase }) {
  const { riverPath, tribs, buildings } = terrain
  return (
    <g>
      <rect x="0" y="0" width="1000" height="760" fill="#04060A" />
      <rect x="0" y="0" width="1000" height="760" filter="url(#fx-sar)" opacity="0.3" />
      {tribs.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#EEF4FC" strokeWidth={t.w * 1.15} opacity={Math.min(1, t.o * 1.5)} strokeLinecap="round" />
      ))}
      {/* Bright specular return from built-up surfaces */}
      {buildings.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w * 0.7} height={b.h * 0.7}
          fill="#9FB4CC" opacity={0.1 + b.tone * 0.16} />
      ))}
      {/* Flood extent — low backscatter reads as smooth water, rendered glowing */}
      <g opacity={0.95}>
        <path d={riverPath} stroke="#0EA5E9" strokeWidth={46 + floodPhase * 46} fill="none"
          strokeLinecap="round" opacity="0.16" style={{ filter: 'blur(9px)' }} />
        <path d={riverPath} stroke="url(#grad-flood)" strokeWidth={16 + floodPhase * 26} fill="none" strokeLinecap="round" />
        {buildings.filter((b) => b.near).map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={3 + b.tone * 7 * (0.5 + floodPhase)}
            fill="#38BDF8" opacity={0.28 + b.tone * 0.42} />
        ))}
      </g>
      <rect x="0" y="0" width="1000" height="760" filter="url(#fx-speckle)" opacity="0.16"
        style={{ mixBlendMode: 'screen' }} />
    </g>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · UI ATOMS
   ══════════════════════════════════════════════════════════════════════════ */

function Panel({ children, className = '', glow = null, ...rest }) {
  return (
    <div className={`panel ${className}`} style={glow ? { boxShadow: `0 0 0 1px ${glow}33, 0 0 26px -8px ${glow}66, inset 0 1px 0 rgba(255,255,255,.05)` } : undefined} {...rest}>
      {children}
    </div>
  )
}

function PanelHead({ title, right, icon: Icon, accent = '#7dd3fc' }) {
  return (
    <div className="panel-hd">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon size={12} style={{ color: accent }} className="shrink-0" />}
        <span className="panel-title truncate">{title}</span>
      </div>
      {right}
    </div>
  )
}

/** Provenance chip — every number on screen must declare where it came from. */
function Src({ t, mini = false }) {
  const s = SRC[t]
  if (!s) return null
  return (
    <span title={`${s.th} — ${s.note}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] border font-mono uppercase leading-none
        ${mini ? 'px-1 py-[2px] text-[7.5px] tracking-[0.08em]' : 'px-1.5 py-[3px] text-[8px] tracking-[0.1em]'}`}
      style={{ color: s.hex, borderColor: `${s.hex}44`, background: `${s.hex}12` }}>
      <span className="h-[3px] w-[3px] rounded-full" style={{ background: s.hex }} />
      {s.code}
    </span>
  )
}

function Btn({ children, onClick, disabled, variant = 'ghost', size = 'md', className = '', icon: Icon, title }) {
  const sizes = { sm: 'px-2 py-1 text-[9px]', md: 'px-3 py-1.5 text-[10px]', lg: 'px-4 py-2.5 text-[11px]' }
  const styles = {
    ghost: 'border-sky-400/25 bg-sky-400/[0.06] text-sky-200/90 hover:border-sky-400/60 hover:bg-sky-400/15 hover:text-sky-100',
    primary: 'border-sky-400/60 bg-sky-500/20 text-sky-100 hover:bg-sky-400/30 shadow-[0_0_18px_-6px_rgba(56,189,248,.85)]',
    danger: 'border-[#FF003C]/55 bg-[#FF003C]/14 text-[#FF6B8A] hover:bg-[#FF003C]/25 hover:text-white shadow-[0_0_18px_-6px_rgba(255,0,60,.9)]',
    go: 'border-[#00FF41]/50 bg-[#00FF41]/12 text-[#7CFFA0] hover:bg-[#00FF41]/22 hover:text-white',
    warn: 'border-[#FFB300]/50 bg-[#FFB300]/12 text-[#FFD066] hover:bg-[#FFB300]/22',
    solid: 'border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10 hover:text-white',
  }
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={`btn ${sizes[size]} ${styles[variant]} ${className}`}>
      <span className="flex items-center justify-center gap-1.5">
        {Icon && <Icon size={size === 'sm' ? 10 : 12} />}
        {children}
      </span>
    </button>
  )
}

/** 270° arc gauge (Trust Index / Mission Success). */
function ArcGauge({ value, size = 150, thickness = 11, color = '#00FF41', track = 'rgba(148,163,184,.18)',
  label, sub, delta, deltaDir = 'up', children }) {
  const R = (size - thickness) / 2 - 2
  const cx = size / 2, cy = size / 2
  const START = 135, SWEEP = 270
  const toXY = (deg) => {
    const r = ((deg - 90) * Math.PI) / 180
    return [cx + R * Math.cos(r), cy + R * Math.sin(r)]
  }
  const arc = (from, to) => {
    const [x1, y1] = toXY(from), [x2, y2] = toXY(to)
    const large = to - from > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`
  }
  const v = clamp(value / 100)
  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size * 0.86} viewBox={`0 0 ${size} ${size * 0.86}`}>
        <path d={arc(START, START + SWEEP)} stroke={track} strokeWidth={thickness} fill="none" strokeLinecap="round" />
        {v > 0.002 && (
          <path d={arc(START, START + SWEEP * v)} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 7px ${color}cc)`, transition: 'all .6s cubic-bezier(.4,0,.2,1)' }} />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" className="num" fontSize={size * 0.24} fontWeight="700" fill="#fff">
          {Math.round(value)}
          <tspan fontSize={size * 0.12} fill={color}>%</tspan>
        </text>
        {label && (
          <text x={cx} y={cy + size * 0.16} textAnchor="middle" fontSize={size * 0.075} fill={color}
            className="font-mono" letterSpacing="1.6">{label}</text>
        )}
      </svg>
      <div className="-mt-1 flex w-full items-center justify-between px-2">
        <span className="hud-label">0%</span>
        {sub && <span className="hud-label text-slate-400">{sub}</span>}
        <span className="hud-label">100%</span>
      </div>
      {delta && (
        <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px]"
          style={{ color: deltaDir === 'up' ? '#00FF41' : '#FF003C' }}>
          {deltaDir === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {delta}
        </div>
      )}
      {children}
    </div>
  )
}

/** Lightweight hand-rolled sparkline (used inside tight HUD panels). */
function Spark({ data, color = '#38BDF8', h = 46, dots = false, fill = true }) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * 100, 100 - ((v - min) / span) * 84 - 8])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: h }} className="w-full">
      {fill && <path d={`${line} L 100 100 L 0 100 Z`} fill={color} opacity="0.12" />}
      <path d={line} stroke={color} strokeWidth="1.6" fill="none" vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      {dots && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

function MeterRow({ name, pct, have, max, unit = '', color }) {
  const c = color || (pct >= 70 ? '#38BDF8' : pct >= 40 ? '#FFB300' : '#FF003C')
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-slate-300">{name}</span>
        <span className="num text-[11px] font-semibold" style={{ color: c }}>{pct}%</span>
      </div>
      <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}77, ${c})`, boxShadow: `0 0 8px ${c}aa` }} />
      </div>
      {have !== undefined && (
        <div className="num mt-0.5 text-right text-[9px] text-slate-500">
          {fmt(have)} / {fmt(max)}{unit}
        </div>
      )}
    </div>
  )
}

function StatLine({ icon: Icon, label, value, src, accent = '#7dd3fc', arrow }) {
  return (
    <div className="flex items-center gap-2.5 py-[7px]">
      {Icon && (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.04]">
          <Icon size={12} style={{ color: accent }} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{label}</span>
      {src && <Src t={src} mini />}
      <span className="num shrink-0 text-[11.5px] font-semibold text-white">{value}</span>
      {arrow && <ArrowUp size={11} className="shrink-0 text-[#FF003C]" />}
    </div>
  )
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="hud-label whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-sky-400/25 to-transparent" />
    </div>
  )
}

/* Corner brackets for that targeting-reticle command-center feel */
function Corners({ color = 'rgba(56,189,248,.5)' }) {
  const c = 'pointer-events-none absolute h-2.5 w-2.5'
  return (
    <>
      <span className={`${c} left-0 top-0 border-l border-t`} style={{ borderColor: color }} />
      <span className={`${c} right-0 top-0 border-r border-t`} style={{ borderColor: color }} />
      <span className={`${c} bottom-0 left-0 border-b border-l`} style={{ borderColor: color }} />
      <span className={`${c} bottom-0 right-0 border-b border-r`} style={{ borderColor: color }} />
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · GAME ENGINE — central state machine for the three Acts
   ══════════════════════════════════════════════════════════════════════════ */

let LOG_SEQ = 0
const mkLog = (lv, tag, msg, th) => ({ id: ++LOG_SEQ, lv, tag, msg, th, stamp: new Date() })

const INITIAL = {
  act: 1,
  clock: -48 * 60,                       // minutes relative to peak flood (T±0)
  ap: AP_MAX,
  coins: COINS_MAX,
  trust: 100,
  trustHist: [100, 100, 100, 100, 100, 100],
  layers: { theos: true, elev: true },
  purchased: ['theos', 'elev'],           // a layer is paid for once, not per toggle
  tasked: [],                            // sector ids imaged by THEOS-2
  swaths: 3,                             // remaining THEOS-2 tasking swaths
  waterLevel: 3.62,                      // m at Ban Tham Pha Chom
  rain24: 178,                           // mm accumulated upstream (Ban Jotada)
  channelWidth: ORIG_WIDTH,              // last confirmed width — stale until imaged
  channelMeasured: false,
  cloudCover: 0,                         // % over the catchment
  lastImageAgeH: 6,
  decisions: [],
  falseAlarms: 0,
  warnedAt: null,
  holdCount: 0,
  deployed: { bigbag: 0, patrol: 0 },
  queue: [],
  priorities: [],                        // Act 2 community ranking
  detourSolved: false,
  adjudged: {},                          // Act 3 roof decisions
  surveyed: [],
  seeded: { 2: false, 3: false },
  resetSeq: 0,                            // bumps on reset so map UI state clears too
  logs: [
    mkLog('info', 'SYSTEM', 'Mae Sai Incident Command Post online — THEOS-2 tasking window open.', 'ศูนย์บัญชาการเหตุการณ์อุทกภัยแม่สายออนไลน์'),
    mkLog('warn', 'COVERAGE', 'No ground gauging station available inside upstream catchment (Myanmar territory).', 'ไม่มีสถานีตรวจวัดภาคพื้นในพื้นที่รับน้ำฝั่งเมียนมา'),
    mkLog('info', 'THEOS-2', `Tasking budget: 3 swaths × ${SWATH_KM} km · Level 3 Ortho via AWAGAD.`, 'งบสั่งถ่ายภาพ 3 แถบ แถบละ 10.3 กม.'),
    mkLog('crit', 'STRUCTURE', 'Missing flood wall detected — 14 embankment gaps require big-bag placement.', 'ตรวจพบจุดฟันหลอของกำแพงกันดิน 14 จุด'),
  ],
}

function useEngine() {
  const [s, setS] = useState(INITIAL)
  const [running, setRunning] = useState(false)
  const [flash, setFlash] = useState(null)   // transient banner

  /* Latest-state ref: lets callbacks read current state without stale closures
     and without triggering side effects inside a setState updater. */
  const sRef = useRef(s)
  useEffect(() => { sRef.current = s }, [s])

  const push = useCallback((lv, tag, msg, th) => {
    setS((p) => ({ ...p, logs: [mkLog(lv, tag, msg, th), ...p.logs].slice(0, 90) }))
  }, [])

  const toast = useCallback((kind, text) => {
    setFlash({ kind, text, id: Date.now() })
    setTimeout(() => setFlash((f) => (f && Date.now() - f.id > 2800 ? null : f)), 3000)
  }, [])

  /* ── Derived: SFVI ────────────────────────────────────────────────────── */
  const sfvi = useMemo(() => {
    const W = clamp(s.waterLevel / CRITICAL_LEVEL)
    const R = clamp(s.rain24 / 250)
    const scarsSeen = s.tasked.reduce((n, id) => n + (SECTORS.find((x) => x.id === id)?.scars || 0), 0)
    const Lraw = clamp(scarsSeen / TOTAL_SCARS)
    // Veto 2 — cloud cover + stale optical evidence caps the weight L may carry.
    const stale = s.cloudCover > 60 || s.lastImageAgeH > 48
    const Lw = stale ? SFVI_WEIGHTS.L * 0.4 : SFVI_WEIGHTS.L
    const N = clamp(1 - s.channelWidth / ORIG_WIDTH)
    const perCommunity = COMMUNITIES.map((c) => {
      const score = SFVI_WEIGHTS.W * W + SFVI_WEIGHTS.R * R + Lw * Lraw + SFVI_WEIGHTS.N * N + SFVI_WEIGHTS.P * c.P
      return { ...c, score }
    })
    const Pavg = COMMUNITIES.reduce((a, c) => a + c.P, 0) / COMMUNITIES.length
    const basin = SFVI_WEIGHTS.W * W + SFVI_WEIGHTS.R * R + Lw * Lraw + SFVI_WEIGHTS.N * N + SFVI_WEIGHTS.P * Pavg
    // Confidence: how much of the evidence base has actually been purchased/imaged
    const confidence = clamp(
      0.34 + 0.3 * (s.tasked.length / 3) + (s.channelMeasured ? 0.2 : 0) + (stale ? 0 : 0.16)
    )
    /* Tie-break rule: equal score → the community with fewer exits ranks higher. */
    const ranked = [...perCommunity].sort((a, b) =>
      Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.exits - b.exits)
    return { W, R, L: Lraw, N, P: Pavg, Lw, stale, basin, perCommunity, ranked, confidence, scarsSeen }
  }, [s.waterLevel, s.rain24, s.tasked, s.channelWidth, s.channelMeasured, s.cloudCover, s.lastImageAgeH])

  const veto1 = s.waterLevel >= CRITICAL_LEVEL
  const veto2 = s.cloudCover > 60 || s.lastImageAgeH > 48

  const situation = s.act === 3 ? 'REVIEW'
    : veto1 || s.act === 2 ? 'CRITICAL'
      : s.waterLevel >= PREP_LEVEL ? 'HIGH' : 'ELEVATED'

  /* ── Trust model ──────────────────────────────────────────────────────── */
  const applyTrust = useCallback((delta, why) => {
    setS((p) => {
      const t = clamp(p.trust + delta, 0, 100)
      return { ...p, trust: t, trustHist: [...p.trustHist.slice(-23), t] }
    })
    push(delta < 0 ? 'crit' : 'good', 'TRUST INDEX',
      `${delta > 0 ? '+' : ''}${delta}% — ${why}`, null)
  }, [push])

  /* ── Clock advance ────────────────────────────────────────────────────── */
  const advance = useCallback((mins) => {
    setS((p) => {
      const nc = p.clock + mins
      const hoursIn = (nc + 48 * 60) / 60
      // Hydrograph: level accelerates as T-0 approaches, channel narrowing amplifies it.
      const narrowing = 1 + (1 - p.channelWidth / ORIG_WIDTH) * 0.55
      const rise = (0.006 + Math.pow(clamp(hoursIn / 48), 2.4) * 0.052) * (mins / 60) * narrowing
      const wl = Math.min(6.4, p.waterLevel + rise * 6)
      const rain = p.rain24 + (mins / 60) * (4 + Math.pow(clamp(hoursIn / 48), 2) * 16)
      const cloud = nc > -6 * 60 ? Math.min(100, p.cloudCover + (mins / 60) * 14) : p.cloudCover
      return {
        ...p, clock: nc, waterLevel: wl, rain24: rain, cloudCover: cloud,
        lastImageAgeH: p.lastImageAgeH + mins / 60,
        queue: p.queue.map((q) => ({ ...q, eta: q.eta - mins })).filter((q) => q.eta > -30),
      }
    })
  }, [])

  /* Auto-run clock */
  useEffect(() => {
    if (!running || s.act === 3) return
    const t = setInterval(() => advance(15), 900)
    return () => clearInterval(t)
  }, [running, s.act, advance])

  /* Veto-1 announcement fires exactly once */
  const vetoAnnounced = useRef(false)
  useEffect(() => {
    if (veto1 && !vetoAnnounced.current) {
      vetoAnnounced.current = true
      push('crit', 'VETO RULE 1',
        `Ban Tham Pha Chom ${s.waterLevel.toFixed(2)} m ≥ ${CRITICAL_LEVEL.toFixed(2)} m — order evacuation now, do NOT wait for the next image pass.`,
        'ถึงระดับวิกฤติ สั่งอพยพทันทีโดยไม่รอภาพยืนยัน')
      toast('crit', 'VETO 1 · EVACUATE WITHOUT WAITING FOR IMAGERY')
    }
  }, [veto1, s.waterLevel, push, toast])

  /* Cloud lock-out announcement */
  const cloudAnnounced = useRef(false)
  useEffect(() => {
    if (s.cloudCover >= 100 && !cloudAnnounced.current) {
      cloudAnnounced.current = true
      push('warn', 'SENSOR', 'CLOUD COVER 100% — optical layers locked. Switching evidence source to RADARSAT-2 via เช็คน้ำ.',
        'เมฆปกคลุม 100% ชั้นภาพเชิงแสงถูกปิดอัตโนมัติ')
    }
  }, [s.cloudCover, push])

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const toggleLayer = useCallback((id) => {
    const L = LAYERS.find((l) => l.id === id)
    const cur = sRef.current
    if (cur.layers[id]) {
      setS((p) => ({ ...p, layers: { ...p.layers, [id]: false } }))
      return
    }
    if (cur.act === 2 && L.optical) return                          // cloud-locked
    // Already bought this round: re-enabling is free, you only pay the first time.
    if (cur.purchased.includes(id)) {
      setS((p) => ({ ...p, layers: { ...p.layers, [id]: true } }))
      push('info', 'LAYER', `${L.name} re-enabled — already licensed this round, no coin charged.`, null)
      return
    }
    if (cur.coins < L.cost) {
      push('warn', 'LAYER', `Insufficient data coins for ${L.name} — ${L.cost} required, ${cur.coins} left.`,
        'เหรียญข้อมูลไม่พอ · ต้องเลือกว่าจะซื้อชั้นใดก่อน')
      return
    }
    setS((p) => ({
      ...p, coins: p.coins - L.cost,
      layers: { ...p.layers, [id]: true },
      purchased: [...p.purchased, id],
    }))
    push('info', 'LAYER', `${L.name} enabled — ${L.cost} data coin${L.cost > 1 ? 's' : ''} spent.`, null)
  }, [push])

  const taskSwath = useCallback((sectorId) => {
    const sec = SECTORS.find((x) => x.id === sectorId)
    setS((p) => {
      if (p.tasked.includes(sectorId) || p.swaths <= 0 || p.ap < 1200 || p.act !== 1) return p
      const next = {
        ...p,
        ap: p.ap - 1200,
        swaths: p.swaths - 1,
        tasked: [...p.tasked, sectorId],
        lastImageAgeH: 0,
        clock: p.clock + 95,
      }
      if (sec.widthAt && (!p.channelMeasured || sec.widthAt < p.channelWidth)) {
        next.channelWidth = sec.widthAt
        next.channelMeasured = true
      }
      return next
    })
    push('good', 'THEOS-2',
      `Swath tasked over ${sec.label} (${SWATH_KM} km, Pan 0.5 m) — ${sec.scars} new landslide scars detected, 20–30 m wide.`,
      `สั่งถ่ายภาพ ${sec.label} พบร่องรอยดินถล่มใหม่ ${sec.scars} จุด`)
    if (sec.widthAt) {
      push('crit', 'CHANNEL',
        `Sai River width measured at ${sec.widthAt} m — down from ${ORIG_WIDTH} m. Lower the warning threshold and warn earlier.`,
        `วัดความกว้างลำน้ำเหลือ ${sec.widthAt} ม. จากเดิม 150 ม.`)
    }
    toast('ok', `THEOS-2 PASS COMPLETE · ${sec.label}`)
  }, [push, toast])

  const deploy = useCallback((id) => {
    const q = QUICK_DEPLOY.find((x) => x.id === id)
    setS((p) => {
      if (p.ap < q.ap) return p
      return {
        ...p,
        ap: p.ap - q.ap,
        clock: p.clock + 30,
        deployed: { ...p.deployed, [id]: p.deployed[id] + q.batch },
        queue: [...p.queue, { id: `${id}-${Date.now()}`, name: q.name, qty: q.batch, unit: q.unit, eta: 45 + Math.round(Math.random() * 60) }],
      }
    })
    push('good', 'DEPLOY', `${q.batch} ${q.unit.toLowerCase()} of ${q.name} dispatched — ${q.ap} AP.`, `ส่ง${q.th} ${q.batch} หน่วย`)
  }, [push])

  const tactical = useCallback((id) => {
    const a = TACTICAL.find((x) => x.id === id)
    if (a.id === 'evac') return issueOrder('EVACUATE')
    setS((p) => (p.ap < a.ap ? p : { ...p, ap: p.ap - a.ap, clock: p.clock + 20 }))
    push('info', 'TACTICAL', `${a.name} executed — ${fmt(a.ap)} AP.`, a.th)
    if (a.id === 'drone') {
      push('warn', 'UAV', 'UAV confirms satellite-cued points only. Thai UAVs may not cross the border — upstream remains satellite-only.',
        'UAV ยืนยันจุดที่ดาวเทียมชี้เป้า แต่บินข้ามพรมแดนไม่ได้')
    }
  }, [push])

  /* Core Act-1 decision: EVACUATE · STANDBY · HOLD */
  const issueOrder = useCallback((kind) => {
    setS((p) => {
      const rec = { kind, clock: p.clock, water: p.waterLevel, sfvi: sfvi.basin, at: Date.now() }
      let ap = p.ap, trust = p.trust, fa = p.falseAlarms, holds = p.holdCount, clock = p.clock

      if (kind === 'EVACUATE') {
        ap -= EVAC_AP[p.act]; clock += 45
        if (p.act === 2 && p.warnedAt === null) {
          // The water is already in the town — this is the late-warning branch.
          trust = clamp(trust - 30, 0, 100)
        } else if (p.act === 2) {
          trust = clamp(trust + 1, 0, 100)              // re-broadcast of a standing order
        } else {
          const justified = p.waterLevel >= PREP_LEVEL || sfvi.basin >= 0.62
          if (justified) {
            trust = clamp(trust + 2.5, 0, 100)
          } else {
            fa += 1
            const penalty = [5, 15, 40][Math.min(fa - 1, 2)]
            trust = clamp(trust - penalty, 0, 100)
          }
        }
      } else if (kind === 'STANDBY') {
        ap -= 700; clock += 30
      } else {                                             // HOLD — รอภาพรอบหน้า
        holds += 1; clock += 180
      }
      return {
        ...p, ap, trust, falseAlarms: fa, holdCount: holds, clock,
        warnedAt: kind === 'EVACUATE' && !p.warnedAt ? p.clock : p.warnedAt,
        decisions: [...p.decisions, rec],
        trustHist: [...p.trustHist.slice(-23), trust],
      }
    })

    // Read live state, not the closure: `tactical` holds a reference to this
    // callback and would otherwise log against a stale act.
    const cur = sRef.current
    if (kind === 'EVACUATE' && cur.act === 2) {
      if (cur.warnedAt === null) {
        push('crit', 'LATE WARNING',
          'Evacuation ordered with the flood already in the streets. −30% trust, and the people hit were hit before the order reached them.',
          'เตือนช้า เสียความเชื่อมั่น −30% และมีผู้ได้รับผลกระทบจริง')
        toast('crit', 'LATE WARNING · TRUST −30%')
      } else {
        push('good', 'ORDER', 'Standing evacuation order re-broadcast to all four watch communities.',
          'ประกาศอพยพซ้ำไปยัง 4 ชุมชนเฝ้าระวัง')
        toast('ok', 'EVACUATION RE-BROADCAST')
      }
    } else if (kind === 'EVACUATE') {
      const justified = cur.waterLevel >= PREP_LEVEL || sfvi.basin >= 0.62
      if (justified) {
        push('good', 'ORDER', 'EVACUATION ORDER issued and justified by the evidence on file. Public trust +2.5%.',
          'ประกาศอพยพ สอดคล้องกับหลักฐาน')
        toast('ok', 'EVACUATION ORDER ISSUED')
      } else {
        const n = cur.falseAlarms + 1
        const penalty = [5, 15, 40][Math.min(n - 1, 2)]
        push('crit', 'FALSE ALARM',
          `Evacuation ordered at ${cur.waterLevel.toFixed(2)} m with SFVI ${sfvi.basin.toFixed(2)} — no event followed. Compounding penalty −${penalty}%.`,
          `เตือนแล้วไม่เกิดเหตุ ครั้งที่ ${n} เสียความเชื่อมั่น −${penalty}%`)
        toast('crit', `FALSE ALARM #${n} · TRUST −${penalty}%`)
      }
    } else if (kind === 'STANDBY') {
      push('warn', 'ORDER', 'Preparedness notice issued · urgent THEOS-2 tasking pass requested.',
        'แจ้งเตรียมพร้อม และสั่งถ่ายภาพรอบเร่งด่วน')
    } else {
      push('warn', 'HOLD', 'Command holds. Clock advances 3 h — the cost of waiting for better evidence is now on the record.',
        'ยังไม่สั่งการ รอภาพรอบหน้า · เวลาเดินต่อ')
      toast('warn', 'HOLDING · CLOCK +3:00')
    }
  }, [sfvi.basin, push, toast])

  /* Act 2 — priority ranking & routing */
  const setPriority = useCallback((cid) => {
    setS((p) => {
      const cur = p.priorities
      if (cur.includes(cid)) return { ...p, priorities: cur.filter((x) => x !== cid) }
      if (cur.length >= 4) return p
      return { ...p, priorities: [...cur, cid] }
    })
  }, [])

  const solveDetour = useCallback(() => {
    setS((p) => (p.ap < 500 ? p : { ...p, ap: p.ap - 500, detourSolved: true, clock: p.clock + 25 }))
    push('good', 'SPHERE ROUTING API',
      'Detour computed around the Mountain Route 7 landslide — Route 1290 → Ban Pa Sang link, +14 min transit.',
      'คำนวณเส้นทางเบี่ยงเมื่อถนนถูกดินโคลนตัดขาด')
  }, [push])

  /* Act 3 — relief adjudication */
  const adjudicate = useCallback((roofId, verdict) => {
    setS((p) => ({ ...p, adjudged: { ...p.adjudged, [roofId]: verdict } }))
  }, [])
  const survey = useCallback((roofId) => {
    setS((p) => (p.surveyed.includes(roofId) ? p : { ...p, surveyed: [...p.surveyed, roofId] }))
    push('info', 'GROUND SURVEY', `${roofId} — field team dispatched. Accurate but slow: +90 min, ฿${fmt(SURVEY_COST)}.`,
      'ส่งสำรวจภาคพื้น แม่นแต่ช้า')
  }, [push])

  /* Act transitions */
  const goAct = useCallback((n) => {
    if (n === 1) vetoAnnounced.current = false      // veto may legitimately re-fire
    if (n !== 2) cloudAnnounced.current = false
    setS((p) => {
      if (p.act === n) return p
      let next = { ...p, act: n }
      if (n === 2 && !p.seeded[2]) {
        next = {
          ...next,
          seeded: { ...p.seeded, 2: true },
          clock: 0,
          ap: Math.min(p.ap, 1250),
          trust: Math.min(p.trust, 42),
          trustHist: [...p.trustHist.slice(-18), 68, 61, 55, 49, 45, 42],
          cloudCover: 100,
          waterLevel: Math.max(p.waterLevel, 4.68),
          layers: { ...p.layers, theos: false, buildings: false, landx: false, sar: true, roads: true },
        }
      }
      if (n === 3 && !p.seeded[3]) {
        next = { ...next, seeded: { ...p.seeded, 3: true }, trust: 72 }
      }
      if (n === 3) next = { ...next, cloudCover: 12 }
      if (n === 1) {
        // Skies are clear again in the pre-event phase, so the optical layers the
        // player had bought must come back — Act 2 only locked them, never refunded.
        next = {
          ...next,
          cloudCover: Math.min(p.cloudCover, 34),
          layers: { ...p.layers, theos: true, sar: false },
        }
      }
      // Keep the mission clock inside the act's own window, otherwise jumping
      // back from the AAR leaves Act 1 reading T+37 Hrs with Veto 1 latched.
      const WINDOW = { 1: [-48 * 60, -1], 2: [0, 36 * 60 - 1], 3: [36 * 60, 96 * 60] }
      const [lo, hi] = WINDOW[n]
      if (next.clock < lo || next.clock > hi) next = { ...next, clock: lo }
      if (n === 1 && next.waterLevel >= CRITICAL_LEVEL) next = { ...next, waterLevel: 3.62, rain24: 178 }
      return next
    })
    setRunning(false)
  }, [])

  const reset = useCallback(() => {
    vetoAnnounced.current = false
    cloudAnnounced.current = false
    LOG_SEQ = 0
    setS((p) => ({
      ...INITIAL,
      resetSeq: p.resetSeq + 1,
      logs: INITIAL.logs.map((l) => ({ ...l, id: ++LOG_SEQ })),
    }))
    setRunning(false)
  }, [])

  return {
    s, setS, sfvi, veto1, veto2, situation, running, setRunning, flash,
    push, toast, advance, toggleLayer, taskSwath, deploy, tactical, issueOrder,
    setPriority, solveDetour, adjudicate, survey, goAct, reset, applyTrust,
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   6 · MAP CANVAS — Act-driven: Optical (1) · SAR radar (2) · Change slider (3)
   ══════════════════════════════════════════════════════════════════════════ */

function MapCanvas({ eng, view, setView }) {
  const { s, sfvi, veto1 } = eng
  const terrain = useTerrain()
  const [hoverSector, setHoverSector] = useState(null)
  const [gapCard, setGapCard] = useState(null)      // clicked flood-wall marker
  const [routeDetail, setRouteDetail] = useState(false)
  const [tool, setTool] = useState('select')
  const [zoom, setZoom] = useState(1)

  const act = s.act
  const floodPhase = clamp((s.waterLevel - 3.4) / 3, 0, 1)
  const L = s.layers

  const isCatchment = view === 'catchment'

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-sky-400/15 bg-[#04070E]">
      {/* ── Scene ─────────────────────────────────────────────────────── */}
      <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform .35s ease' }}>
        <TerrainDefs />

        {act === 2
          ? <SarScene terrain={terrain} floodPhase={floodPhase} />
          : <OpticalScene terrain={terrain} showBuildings={act !== 2 && (L.buildings || L.theos)} />}

        {/* Elevation contour hint */}
        {L.elev && terrain.ridges.map((r, i) => (
          <path key={`e${i}`} d={r.d} stroke={act === 2 ? '#7FB2E5' : '#9ae6b4'} strokeWidth="0.7" fill="none" opacity="0.16" />
        ))}

        {/* Hydrology */}
        {L.river && act !== 2 && (
          <path d={terrain.riverPath} stroke="#38BDF8" strokeWidth="2" fill="none" opacity="0.55"
            strokeDasharray="10 6" className="animate-[dashflow_9s_linear_infinite]" />
        )}
        {L.watershed && (
          <path d="M 40 30 L 250 12 L 470 40 L 700 18 L 940 66 L 930 300 L 760 340 L 620 300 L 470 330 L 300 296 L 120 320 Z"
            fill="none" stroke="#A78BFA" strokeWidth="1.6" strokeDasharray="12 8" opacity="0.55" />
        )}

        {/* Road network */}
        {L.roads && (
          <g opacity={act === 2 ? 0.85 : 0.6}>
            <path d="M 250 760 C 340 560, 400 420, 452 250 S 520 60, 560 -10"
              stroke={act === 2 ? '#C9D6E8' : '#e8e2d4'} strokeWidth="2.6" fill="none" opacity="0.7" />
            <path d="M 812 40 C 790 180, 742 300, 700 400 S 640 620, 612 760"
              stroke={eng.s.detourSolved ? '#00FF41' : '#6EE7B7'} strokeWidth="2.6" fill="none"
              strokeDasharray={eng.s.detourSolved ? '0' : '14 7'}
              style={{ filter: `drop-shadow(0 0 5px ${eng.s.detourSolved ? '#00FF41' : '#6EE7B7'})` }} />
            <path d="M 180 470 L 880 452" stroke="#9FB4CC" strokeWidth="1.7" fill="none" opacity="0.45" strokeDasharray="6 5" />
          </g>
        )}

        {/* Community & population layer */}
        {L.pop && COMMUNITIES.map((c) => {
          const rank = s.priorities.indexOf(c.id)
          const hue = rank === 0 ? '#FF003C' : rank === 1 ? '#FF7A1A' : rank === 2 ? '#FFB300' : rank === 3 ? '#38BDF8' : '#A78BFA'
          return (
            <g key={c.id} className="cursor-pointer" onClick={() => act === 2 && eng.setPriority(c.id)}>
              <circle cx={c.x} cy={c.y} r="26" fill={hue} opacity="0.1" />
              <circle cx={c.x} cy={c.y} r="8" fill="none" stroke={hue} strokeWidth="1.6" opacity="0.9" />
              <circle cx={c.x} cy={c.y} r="3" fill={hue} />
              {rank >= 0 && (
                <text x={c.x} y={c.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill={hue}
                  className="font-mono">#{rank + 1}</text>
              )}
              <text x={c.x + 13} y={c.y + 4} fontSize="10.5" fill="#DCEBFF" className="font-mono" letterSpacing="0.6"
                style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3, strokeLinejoin: 'round' }}>
                {c.name.toUpperCase()}
              </text>
              {c.exits === 1 && (
                <text x={c.x + 13} y={c.y + 16} fontSize="8" fill="#FF003C" className="font-mono">1 EXIT ROUTE</text>
              )}
            </g>
          )
        })}

        {/* Critical facilities */}
        {L.facilities && (
          <g>
            {[[402, 300, 'HOSPITAL'], [600, 396, 'SCHOOL'], [500, 520, 'DDPM POST'], [640, 232, 'PUMP STN']].map(([x, y, t], i) => (
              <g key={i}>
                <rect x={x - 5} y={y - 5} width="10" height="10" fill="none" stroke="#22D3EE" strokeWidth="1.4" />
                <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke="#22D3EE" strokeWidth="0.8" opacity="0.6" />
                <text x={x + 9} y={y + 3} fontSize="7.5" fill="#7dd3fc" className="font-mono">{t}</text>
              </g>
            ))}
          </g>
        )}

        {/* ── ACT 1: urban corridor — missing flood-wall gaps (จุดฟันหลอ) ─ */}
        {act === 1 && !isCatchment && terrain.gaps.map((g, i) => {
          const on = gapCard?.id === g.id
          return (
            <g key={g.id} className="cursor-pointer" onClick={() => setGapCard(on ? null : g)}>
              <circle cx={g.x} cy={g.y} r="9" fill="none" stroke="#FF003C" strokeWidth="1.1" opacity="0.5"
                className="animate-[pulsering_2.6s_ease-out_infinite]" style={{ animationDelay: `${i * 0.16}s`, transformOrigin: `${g.x}px ${g.y}px` }} />
              {/* generous invisible hit target so it is easy to click on camera */}
              <circle cx={g.x} cy={g.y} r="15" fill="transparent" />
              <circle cx={g.x} cy={g.y} r={on ? 6.4 : 4.6} fill="#FF003C" opacity="0.95"
                style={{ filter: `drop-shadow(0 0 ${on ? 12 : 6}px #FF003C)` }} />
              <circle cx={g.x} cy={g.y} r="1.8" fill="#fff" />
              {on && <circle cx={g.x} cy={g.y} r="12" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9" />}
            </g>
          )
        })}

        {/* ── ACT 1 alt view: Myanmar catchment tasking grid ────────────── */}
        {act === 1 && isCatchment && (
          <g>
            <rect x="0" y="0" width="1000" height="360" fill="#000" opacity="0.34" />
            <line x1="0" y1="352" x2="1000" y2="330" stroke="#FFB300" strokeWidth="2" strokeDasharray="16 8" opacity="0.85" />
            <text x="26" y="322" fontSize="12" fill="#FFB300" className="font-mono" letterSpacing="2">MYANMAR — UPSTREAM CATCHMENT · NO GROUND SENSORS</text>
            <text x="26" y="376" fontSize="12" fill="#7dd3fc" className="font-mono" letterSpacing="2">THAILAND</text>
            {SECTORS.map((sec) => {
              const done = s.tasked.includes(sec.id)
              const hot = hoverSector === sec.id
              return (
                <g key={sec.id} className="cursor-pointer"
                  onMouseEnter={() => setHoverSector(sec.id)} onMouseLeave={() => setHoverSector(null)}
                  onClick={() => eng.taskSwath(sec.id)}>
                  <rect x={sec.x - 78} y={sec.y - 52} width="156" height="104" rx="3"
                    fill={done ? '#00FF41' : hot ? '#38BDF8' : '#38BDF8'} fillOpacity={done ? 0.09 : hot ? 0.13 : 0.05}
                    stroke={done ? '#00FF41' : hot ? '#7dd3fc' : '#38BDF8'} strokeWidth={hot ? 1.8 : 1.1}
                    strokeDasharray={done ? '0' : '8 5'} />
                  <text x={sec.x - 70} y={sec.y - 36} fontSize="10.5" className="font-mono" letterSpacing="1.4"
                    fill={done ? '#00FF41' : '#9FCBEF'}>{sec.label}</text>
                  <text x={sec.x - 70} y={sec.y - 24} fontSize="8" className="font-mono" fill="#7dd3fc" opacity="0.6">
                    SWATH {SWATH_KM} KM
                  </text>
                  {done ? (
                    <>
                      <text x={sec.x - 70} y={sec.y + 40} fontSize="9.5" className="font-mono" fill="#FF003C">
                        {sec.scars} NEW SCARS · 20–30 m
                      </text>
                      {terrain.scars.filter((k) => k.sector === sec.id).map((k, i) => (
                        <rect key={i} x={k.x} y={k.y} width="3.4" height={10 + k.w * 0.5} rx="1.4"
                          transform={`rotate(${k.rot} ${k.x} ${k.y})`} fill="#B4451F" opacity="0.95"
                          style={{ filter: 'drop-shadow(0 0 4px #FF5A2B)' }} />
                      ))}
                    </>
                  ) : (
                    <text x={sec.x - 70} y={sec.y + 40} fontSize="9" className="font-mono" fill="#64748b">
                      NOT IMAGED · 1,200 AP
                    </text>
                  )}
                  {done && (
                    <g transform={`translate(${sec.x + 58} ${sec.y - 42})`}>
                      <circle r="8" fill="#00FF41" fillOpacity="0.16" stroke="#00FF41" strokeWidth="1" />
                      <path d="M -3.4 0 L -1 2.6 L 3.6 -2.6" stroke="#00FF41" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    </g>
                  )}
                </g>
              )
            })}
          </g>
        )}

        {/* ── ACT 2: blocked route ──────────────────────────────────────── */}
        {act === 2 && (
          <g className="cursor-pointer" onClick={() => setRouteDetail((v) => !v)}>
            <rect x="586" y="116" width="88" height="88" fill="transparent" />
            <g className="animate-[softflash_1.1s_ease-in-out_infinite]">
              <line x1="600" y1="130" x2="660" y2="190" stroke="#FF003C" strokeWidth="7" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 10px #FF003C)' }} />
              <line x1="660" y1="130" x2="600" y2="190" stroke="#FF003C" strokeWidth="7" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 10px #FF003C)' }} />
            </g>
            {routeDetail && (
              <circle cx="630" cy="160" r="46" fill="none" stroke="#fff" strokeWidth="1.3" opacity="0.85"
                strokeDasharray="7 5" />
            )}
            <line x1="662" y1="176" x2="712" y2="212" stroke="#FF003C" strokeWidth="1.2" opacity="0.8" />
            {/* landslide debris polygon */}
            <path d="M 596 118 L 672 122 L 688 196 L 604 200 Z" fill="#FF003C" opacity="0.08" stroke="#FF003C"
              strokeWidth="0.9" strokeDasharray="5 4" />
          </g>
        )}

        {/* Border + place labels */}
        {act === 2 && (
          <g className="font-mono">
            <text x="252" y="352" fontSize="13" fill="#8FA6C4" letterSpacing="3">MYANMAR</text>
            <path d="M 244 358 l 8 -10 l 8 10 z" fill="#8FA6C4" opacity="0.7" />
            <text x="700" y="368" fontSize="13" fill="#8FA6C4" letterSpacing="3">THAILAND</text>
            <text x="500" y="222" fontSize="13" fill="#E3EEFB" letterSpacing="3">MAE SAI</text>
            <text x="420" y="448" fontSize="9.5" fill="#B7C9E0" letterSpacing="1.6">BORDER</text>
            <text x="420" y="460" fontSize="9.5" fill="#B7C9E0" letterSpacing="1.6">CROSSING</text>
            <line x1="452" y1="452" x2="470" y2="452" stroke="#B7C9E0" strokeWidth="0.8" />
          </g>
        )}

        {/* Radar sweep */}
        {act === 2 && (
          <g style={{ transformOrigin: '500px 380px' }} className="animate-[sweep_7s_linear_infinite]" opacity="0.13">
            <path d="M 500 380 L 500 -60 A 440 440 0 0 1 812 68 Z" fill="url(#grad-glow)" />
          </g>
        )}
      </svg>

      {/* ── Scan-line sheen ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 opacity-25 animate-[scanline_7s_linear_infinite]"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(56,189,248,.22), transparent)' }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(110% 80% at 50% 40%, transparent 55%, rgba(2,6,15,.72) 100%)' }} />

      {/* ── Left toolbar ────────────────────────────────────────────────── */}
      <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-md border border-sky-400/20 bg-[#070D1C]/85 p-1 backdrop-blur-md">
        {[
          { id: 'select', icon: MousePointer2 }, { id: 'pan', icon: Compass },
        ].map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)}
            className={`grid h-7 w-7 place-items-center rounded transition
              ${tool === t.id ? 'bg-[#FF003C]/20 text-[#FF6B8A] ring-1 ring-[#FF003C]/50' : 'text-sky-300/60 hover:bg-white/10 hover:text-sky-200'}`}>
            <t.icon size={13} />
          </button>
        ))}
        <span className="my-0.5 h-px bg-sky-400/20" />
        <button onClick={() => setZoom((z) => clamp(z + 0.15, 1, 2.2))} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Plus size={13} /></button>
        <button onClick={() => setZoom((z) => clamp(z - 0.15, 1, 2.2))} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Minus size={13} /></button>
        <button onClick={() => setZoom(1)} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Layers size={13} /></button>
        <button onClick={() => setZoom(1)} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Maximize2 size={13} /></button>
      </div>

      {/* ── Act 1: view switch + flood-wall callout ─────────────────────── */}
      {act === 1 && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1 rounded-md border border-sky-400/20 bg-[#070D1C]/85 p-1 backdrop-blur-md">
          {[['corridor', 'URBAN CORRIDOR'], ['catchment', 'UPSTREAM CATCHMENT · MYANMAR']].map(([id, lbl]) => (
            <button key={id} onClick={() => setView(id)}
              className={`btn px-3 py-1.5 ${view === id
                ? 'border-sky-400/60 bg-sky-400/20 text-sky-100'
                : 'border-transparent text-sky-300/55 hover:text-sky-200'}`}>{lbl}</button>
          ))}
        </div>
      )}

      {/* Prompt so a viewer knows the markers are clickable */}
      {act === 1 && !isCatchment && !gapCard && (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-20 -translate-x-1/2 animate-[fadeIn_.5s_ease-out]">
          <div className="flex items-center gap-2 rounded-md border border-[#FF003C]/45 bg-[#0B0F22]/85 px-3 py-1.5 backdrop-blur-md">
            <AlertTriangle size={11} className="text-[#FF003C] animate-[flash_1.4s_ease-in-out_infinite]" />
            <span className="font-mono text-[9.5px] tracking-[0.13em] text-[#FF9DB2]">
              14 FLOOD-WALL GAPS DETECTED — CLICK A MARKER
            </span>
          </div>
        </div>
      )}

      {act === 1 && !isCatchment && gapCard && (
        <div className="absolute z-20 w-[214px] animate-[riseIn_.28s_ease-out]"
          style={{
            left: `${clamp(gapCard.x / 1000, 0.04, 0.6) * 100}%`,
            top: `${clamp(gapCard.y / 760, 0.05, 0.6) * 100}%`,
            marginLeft: 26,
          }}>
          <Panel className="p-3" glow="#FF003C">
            <Corners color="rgba(255,0,60,.55)" />
            <button onClick={() => setGapCard(null)} className="absolute right-1.5 top-1.5 text-slate-500 hover:text-white"><X size={11} /></button>
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#FF003C]" />
              <div>
                <div className="text-[13px] font-semibold text-white">Missing Flood Wall</div>
                <div className="font-thai text-[10px] text-slate-400">จุดฟันหลอของกำแพงกันดิน</div>
              </div>
            </div>
            <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
              <div className="flex items-center justify-between">
                <span className="hud-label">Marker</span>
                <span className="num text-[11px] font-bold text-sky-200">{gapCard.id}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] pt-1.5">
                <span className="hud-label">Risk Level</span>
                <span className="num text-[11px] font-bold text-[#FF003C]">VERY HIGH</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] pt-1.5">
                <span className="hud-label">Gap Length</span>
                <span className="num text-[11px] font-bold text-white">{gapCard.len} m</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] pt-1.5">
                <span className="hud-label">Affected Locations</span>
                <span className="num text-[11px] font-bold text-white">14 Points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="hud-label">Evidence</span>
                <Src t="image" mini />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Act 2: route-blocked overlay ────────────────────────────────── */}
      {act === 2 && (
        <div className="absolute right-[16%] top-[24%] z-20 w-[236px]">
          <div className={`rounded-md border-2 px-3.5 py-3 backdrop-blur-md ${s.detourSolved
            ? 'border-[#00FF41]/60 bg-[#00FF41]/10' : 'border-[#FF003C] bg-[#FF003C]/12 animate-[softflash_1.4s_ease-in-out_infinite]'}`}
            style={{ boxShadow: s.detourSolved ? '0 0 26px -6px #00FF4188' : '0 0 30px -4px #FF003Caa' }}>
            <div className="flex items-center gap-2">
              {s.detourSolved
                ? <CheckCircle2 size={16} className="text-[#00FF41]" />
                : <AlertTriangle size={16} className="text-[#FF003C]" />}
              <span className="font-mono text-[12.5px] font-bold tracking-[0.09em]"
                style={{ color: s.detourSolved ? '#7CFFA0' : '#FF3B63' }}>
                {s.detourSolved ? 'DETOUR ACTIVE' : 'ROUTE BLOCKED: LANDSLIDE'}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[9px] leading-relaxed text-slate-300/80">
              {s.detourSolved
                ? 'Route 1290 → Ban Pa Sang link · +14 min transit · computed by Sphere Routing API.'
                : 'Mountain Route 7 severed by debris flow. Sphere Routing API can compute a detour.'}
            </div>
            {routeDetail && (
              <div className="mt-2 space-y-1 border-t border-white/15 pt-2 animate-[riseIn_.25s_ease-out]">
                {[['Road', 'Mountain Route 7'], ['Debris run-out', '≈ 180 m'], ['Detected', '09:15 · SAR change'],
                  ['Communities cut off', 'Sai Lom Joy'], ['Alternate exits', '0 remaining']].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="hud-label">{k}</span>
                    <span className="num text-[9.5px] text-white">{v}</span>
                  </div>
                ))}
                <div className="flex justify-end pt-0.5"><Src t="radar" mini /></div>
              </div>
            )}
            {!s.detourSolved && (
              <Btn size="sm" variant="danger" icon={Route} className="mt-2.5 w-full" onClick={eng.solveDetour}>
                Compute Detour · 500 AP
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* ── Act 2: cloud lock banner ────────────────────────────────────── */}
      {act === 2 && (
        <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-md border border-[#A78BFA]/45 bg-[#0B0F22]/90 px-3 py-1.5 backdrop-blur-md">
            <Lock size={11} className="text-[#A78BFA]" />
            <span className="font-mono text-[9.5px] tracking-[0.14em] text-[#C4B5FD]">CLOUD COVER 100% · OPTICAL LOCKED</span>
            <span className="h-3 w-px bg-white/15" />
            <Radar size={11} className="text-[#A78BFA] animate-[glowpulse_2s_ease-in-out_infinite]" />
            <span className="font-mono text-[9.5px] tracking-[0.14em] text-[#C4B5FD]">RADARSAT-2 ACTIVE</span>
          </div>
        </div>
      )}

      {/* ── Bottom-left readout ─────────────────────────────────────────── */}
      <div className="absolute bottom-2.5 left-3 z-20 flex items-center gap-2 rounded border border-sky-400/15 bg-[#060B17]/85 px-2.5 py-1 backdrop-blur">
        <span className="hud-label">SFVI</span>
        <span className="num text-[12px] font-bold" style={{ color: sfvi.basin >= 0.7 ? '#FF003C' : sfvi.basin >= 0.5 ? '#FFB300' : '#00FF41' }}>
          {sfvi.basin.toFixed(3)}
        </span>
        <span className="h-3 w-px bg-white/15" />
        <span className="hud-label">CONF</span>
        <span className="num text-[11px] text-sky-200">{Math.round(sfvi.confidence * 100)}%</span>
        {veto1 && (
          <>
            <span className="h-3 w-px bg-white/15" />
            <span className="font-mono text-[9.5px] font-bold tracking-[0.12em] text-[#FF003C] animate-[flash_1s_ease-in-out_infinite]">VETO 1 ACTIVE</span>
          </>
        )}
      </div>
      <div className="absolute bottom-2.5 right-3 z-20 flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-sky-300/45">
        <span>19°59′59″N 99°52′46″E</span>
        <span className="h-3 w-px bg-white/10" />
        <span>{act === 2 ? 'RADARSAT-2 · C-BAND' : 'THEOS-2 · L3 ORTHO'}</span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   7 · LEFT RAIL — layer catalogue + minimap
   ══════════════════════════════════════════════════════════════════════════ */

function LayersPanel({ eng }) {
  const { s, toggleLayer } = eng
  const [open, setOpen] = useState(true)
  const groups = useMemo(() => {
    const g = {}
    LAYERS.forEach((l) => {
      if (l.actOnly && l.actOnly !== s.act) return
      ;(g[l.group] ||= []).push(l)
    })
    return g
  }, [s.act])

  if (!open) {
    return (
      <Panel className="shrink-0 p-2">
        <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2 text-left">
          <Layers size={12} className="text-sky-300" />
          <span className="panel-title">MAP LAYERS</span>
          <ChevronRight size={12} className="ml-auto text-slate-500" />
        </button>
      </Panel>
    )
  }

  return (
    <Panel className="flex min-h-[180px] flex-1 flex-col">
      <PanelHead title="MAP LAYERS" icon={Layers}
        right={
          <div className="flex items-center gap-2">
            <span className="num rounded border border-[#FFB300]/35 bg-[#FFB300]/10 px-1.5 py-[2px] text-[9px] font-bold text-[#FFD066]">
              ◈ {s.coins}
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X size={11} /></button>
          </div>
        } />
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
        {Object.entries(groups).map(([g, items]) => (
          <div key={g}>
            <Divider label={g} />
            <div className="space-y-1">
              {items.map((l) => {
                const on = !!s.layers[l.id]
                const locked = s.act === 2 && l.optical
                const tooPoor = !on && !locked && s.coins < l.cost
                return (
                  <button key={l.id} disabled={locked} onClick={() => toggleLayer(l.id)}
                    className={`group flex w-full items-center gap-2.5 rounded border px-2 py-[7px] text-left transition
                      ${locked ? 'cursor-not-allowed border-[#A78BFA]/20 bg-[#A78BFA]/[0.04]'
                        : on ? 'border-sky-400/40 bg-sky-400/[0.09]'
                          : tooPoor ? 'border-white/[0.06] bg-white/[0.015] opacity-45'
                            : 'border-white/[0.07] bg-white/[0.02] hover:border-sky-400/30 hover:bg-white/[0.05]'}`}>
                    <span className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border transition
                      ${locked ? 'border-[#A78BFA]/45' : on ? 'border-sky-400 bg-sky-400' : 'border-slate-500/60'}`}>
                      {locked ? <Lock size={8} className="text-[#A78BFA]" />
                        : on ? <Check size={10} strokeWidth={3.5} className="text-[#04121F]" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[11px] leading-tight ${locked ? 'text-[#A78BFA]/70 line-through' : on ? 'text-white' : 'text-slate-300'}`}>
                        {l.name}
                      </span>
                      <span className="block truncate text-[8.5px] leading-tight text-slate-500">
                        {locked ? 'CLOUD COVER 100% — เมฆปกคลุม' : l.sub}
                      </span>
                    </span>
                    {!locked && !on && (
                      <span className="num shrink-0 rounded border border-[#FFB300]/30 px-1 text-[8.5px] text-[#FFD066]">◈{l.cost}</span>
                    )}
                    {on && <Src t={l.src} mini />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <button className="btn mt-3 w-full border-dashed border-sky-400/30 bg-transparent px-3 py-2 text-sky-300/70 hover:border-sky-400/60 hover:text-sky-200">
          <span className="flex items-center justify-center gap-1.5"><Plus size={11} /> ADD LAYER</span>
        </button>
      </div>
    </Panel>
  )
}

function MiniMap({ eng, className = '' }) {
  const act = eng.s.act
  return (
    <Panel className={`shrink-0 ${className}`}>
      <PanelHead title={act === 2 ? 'MINIMAP' : 'AREA OVERVIEW'} icon={act === 2 ? Navigation : Compass}
        right={<button className="text-slate-500 hover:text-white"><X size={11} /></button>} />
      <div className="relative h-[128px] p-2">
        <svg viewBox="0 0 200 128" className="h-full w-full">
          <rect x="0" y="0" width="200" height="128" fill="#060B16" />
          <path d="M 30 8 C 46 30, 38 48, 52 64 S 74 96, 66 122" stroke="#1E4E8C" strokeWidth="6" fill="none" opacity="0.5" />
          <path d="M 30 8 C 46 30, 38 48, 52 64 S 74 96, 66 122" stroke="#38BDF8" strokeWidth="1.8" fill="none"
            style={{ filter: 'drop-shadow(0 0 4px #38BDF8)' }} />
          {[[38, 26], [44, 52], [56, 78], [62, 104]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2" fill="#38BDF8" opacity="0.75" />
          ))}
          <path d="M 6 4 L 190 10 L 186 120 L 10 116 Z" fill="none" stroke="#1e3a5f" strokeWidth="0.8" strokeDasharray="4 3" />
          <rect x="26" y="30" width="42" height="42" fill="none" stroke="#FF003C" strokeWidth="1.3"
            className="animate-[softflash_2.4s_ease-in-out_infinite]" />
        </svg>
        <div className="absolute bottom-2.5 left-3 flex items-center gap-1 text-slate-400">
          <Navigation size={12} className="rotate-[-45deg]" />
          <span className="font-mono text-[9px]">N</span>
        </div>
      </div>
    </Panel>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   8 · TOP BAR + ACT SWITCHER
   ══════════════════════════════════════════════════════════════════════════ */

const ACTS = [
  { n: 1, roman: 'I', code: 'T−48 HRS', name: 'SEEING THE UNSEEN UPSTREAM', th: 'มองต้นน้ำที่มองไม่เห็น', hex: '#00FF41' },
  { n: 2, roman: 'II', code: 'T+0 HRS', name: 'THE DAY CLOUDS COVERED THE BASIN', th: 'วันที่เมฆบังทั้งลุ่มน้ำ', hex: '#FF003C' },
  { n: 3, roman: 'III', code: 'AAR', name: 'WATER RECEDES, MUD REMAINS', th: 'เมื่อน้ำลดแต่โคลนยังอยู่', hex: '#38BDF8' },
]

function ActSwitcher({ act, goAct }) {
  return (
    <div className="flex items-center gap-[3px] rounded-md border border-sky-400/20 bg-[#060C1A]/80 p-[3px] backdrop-blur">
      {ACTS.map((a) => {
        const on = act === a.n
        return (
          <button key={a.n} onClick={() => goAct(a.n)} title={`${a.name} — ${a.th}`}
            className="group relative rounded-[5px] px-3 py-1.5 transition-all duration-200"
            style={on
              ? { background: `linear-gradient(180deg, ${a.hex}26, ${a.hex}10)`, boxShadow: `inset 0 0 0 1px ${a.hex}66, 0 0 18px -6px ${a.hex}` }
              : undefined}>
            <span className="flex items-center gap-2">
              <span className="num text-[13px] font-bold leading-none transition-colors"
                style={{ color: on ? a.hex : '#4b6382' }}>{a.roman}</span>
              <span className="flex flex-col items-start leading-none">
                <span className="font-mono text-[9px] font-semibold tracking-[0.12em] transition-colors"
                  style={{ color: on ? '#fff' : '#64809f' }}>{a.code}</span>
                <span className="mt-[3px] font-mono text-[7px] tracking-[0.1em] transition-colors"
                  style={{ color: on ? `${a.hex}cc` : '#3d5573' }}>ACT {a.roman}</span>
              </span>
            </span>
            {on && <span className="absolute inset-x-2 -bottom-[3px] h-[2px] rounded-full" style={{ background: a.hex, boxShadow: `0 0 8px ${a.hex}` }} />}
          </button>
        )
      })}
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-3 pr-4">
      <div className="relative grid h-9 w-9 place-items-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full">
          <path d="M20 2 L35 8 V21 C35 30 28 36 20 38 C12 36 5 30 5 21 V8 Z"
            fill="#0B1526" stroke="#38BDF8" strokeWidth="1.4" />
          <path d="M20 5.5 L31.8 10.2 V21 C31.8 28.2 26.2 33.2 20 34.9 C13.8 33.2 8.2 28.2 8.2 21 V10.2 Z"
            fill="none" stroke="#38BDF8" strokeWidth="0.6" opacity="0.5" />
          <circle cx="20" cy="19" r="4.4" fill="none" stroke="#00FF41" strokeWidth="1.3" />
          <line x1="20" y1="10.5" x2="20" y2="27.5" stroke="#00FF41" strokeWidth="1" opacity="0.85" />
          <line x1="11.5" y1="19" x2="28.5" y2="19" stroke="#00FF41" strokeWidth="1" opacity="0.85" />
          <circle cx="20" cy="19" r="1.3" fill="#00FF41" />
        </svg>
      </div>
      <div className="leading-none">
        <div className="font-mono text-[17px] font-bold tracking-[0.15em] text-white">MAE SAI COMMAND</div>
        <div className="mt-[3px] font-mono text-[7.5px] tracking-[0.22em] text-sky-300/50">THEOS-2 · GISTDA GEOSPATIAL DECISION SIMULATOR</div>
      </div>
    </div>
  )
}

function TopBar({ eng }) {
  const { s, situation, veto1, running, setRunning, goAct, reset } = eng
  const act = ACTS.find((a) => a.n === s.act)
  const sitHex = situation === 'CRITICAL' ? '#FF003C' : situation === 'HIGH' ? '#FF7A1A' : situation === 'REVIEW' ? '#38BDF8' : '#FFB300'
  const popAtRisk = s.act === 1 ? 14_360 : 23_860

  return (
    <header className="relative z-30 flex h-[74px] shrink-0 items-center gap-3 border-b border-sky-400/15 bg-[#060B16]/92 px-4 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
      <Logo />

      {/* Situation level */}
      <div className="hidden items-center gap-2.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 xl:flex">
        <div className="leading-none">
          <div className="hud-label">SITUATION LEVEL</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="num text-[13px] font-bold tracking-wider" style={{ color: sitHex }}>{situation}</span>
            {(situation === 'CRITICAL') && <AlertTriangle size={13} className="text-[#FF003C] animate-[flash_1.1s_ease-in-out_infinite]" />}
          </div>
        </div>
      </div>

      {/* Mission clock — the visual centrepiece */}
      <div className="relative mx-auto flex flex-col items-center">
        <div className="clip-notch relative border px-8 py-1.5"
          style={{ borderColor: `${act.hex}55`, background: `linear-gradient(180deg, ${act.hex}18, transparent)` }}>
          <div className={`num whitespace-nowrap font-bold leading-none tracking-[0.06em]
            ${s.act === 3 ? 'text-[17px]' : 'text-[26px]'}`}
            style={{ color: act.hex, textShadow: `0 0 22px ${act.hex}99` }}>
            {s.act === 3 ? 'AFTER ACTION REVIEW' : clockHeadline(s.clock)}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[8.5px] tracking-[0.18em]" style={{ color: `${act.hex}bb` }}>
          <span>{s.act === 1 ? 'UNTIL PEAK FLOOD' : s.act === 2 ? 'PEAK FLOOD IN PROGRESS' : 'OPERATION: MAE SAI FLOOD RESPONSE'}</span>
          <span className="h-2 w-px bg-white/20" />
          <span className="font-thai">{act.th}</span>
        </div>
      </div>

      {/* Action Points */}
      <div className={`min-w-[186px] flex-col gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2
        ${s.act === 3 ? 'hidden' : 'hidden lg:flex'}`}>
        <div className="flex items-center justify-between">
          <span className="hud-label">ACTION POINTS</span>
          <Zap size={10} className="text-[#FFB300]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(s.ap / AP_MAX) * 100}%`,
                background: s.ap / AP_MAX > 0.5 ? 'linear-gradient(90deg,#FFB30099,#FFD066)' : 'linear-gradient(90deg,#FF003C99,#FF6B8A)',
                boxShadow: `0 0 8px ${s.ap / AP_MAX > 0.5 ? '#FFB300' : '#FF003C'}aa`,
              }} />
          </div>
        </div>
        <div className="num text-[10px] text-slate-300">{fmt(s.ap)} <span className="text-slate-500">/ {fmt(AP_MAX)} AP</span></div>
      </div>

      {/* Population at risk / final outcome */}
      <div className={`items-center gap-2.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2
        ${s.act === 3 ? 'hidden xl:flex' : 'hidden 2xl:flex'}`}>
        {s.act === 3 ? <CheckCircle2 size={17} className="text-[#7CFFA0]" /> : <Users size={17} className="text-sky-300/80" />}
        <div className="leading-none">
          <div className="hud-label">{s.act === 3 ? 'POPULATION AFFECTED' : 'POPULATION AT RISK'}</div>
          <div className="num mt-1 text-[15px] font-bold text-white">{fmt(s.act === 3 ? 23_860 : popAtRisk)}</div>
        </div>
      </div>

      <ActSwitcher act={s.act} goAct={goAct} />

      {/* Sim transport */}
      {s.act !== 3 && (
        <div className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] p-[3px]">
          <button onClick={() => setRunning((r) => !r)} title={running ? 'Pause mission clock' : 'Run mission clock'}
            className={`grid h-7 w-7 place-items-center rounded transition ${running ? 'bg-[#FF003C]/20 text-[#FF6B8A]' : 'text-[#7CFFA0] hover:bg-[#00FF41]/15'}`}>
            {running ? <Timer size={13} className="animate-[flash_1s_ease-in-out_infinite]" /> : <Clock size={13} />}
          </button>
          <button onClick={() => eng.advance(60)} title="Advance mission clock 1 hour"
            className="grid h-7 w-7 place-items-center rounded text-sky-300/70 hover:bg-white/10 hover:text-sky-100">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Advance to the next act — the presenter's forward button */}
      {s.act !== 3 && (
        <button onClick={() => goAct(s.act + 1)} title={`Continue to Act ${s.act + 1}`}
          className="btn flex items-center gap-2 px-3 py-2"
          style={{
            borderColor: `${ACTS[s.act].hex}77`,
            background: `linear-gradient(180deg, ${ACTS[s.act].hex}26, ${ACTS[s.act].hex}0D)`,
            color: ACTS[s.act].hex,
            boxShadow: `0 0 18px -6px ${ACTS[s.act].hex}`,
          }}>
          <Play size={13} fill="currentColor" />
          <span className="flex flex-col items-start leading-none">
            <span className="text-[9px] tracking-[0.14em]">NEXT ACT</span>
            <span className="mt-[3px] text-[7.5px] tracking-[0.1em] opacity-70">ACT {ACTS[s.act].roman}</span>
          </span>
        </button>
      )}

      <div className="flex items-center gap-1">
        <button onClick={reset} title="Reset mission" className="grid h-9 w-9 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white">
          <RotateCcw size={15} />
        </button>
        <button className="grid h-9 w-9 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white"><Settings size={16} /></button>
        <button className="grid h-9 w-9 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>
      </div>

      {veto1 && s.act !== 3 && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#FF003C] animate-[flash_.85s_ease-in-out_infinite]"
          style={{ boxShadow: '0 0 14px #FF003C' }} />
      )}
    </header>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   9 · BOTTOM STRIPS — weather (Act 1) · alert log (Act 2)
   ══════════════════════════════════════════════════════════════════════════ */

function WeatherBar({ eng }) {
  const { s } = eng
  const cells = [
    { icon: Droplets, label: 'RAINFALL (24 HRS)', value: `${fmt(s.rain24)} mm`, src: 'measured', hex: '#38BDF8' },
    {
      icon: Waves, label: 'RIVER LEVEL', value: `${s.waterLevel.toFixed(2)} m`, src: 'measured',
      hex: s.waterLevel >= CRITICAL_LEVEL ? '#FF003C' : s.waterLevel >= PREP_LEVEL ? '#FFB300' : '#00FF41', arrow: true,
    },
    { icon: Wind, label: 'WIND', value: '12 km/h', sub: 'NE', src: 'measured', hex: '#7dd3fc' },
    { icon: Thermometer, label: 'TEMPERATURE', value: '24°C', src: 'measured', hex: '#7dd3fc' },
  ]
  return (
    <Panel className="shrink-0">
      <div className="flex items-stretch gap-3 p-3">
        <div className="flex min-w-[190px] items-center gap-3 border-r border-white/[0.08] pr-3">
          <CloudRain size={30} className="text-sky-300/85" />
          <div className="leading-tight">
            <div className="hud-label">WEATHER FORECAST</div>
            <div className="mt-1 text-[12.5px] font-bold text-[#FF003C]">HEAVY RAIN</div>
            <div className="text-[9.5px] text-slate-400">Expected in 48 Hrs</div>
          </div>
        </div>
        {cells.map((c) => (
          <div key={c.label} className="relative min-w-0 flex-1 rounded border border-white/[0.07] bg-white/[0.025] px-3 py-2">
            <Corners color="rgba(56,189,248,.22)" />
            <div className="flex items-center justify-between gap-2">
              <span className="hud-label truncate">{c.label}</span>
              <Src t={c.src} mini />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="num text-[19px] font-bold leading-none" style={{ color: c.hex }}>{c.value}</span>
              {c.sub && <span className="text-[10px] text-slate-400">{c.sub}</span>}
              {c.arrow && <ArrowUp size={13} className="text-[#FF003C]" />}
            </div>
            {c.label === 'RIVER LEVEL' && (
              <div className="mt-1.5">
                <div className="relative h-[4px] w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${clamp(s.waterLevel / 6.4) * 100}%`, background: `linear-gradient(90deg,${c.hex}66,${c.hex})`, boxShadow: `0 0 8px ${c.hex}` }} />
                  <div className="absolute top-[-3px] h-[10px] w-[2px] bg-[#FF003C]"
                    style={{ left: `${(CRITICAL_LEVEL / 6.4) * 100}%`, boxShadow: '0 0 6px #FF003C' }} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[7.5px] text-slate-500">
                  <span>0.00 m</span>
                  <span className="text-[#FF003C]">CRIT {CRITICAL_LEVEL.toFixed(2)} m · บ้านถ้ำผาจม</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function AlertLog({ eng, height = 172 }) {
  const { s } = eng
  const [open, setOpen] = useState(true)
  const scripted = s.act === 2 ? ACT2_ALERTS.slice().reverse() : []
  const live = s.logs.slice(0, 14)

  if (!open) {
    return (
      <Panel className="shrink-0 p-2">
        <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2">
          <ScrollText size={12} className="text-sky-300" />
          <span className="panel-title">SYSTEM ALERT LOG</span>
          <ChevronDown size={12} className="ml-auto text-slate-500" />
        </button>
      </Panel>
    )
  }

  const lvColor = { crit: '#FF003C', warn: '#FFB300', good: '#00FF41', info: '#38BDF8' }

  return (
    <Panel className="flex min-h-0 shrink-0 flex-col" style={{ height }}>
      <PanelHead title="SYSTEM ALERT LOG" icon={ScrollText}
        right={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-mono text-[8.5px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00FF41] animate-[flash_1.6s_ease-in-out_infinite]" />
              LIVE FEED
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X size={11} /></button>
          </div>
        } />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {scripted.map((a, i) => (
          <div key={`sc${i}`} className="group flex items-start gap-2.5 border-b border-white/[0.05] px-3 py-[9px] transition hover:bg-white/[0.03]">
            <AlertTriangle size={13} className="mt-[1px] shrink-0 text-[#FF003C]" />
            <span className="num shrink-0 pt-[1px] text-[9.5px] text-slate-500">{a.t}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-bold tracking-[0.1em] text-[#FF3B63]">{a.tag}</span>
              <span className="block truncate text-[10.5px] text-slate-300">{a.msg}</span>
            </span>
            <ChevronRight size={13} className="mt-1 shrink-0 text-slate-600 transition group-hover:text-sky-300" />
          </div>
        ))}
        {live.map((l) => (
          <div key={l.id} className="group flex items-start gap-2.5 border-b border-white/[0.04] px-3 py-[9px] transition hover:bg-white/[0.03] animate-[fadeIn_.35s_ease-out]">
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: lvColor[l.lv], boxShadow: `0 0 6px ${lvColor[l.lv]}` }} />
            <span className="num shrink-0 pt-[1px] text-[9.5px] text-slate-500">
              {String(l.stamp.getHours()).padStart(2, '0')}:{String(l.stamp.getMinutes()).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-bold tracking-[0.1em]" style={{ color: lvColor[l.lv] }}>{l.tag}</span>
              <span className="block text-[10.5px] leading-snug text-slate-300">{l.msg}</span>
              {l.th && <span className="font-thai block text-[9.5px] leading-snug text-slate-500">{l.th}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-1.5">
        <span className="hud-label">{s.logs.length} ENTRIES</span>
        <button className="font-mono text-[9px] tracking-[0.1em] text-[#FF3B63] hover:text-white">VIEW ALL ALERTS</button>
      </div>
    </Panel>
  )
}

function CriticalBanner({ eng }) {
  const { s, veto1 } = eng
  if (s.act !== 2 && !veto1) return null
  const title = veto1 && s.act === 1 ? 'VETO RULE 1 — EVACUATE NOW' : 'SEVERE FLOODING IN PROGRESS'
  const body = veto1 && s.act === 1
    ? `Ban Tham Pha Chom has reached ${s.waterLevel.toFixed(2)} m. Order evacuation without waiting for the next image pass.`
    : 'Multiple locations inundated. Immediate action required.'
  return (
    <div className="relative shrink-0 overflow-hidden rounded-lg border-2 border-[#FF003C]/70 bg-[#FF003C]/[0.09] px-4 py-2.5 backdrop-blur-md animate-[softflash_1.6s_ease-in-out_infinite]"
      style={{ boxShadow: '0 0 34px -10px #FF003C' }}>
      <div className="flex items-center gap-3.5">
        <AlertTriangle size={22} className="shrink-0 text-[#FF003C]" />
        <div className="shrink-0 border-r border-[#FF003C]/35 pr-3.5 leading-none">
          <div className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#FF3B63]">CRITICAL</div>
          <div className="mt-1 font-mono text-[10px] font-bold tracking-[0.16em] text-[#FF3B63]">ALERT</div>
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-bold tracking-wide text-white">{title}</div>
          <div className="truncate text-[11px] text-slate-300/85">{body}</div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   10 · COMMAND INTERFACE (right column, Acts 1–2)
   ══════════════════════════════════════════════════════════════════════════ */

function SfviPanel({ eng }) {
  const { sfvi, s, veto2 } = eng
  const rows = [
    { k: 'W', w: SFVI_WEIGHTS.W, v: sfvi.W, src: 'measured', label: 'River level ÷ 4.20 m', th: 'สถานีบ้านถ้ำผาจม' },
    { k: 'R', w: SFVI_WEIGHTS.R, v: sfvi.R, src: 'measured', label: 'Upstream rainfall (norm.)', th: 'สถานีบ้านโจตาดา · เมียนมา' },
    { k: 'L', w: sfvi.Lw, v: sfvi.L, src: 'image', label: `New landslide scars ${sfvi.scarsSeen}/${TOTAL_SCARS}`, th: 'ร่องรอยดินถล่มใหม่', dim: veto2 },
    { k: 'N', w: SFVI_WEIGHTS.N, v: sfvi.N, src: 'image', label: `Channel loss · ${Math.round(s.channelWidth)} m of ${ORIG_WIDTH} m`, th: 'สัดส่วนความกว้างลำน้ำที่หายไป' },
    { k: 'P', w: SFVI_WEIGHTS.P, v: sfvi.P, src: 'scenario', label: 'Households in flood reach', th: 'ครัวเรือนในเขตน้ำถึง' },
  ]
  const hex = sfvi.basin >= 0.7 ? '#FF003C' : sfvi.basin >= 0.5 ? '#FFB300' : '#00FF41'
  return (
    <div className="space-y-2.5">
      <div className="relative rounded border border-white/[0.08] bg-white/[0.025] p-3">
        <Corners />
        <div className="flex items-center justify-between">
          <span className="hud-label">SAI FLOOD VULNERABILITY INDEX</span>
          <span className="font-mono text-[8px] text-slate-500">SFVI</span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="num text-[32px] font-bold leading-none" style={{ color: hex, textShadow: `0 0 20px ${hex}77` }}>
            {sfvi.basin.toFixed(3)}
          </span>
          <div className="flex-1 pb-1">
            <div className="h-[7px] w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${sfvi.basin * 100}%`, background: `linear-gradient(90deg,${hex}55,${hex})`, boxShadow: `0 0 10px ${hex}` }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[7.5px] text-slate-500">
              <span>0.000</span><span>DECISION BAND ≥ 0.620</span><span>1.000</span>
            </div>
          </div>
        </div>
        <div className="mt-2 border-t border-white/[0.07] pt-2 text-center font-mono text-[9px] tracking-[0.06em] text-sky-300/70">
          SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.k} className={`rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 ${r.dim ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="num grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[3px] border border-sky-400/35 bg-sky-400/10 text-[10px] font-bold text-sky-200">
                {r.k}
              </span>
              <span className="num shrink-0 text-[9px] text-slate-500">×{r.w.toFixed(2)}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{r.label}</span>
              <Src t={r.src} mini />
              <span className="num w-[38px] shrink-0 text-right text-[11px] font-semibold text-white">{r.v.toFixed(2)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-sky-400 transition-[width] duration-500"
                  style={{ width: `${r.v * 100}%`, boxShadow: '0 0 6px #38BDF8' }} />
              </div>
              <span className="font-thai shrink-0 text-[8.5px] text-slate-500">{r.th}</span>
            </div>
            {r.dim && (
              <div className="mt-1.5 flex items-center gap-1.5 rounded border border-[#A78BFA]/25 bg-[#A78BFA]/[0.07] px-1.5 py-1">
                <Lock size={9} className="shrink-0 text-[#A78BFA]" />
                <span className="text-[8.5px] leading-tight text-[#C4B5FD]">
                  VETO 2 — cloud cover / imagery &gt; 48 h old. Weight cut to {sfvi.Lw.toFixed(2)}, confidence flagged LOW.
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
        <span className="hud-label">EVIDENCE CONFIDENCE</span>
        <div className="flex items-center gap-2">
          <div className="h-[4px] w-20 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-[#00FF41]" style={{ width: `${sfvi.confidence * 100}%`, boxShadow: '0 0 6px #00FF41' }} />
          </div>
          <span className="num text-[11px] font-semibold text-[#7CFFA0]">{Math.round(sfvi.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

function DecisionBlock({ eng }) {
  const { s, sfvi, veto1, issueOrder } = eng
  const justified = s.waterLevel >= PREP_LEVEL || sfvi.basin >= 0.62
  return (
    <div className="space-y-2">
      <Divider label="COMMAND DECISION · การตัดสินใจ" />
      {veto1 && (
        <div className="flex items-start gap-2 rounded border border-[#FF003C]/50 bg-[#FF003C]/10 px-2.5 py-2">
          <AlertTriangle size={12} className="mt-[1px] shrink-0 text-[#FF003C]" />
          <span className="text-[9.5px] leading-snug text-[#FFB3C2]">
            <b className="font-mono">VETO 1 ACTIVE</b> — {s.waterLevel.toFixed(2)} m ≥ {CRITICAL_LEVEL.toFixed(2)} m.
            Evacuate now; waiting for the next image pass is no longer a valid option.
          </span>
        </div>
      )}
      <Btn variant="danger" size="lg" icon={Megaphone} className="w-full" onClick={() => issueOrder('EVACUATE')}
        disabled={s.ap < EVAC_AP[s.act]}>
        Issue Evacuation Order · {fmt(EVAC_AP[s.act])} AP
      </Btn>
      <Btn variant="warn" size="lg" icon={Bell} className="w-full" onClick={() => issueOrder('STANDBY')} disabled={s.ap < 700}>
        Preparedness Notice + Urgent Tasking · 700 AP
      </Btn>
      <Btn variant="solid" size="lg" icon={Clock} className="w-full" onClick={() => issueOrder('HOLD')}>
        Hold — Wait For Next Image Pass
      </Btn>
      <div className="font-thai px-1 text-center text-[9px] text-slate-500">
        “ยังไม่สั่งการ รอภาพรอบหน้า” — เวลาเดินต่อ +3 ชม. และระบบจะแสดงผลที่เกิดกับทั้ง 4 ชุมชน
      </div>
      <div className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
        <span className="hud-label">ORDER WOULD BE</span>
        <span className="num text-[10px] font-bold" style={{ color: justified ? '#00FF41' : '#FF003C' }}>
          {justified ? 'EVIDENCE-BACKED' : 'FALSE ALARM RISK'}
        </span>
      </div>
      <div className="flex items-center justify-between px-1 font-mono text-[8.5px] text-slate-500">
        <span>FALSE ALARMS: {s.falseAlarms} · NEXT PENALTY −{[5, 15, 40][Math.min(s.falseAlarms, 2)]}%</span>
        <span>HOLDS: {s.holdCount}</span>
      </div>
    </div>
  )
}

function TaskingPanel({ eng, setView }) {
  const { s } = eng
  return (
    <div className="space-y-2.5">
      <div className="relative rounded border border-white/[0.08] bg-white/[0.025] p-3">
        <Corners />
        <div className="flex items-center justify-between">
          <span className="hud-label">THEOS-2 TASKING BUDGET</span>
          <Satellite size={12} className="text-sky-300" />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="num text-[26px] font-bold leading-none text-white">{s.swaths}</span>
          <span className="pb-1 text-[10px] text-slate-400">swaths remaining · {SWATH_KM} km each</span>
        </div>
        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[5px] flex-1 rounded-full transition-colors duration-500"
              style={{ background: i < s.swaths ? '#38BDF8' : 'rgba(255,255,255,.08)', boxShadow: i < s.swaths ? '0 0 8px #38BDF8' : 'none' }} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-2 font-mono text-[8.5px] text-slate-400">
          <div>PAN <span className="text-white">0.5 m</span></div>
          <div>MS <span className="text-white">2 m</span></div>
          <div>REVISIT <span className="text-white">1.9 d avg</span></div>
          <div>PRODUCT <span className="text-white">L3 ORTHO</span></div>
        </div>
      </div>

      <Btn variant="primary" size="lg" icon={Crosshair} className="w-full" onClick={() => setView('catchment')}>
        Open Catchment Tasking Grid
      </Btn>

      <div className="space-y-1">
        {SECTORS.map((sec) => {
          const done = s.tasked.includes(sec.id)
          return (
            <button key={sec.id} disabled={done || s.swaths <= 0 || s.ap < 1200}
              onClick={() => { setView('catchment'); eng.taskSwath(sec.id) }}
              className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left transition
                ${done ? 'border-[#00FF41]/35 bg-[#00FF41]/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-sky-400/40 hover:bg-white/[0.05] disabled:opacity-35'}`}>
              <span className="num grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[3px] border text-[10px] font-bold"
                style={{ borderColor: done ? '#00FF4166' : '#38BDF855', color: done ? '#7CFFA0' : '#9FCBEF' }}>{sec.id}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10.5px] text-slate-200">{sec.label}</span>
                <span className="font-thai block text-[8.5px] text-slate-500">{sec.th} · forest loss {sec.forestLoss}%</span>
              </span>
              {done
                ? <span className="num shrink-0 text-[10px] font-bold text-[#FF6B8A]">{sec.scars} scars</span>
                : <span className="num shrink-0 text-[9px] text-[#FFD066]">1,200 AP</span>}
            </button>
          )
        })}
      </div>

      <div className="rounded border border-[#FFB300]/25 bg-[#FFB300]/[0.06] px-2.5 py-2">
        <div className="flex items-start gap-2">
          <Info size={11} className="mt-[1px] shrink-0 text-[#FFD066]" />
          <span className="text-[9px] leading-snug text-[#FFE0A3]">
            Scars are 20–30 m wide. At 10 m GSD they cover only 2–3 pixels — detectable, but 0% pure pixels, so the
            width cannot be measured. THEOS-2 Pan (0.5 m) yields 40–60 pixels across.
          </span>
        </div>
      </div>
    </div>
  )
}

function ResourcePanelAct1({ eng }) {
  const { s, deploy, tactical } = eng
  return (
    <div className="space-y-3">
      <Divider label="QUICK DEPLOY" />
      <div className="grid grid-cols-2 gap-2">
        {QUICK_DEPLOY.map((q) => (
          <button key={q.id} onClick={() => deploy(q.id)} disabled={s.ap < q.ap}
            className="group relative overflow-hidden rounded border border-white/[0.08] bg-white/[0.025] p-2.5 text-left transition hover:border-sky-400/40 hover:bg-white/[0.05] disabled:opacity-35">
            <Corners />
            <div className="hud-label truncate">{q.name.toUpperCase()}</div>
            <div className="my-2 grid h-[54px] place-items-center rounded bg-gradient-to-b from-white/[0.05] to-transparent">
              <q.icon size={30} className="text-sky-200/80 transition group-hover:text-sky-100" />
            </div>
            <div className="num text-[15px] font-bold text-sky-300">{fmt(q.stock - s.deployed[q.id])} <span className="text-[10px] font-normal text-slate-400">{q.unit}</span></div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-thai text-[8.5px] text-slate-500">{q.th}</span>
              <span className="num text-[8.5px] text-[#FFD066]">{q.ap} AP</span>
            </div>
            {s.deployed[q.id] > 0 && (
              <div className="mt-1 rounded bg-[#00FF41]/12 px-1.5 py-[2px] text-center font-mono text-[8px] text-[#7CFFA0]">
                +{fmt(s.deployed[q.id])} DEPLOYED
              </div>
            )}
          </button>
        ))}
      </div>

      <Divider label="TACTICAL ACTIONS" />
      <div className="grid grid-cols-3 gap-2">
        {TACTICAL.map((t) => {
          const cost = t.id === 'evac' ? EVAC_AP[s.act] : t.ap
          return (
            <button key={t.id} onClick={() => tactical(t.id)} disabled={s.ap < cost}
              title={`${t.name} — ${t.th} · ${fmt(cost)} AP`}
              className="group relative rounded border border-white/[0.08] bg-white/[0.025] p-2 text-center transition hover:border-sky-400/40 hover:bg-white/[0.05] disabled:opacity-35">
              <div className="hud-label truncate text-[7.5px]">{t.name.toUpperCase()}</div>
              <div className="my-1.5 grid h-[40px] place-items-center">
                <t.icon size={22} className="text-sky-200/75 transition group-hover:scale-110 group-hover:text-sky-100" />
              </div>
              <div className="num text-[8.5px] text-[#FFD066]">{fmt(cost)} AP</div>
            </button>
          )
        })}
      </div>

      {s.queue.length > 0 && (
        <>
          <Divider label={`DEPLOYMENT QUEUE · ${s.queue.length} ACTIVE`} />
          <div className="space-y-1">
            {s.queue.map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                <Truck size={11} className="shrink-0 text-sky-300" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{q.name} × {q.qty}</span>
                <span className="num shrink-0 text-[9.5px]" style={{ color: q.eta > 0 ? '#FFD066' : '#7CFFA0' }}>
                  {q.eta > 0 ? `ETA ${q.eta}m` : 'ON SITE'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ShortagePanelAct2({ eng }) {
  const { s } = eng
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="hud-label">RESOURCE STATUS</span>
        <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-[#FF003C] animate-[softflash_1.8s_ease-in-out_infinite]">
          CRITICAL SHORTAGE
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SHORTAGE.map((r) => {
          const hex = r.pct === 0 ? '#FF003C' : r.pct < 20 ? '#FF3B63' : r.pct < 30 ? '#FF7A1A' : '#FFB300'
          return (
            <div key={r.id} className="relative rounded border p-2 text-center"
              style={{ borderColor: `${hex}33`, background: `${hex}0A` }}>
              <Corners color={`${hex}55`} />
              <div className="hud-label truncate text-[7.5px]" style={{ color: `${hex}cc` }}>{r.name}</div>
              <div className="my-1.5 grid h-[42px] place-items-center">
                <r.icon size={22} style={{ color: hex }} className={r.pct === 0 ? 'animate-[flash_1.3s_ease-in-out_infinite]' : ''} />
              </div>
              <div className="num text-[16px] font-bold leading-none" style={{ color: hex }}>{r.pct}%</div>
              <div className="num mt-1 text-[8px] text-slate-500">{fmt(r.have)} / {fmt(r.max)}</div>
              <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: hex, boxShadow: `0 0 6px ${hex}` }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between rounded border border-white/[0.07] bg-white/[0.025] px-3 py-2">
        <span className="hud-label">DEPLOYMENT QUEUE</span>
        <span className="flex items-center gap-2">
          <span className="num text-[10px] font-bold text-[#FFD066]">{Math.max(3, s.queue.length)} ACTIVE</span>
          <ChevronDown size={12} className="text-slate-500" />
        </span>
      </div>

      <Divider label="TACTICAL ACTIONS" />
      <div className="grid grid-cols-3 gap-2">
        {TACTICAL.map((t) => {
          const isEvac = t.id === 'evac'
          const cost = isEvac ? EVAC_AP[s.act] : t.ap
          return (
            <button key={t.id} onClick={() => eng.tactical(t.id)} disabled={s.ap < cost}
              title={`${t.name} — ${t.th} · ${fmt(cost)} AP`}
              className={`group relative rounded border p-2 text-center transition disabled:opacity-35
                ${isEvac
                  ? 'border-[#FF003C]/55 bg-[#FF003C]/[0.1] hover:bg-[#FF003C]/20'
                  : 'border-white/[0.08] bg-white/[0.025] hover:border-sky-400/40 hover:bg-white/[0.05]'}`}>
              <div className={`hud-label truncate text-[7.5px] ${isEvac ? 'text-[#FF9DB2]' : ''}`}>{t.name.toUpperCase()}</div>
              <div className="my-1.5 grid h-[40px] place-items-center">
                <t.icon size={22} className={`transition group-hover:scale-110
                  ${isEvac ? 'text-[#FF3B63] animate-[flash_1.8s_ease-in-out_infinite]' : 'text-sky-200/75 group-hover:text-sky-100'}`} />
              </div>
              <div className="num text-[8.5px] text-[#FFD066]">{fmt(cost)} AP</div>
            </button>
          )
        })}
      </div>
      <div className="rounded border border-[#FF003C]/25 bg-[#FF003C]/[0.06] px-2.5 py-2 text-[9px] leading-snug text-[#FFB3C2]">
        The flood is already in the streets. Ordering evacuation now is the <b>late-warning</b> branch:
        −30% trust, once, and the people hit were hit before the order reached them.
        <span className="font-thai block text-slate-500">เตือนช้า เสีย −30% ครั้งเดียว แต่มีผู้ได้รับผลกระทบจริง</span>
      </div>
    </div>
  )
}

function PriorityPanel({ eng }) {
  const { s, sfvi, setPriority } = eng
  const correct = sfvi.ranked.map((c) => c.id)
  const chosen = s.priorities
  const graded = chosen.length === 4
  const hits = graded ? chosen.filter((id, i) => id === correct[i]).length : 0
  return (
    <div className="space-y-2.5">
      <Divider label="TRIAGE · จัดลำดับ 4 ชุมชนเฝ้าระวัง" />
      <div className="text-[9.5px] leading-snug text-slate-400">
        Resources cannot reach all four communities. Click to build the dispatch order.
        Equal SFVI scores are broken by the community with <b className="text-sky-200">fewer remaining exit routes</b>.
      </div>
      <div className="space-y-1.5">
        {sfvi.perCommunity.map((c) => {
          const rank = chosen.indexOf(c.id)
          const on = rank >= 0
          return (
            <button key={c.id} onClick={() => setPriority(c.id)}
              className={`flex w-full items-center gap-2.5 rounded border px-2.5 py-2 text-left transition
                ${on ? 'border-sky-400/45 bg-sky-400/[0.09]' : 'border-white/[0.07] bg-white/[0.02] hover:border-sky-400/30 hover:bg-white/[0.05]'}`}>
              <span className={`num grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[3px] border text-[11px] font-bold
                ${on ? 'border-sky-400 bg-sky-400 text-[#04121F]' : 'border-slate-600 text-slate-500'}`}>
                {on ? rank + 1 : '·'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-white">{c.name}</span>
                <span className="font-thai block truncate text-[8.5px] text-slate-500">{c.th}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="num block text-[10.5px] font-semibold text-sky-200">{c.score.toFixed(3)}</span>
                <span className="num block text-[8px]" style={{ color: c.exits === 1 ? '#FF003C' : '#64748b' }}>
                  {c.exits} EXIT{c.exits > 1 ? 'S' : ''} · {fmt(c.households)} HH
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {graded && (
        <div className="rounded border px-2.5 py-2"
          style={{ borderColor: hits === 4 ? '#00FF4155' : '#FFB30055', background: hits === 4 ? '#00FF410D' : '#FFB3000D' }}>
          <div className="flex items-center gap-2">
            {hits === 4 ? <CheckCircle2 size={13} className="text-[#00FF41]" /> : <AlertTriangle size={13} className="text-[#FFB300]" />}
            <span className="text-[10.5px] font-semibold" style={{ color: hits === 4 ? '#7CFFA0' : '#FFD066' }}>
              {hits} / 4 positions match the decision rule
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-slate-400">
            RULE ORDER: {correct.map((id) => COMMUNITIES.find((c) => c.id === id).name).join(' → ')}
          </div>
          {correct[0] === 'slj' && (
            <div className="mt-1 text-[9px] leading-snug text-slate-400">
              Sai Lom Joy and Koh Sai tie at {sfvi.perCommunity[0].score.toFixed(3)}. Tie-break awards first dispatch to
              Sai Lom Joy — one exit route left; delay and it cannot be evacuated at all.
            </div>
          )}
        </div>
      )}
      <Btn variant="primary" size="lg" icon={Truck} className="w-full" disabled={!graded}
        onClick={() => eng.push('good', 'DISPATCH', `Convoy released in order: ${chosen.map((id) => COMMUNITIES.find((c) => c.id === id).name).join(' → ')}.`, 'ปล่อยขบวนตามลำดับที่กำหนด')}>
        Release Convoy
      </Btn>
    </div>
  )
}

function SituationReport({ eng }) {
  const rows = [
    { label: 'Flooded Areas', value: '12.4 km²', src: 'radar', up: true },
    { label: 'Affected Population', value: '12,860', src: 'scenario', up: true },
    { label: 'Evacuated', value: '3,210', src: 'scenario', up: true },
    { label: 'Missing', value: '57', src: 'scenario', up: true },
    { label: 'Landslide Incidents', value: '4', src: 'image', up: true },
    { label: 'Roads Blocked', value: '11', src: 'scenario', up: true },
  ]
  return (
    <Panel className="shrink-0">
      <PanelHead title="SITUATION REPORT" icon={ClipboardList}
        right={<span className="hud-label">LAST UPDATE: 09:15</span>} />
      <div className="px-3 py-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 border-b border-white/[0.04] py-[6px] last:border-0">
            <span className="text-[#38BDF8]">•</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{r.label}</span>
            <Src t={r.src} mini />
            <span className="num shrink-0 text-[11.5px] font-semibold text-white">{r.value}</span>
            {r.up && <ArrowUp size={11} className="shrink-0 text-[#FF003C]" />}
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 pt-1">
        <Btn variant="ghost" className="w-full" icon={FileText}>View Detailed Report</Btn>
      </div>
    </Panel>
  )
}

function TrustPanel({ eng }) {
  const { s } = eng
  const t = s.trust
  const hex = t >= 75 ? '#00FF41' : t >= 50 ? '#FFB300' : '#FF003C'
  const band = t >= 90 ? 'VERY HIGH' : t >= 75 ? 'HIGH' : t >= 50 ? 'MODERATE' : t >= 30 ? 'LOW' : 'COLLAPSED'
  const prev = s.trustHist[s.trustHist.length - 2] ?? t
  const delta = t - prev
  const dropping = s.act === 2 && delta <= 0
  return (
    <Panel className="shrink-0">
      <PanelHead title="TRUST INDEX" icon={Activity} accent={hex}
        right={dropping
          ? <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-[#FF003C] animate-[softflash_1.6s_ease-in-out_infinite]">DROPPING</span>
          : <Info size={11} className="text-slate-500" />} />
      <div className="group relative px-3 pb-2 pt-3"
        title={`Public trust ${t.toFixed(1)}% — ${band}. False alarms compound −5 / −15 / −40; a late warning costs −30 once.`}>
        {/* Hover explainer — the reason the gauge moved */}
        <div className="pointer-events-none absolute inset-x-3 top-2 z-30 rounded-md border border-white/15 bg-[#070D1C]/96 p-2.5 opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100">
          <div className="font-mono text-[9px] font-bold tracking-[0.12em]" style={{ color: hex }}>
            TRUST {t.toFixed(1)}% · {band}
          </div>
          <div className="mt-1.5 space-y-1">
            {[
              ['False alarms issued', s.falseAlarms, s.falseAlarms ? '#FF6B8A' : '#7CFFA0'],
              ['Next false-alarm cost', `−${[5, 15, 40][Math.min(s.falseAlarms, 2)]}%`, '#FF6B8A'],
              ['Late-warning cost', '−30% (once)', '#FF6B8A'],
              ['Hold decisions', s.holdCount, '#FFD066'],
            ].map(([k, v, c]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-[9px] text-slate-400">{k}</span>
                <span className="num text-[9.5px] font-semibold" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="font-thai mt-1.5 border-t border-white/10 pt-1.5 text-[8.5px] leading-snug text-slate-500">
            เตือนผิดซ้ำ ๆ ทำให้ประชาชนไม่อพยพตามคำสั่งในครั้งถัดไป
          </div>
        </div>

        <ArcGauge value={t} color={hex} label={band} size={148}
          delta={`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`} deltaDir={delta >= 0 ? 'up' : 'down'} />
        <div className="-mt-1 text-center font-mono text-[8.5px] tracking-[0.1em] text-slate-500">vs last update</div>
        <div className="mt-1.5">
          <Spark data={s.trustHist} color={hex} h={44} dots={s.trustHist.length < 14} />
        </div>
        <div className="mt-1 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[8.5px] leading-snug text-slate-500">
          False alarms compound: <b className="text-[#FF6B8A]">−5 / −15 / −40</b>. A late warning costs
          <b className="text-[#FF6B8A]"> −30</b> once — but real people are hit. There is no always-winning strategy.
        </div>
      </div>
    </Panel>
  )
}

function CommandInterface({ eng, setView }) {
  const { s } = eng
  const tabs = s.act === 1
    ? [['overview', 'OVERVIEW'], ['resources', 'RESOURCES'], ['tasking', 'OPERATIONS'], ['intel', 'INTELLIGENCE']]
    : [['overview', 'OVERVIEW'], ['resources', 'RESOURCES'], ['ops', 'OPERATIONS'], ['intel', 'INTEL'], ['log', 'LOGISTICS']]
  const [tab, setTab] = useState('overview')
  useEffect(() => { setTab('overview') }, [s.act])

  return (
    <Panel className="flex min-h-[340px] flex-1 shrink-0 flex-col">
      <PanelHead title="COMMAND INTERFACE" icon={Target}
        right={<button className="text-slate-500 hover:text-white"><X size={11} /></button>} />
      <div className="flex shrink-0 gap-[3px] border-b border-white/[0.07] px-2 pt-2">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 rounded-t px-2 py-1.5 font-mono text-[8.5px] font-semibold tracking-[0.1em] transition
              ${tab === id
                ? s.act === 2
                  ? 'bg-[#FF003C]/18 text-[#FF6B8A] shadow-[inset_0_-2px_0_#FF003C]'
                  : 'bg-sky-400/18 text-sky-100 shadow-[inset_0_-2px_0_#38BDF8]'
                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* ── ACT 1 ─────────────────────────────────────────────────────── */}
        {s.act === 1 && tab === 'overview' && (
          <div className="space-y-3">
            <ResourcePanelAct1 eng={eng} />
          </div>
        )}
        {s.act === 1 && tab === 'resources' && <ResourcePanelAct1 eng={eng} />}
        {s.act === 1 && tab === 'tasking' && (
          <div className="space-y-3">
            <TaskingPanel eng={eng} setView={setView} />
            <DecisionBlock eng={eng} />
          </div>
        )}
        {s.act === 1 && tab === 'intel' && (
          <div className="space-y-3">
            <SfviPanel eng={eng} />
            <Divider label="RESOLUTION PROOF · ข้อพิสูจน์เชิงตัวเลข" />
            <ResolutionProof compact />
          </div>
        )}

        {/* ── ACT 2 ─────────────────────────────────────────────────────── */}
        {s.act === 2 && tab === 'overview' && (
          <div className="space-y-3">
            <ShortagePanelAct2 eng={eng} />
          </div>
        )}
        {s.act === 2 && tab === 'resources' && (
          <div className="space-y-3">
            <ShortagePanelAct2 eng={eng} />
            <Divider label="EMERGENCY REQUISITION" />
            {SHORTAGE.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <r.icon size={13} className="shrink-0 text-sky-300" />
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-300">{r.name}</span>
                <Btn size="sm" variant="warn" onClick={() => eng.push('warn', 'REQUISITION', `Emergency resupply requested: ${r.name}. Provincial depot ETA 4 h 20 m.`, null)}>
                  Request
                </Btn>
              </div>
            ))}
          </div>
        )}
        {s.act === 2 && tab === 'ops' && <PriorityPanel eng={eng} />}
        {s.act === 2 && tab === 'intel' && (
          <div className="space-y-3">
            <div className="rounded border border-[#A78BFA]/30 bg-[#A78BFA]/[0.07] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Radar size={13} className="text-[#A78BFA]" />
                <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#C4B5FD]">SENSOR HANDOVER</span>
              </div>
              <div className="mt-1.5 text-[9.5px] leading-snug text-slate-300">
                Optical is blind: 100% cloud over the catchment. THEOS-2 is <b>not</b> used in this phase — matching
                GISTDA's own practice of flying RADARSAT-2 during the 10 &amp; 12 Sep 2024 event.
              </div>
            </div>
            <SfviPanel eng={eng} />
          </div>
        )}
        {s.act === 2 && tab === 'log' && (
          <div className="space-y-3">
            <Divider label="ROUTING · SPHERE API" />
            <div className="rounded border border-white/[0.07] bg-white/[0.02] p-2.5">
              {[
                ['Mountain Route 7', eng.s.detourSolved ? 'DETOURED' : 'SEVERED', eng.s.detourSolved ? '#FFB300' : '#FF003C'],
                ['Route 1290', 'OPEN', '#00FF41'],
                ['Border Crossing Rd', 'CONGESTED', '#FFB300'],
                ['Ban Pa Sang Link', eng.s.detourSolved ? 'ACTIVE DETOUR' : 'STANDBY', eng.s.detourSolved ? '#00FF41' : '#64748b'],
              ].map(([n, st, hex]) => (
                <div key={n} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0">
                  <span className="text-[10.5px] text-slate-300">{n}</span>
                  <span className="num text-[9.5px] font-bold" style={{ color: hex }}>{st}</span>
                </div>
              ))}
            </div>
            <Btn variant="primary" className="w-full" icon={Route} onClick={eng.solveDetour} disabled={eng.s.detourSolved}>
              {eng.s.detourSolved ? 'Detour Applied' : 'Compute Detour · 500 AP'}
            </Btn>
            <Divider label="CONVOY QUEUE" />
            {(eng.s.queue.length ? eng.s.queue : [
              { id: 'q1', name: 'Rescue Boat Section', qty: 1, eta: 62 },
              { id: 'q2', name: 'Medical Team Bravo', qty: 1, eta: 38 },
              { id: 'q3', name: 'Fuel Bowser', qty: 1, eta: 145 },
            ]).map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                <Truck size={11} className="shrink-0 text-sky-300" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{q.name}</span>
                <span className="num shrink-0 text-[9.5px] text-[#FFD066]">ETA {q.eta}m</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

function ResolutionProof({ compact = false }) {
  const data = RES_PROOF.map((r) => ({ name: r.width, 'Sentinel-2 10 m': r.s2, 'THEOS-2 MS 2 m': r.ms, 'THEOS-2 Pan 0.5 m': r.pan }))
  return (
    <div className="space-y-2">
      <div style={{ height: compact ? 130 : 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#7d93b2', fontSize: 9, fontFamily: 'monospace' }} axisLine={{ stroke: 'rgba(148,163,184,.2)' }} tickLine={false} />
            <YAxis tick={{ fill: '#7d93b2', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#7dd3fc' }} formatter={(v) => `${v}% pure pixels`} />
            <Bar dataKey="Sentinel-2 10 m" fill="#FF003C" radius={[2, 2, 0, 0]} />
            <Bar dataKey="THEOS-2 MS 2 m" fill="#FFB300" radius={[2, 2, 0, 0]} />
            <Bar dataKey="THEOS-2 Pan 0.5 m" fill="#00FF41" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {[['Sentinel-2 10 m', '#FF003C'], ['THEOS-2 MS 2 m', '#FFB300'], ['THEOS-2 Pan 0.5 m', '#00FF41']].map(([n, c]) => (
          <span key={n} className="flex items-center gap-1.5 font-mono text-[8.5px] text-slate-400">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: c }} />{n}
          </span>
        ))}
      </div>
      <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[9px] leading-snug text-slate-400">
        Pure-pixel fraction across a linear feature = <span className="num text-sky-200">(w − 2p) / w</span>, where w is scar
        width and p the ground sample distance. A 20 m scar at 10 m GSD leaves <b className="text-[#FF6B8A]">0%</b> pure pixels:
        detectable by contrast, but its width cannot be measured or tracked — which is exactly what this mission needs.
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   11 · ACT 1 & ACT 2 SHELL
   ══════════════════════════════════════════════════════════════════════════ */

function CommandShell({ eng }) {
  const { s } = eng
  const [view, setView] = useState('corridor')
  useEffect(() => { if (s.act === 2) setView('corridor') }, [s.act])

  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3"
      style={{ gridTemplateColumns: 'minmax(214px,246px) minmax(0,1fr) minmax(300px,352px)' }}>
      {/* LEFT */}
      <div className="flex min-h-0 flex-col gap-3">
        <LayersPanel eng={eng} />
        <MiniMap eng={eng} className="mt-auto" />
      </div>

      {/* CENTER — the map keeps a legible floor height; on short viewports the
          column scrolls rather than crushing the canvas. */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
        <div className="min-h-[320px] flex-1">
          <MapCanvas key={`${s.act}-${s.resetSeq}`} eng={eng} view={view} setView={setView} />
        </div>
        <CriticalBanner eng={eng} />
        {s.act === 1 && <WeatherBar eng={eng} />}
        <AlertLog eng={eng} height={s.act === 1 ? 138 : 172} />
      </div>

      {/* RIGHT — scrolls as a column so short viewports never crush the
          Command Interface; min-h keeps it usable before the column scrolls. */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
        <CommandInterface eng={eng} setView={setView} />
        <TrustPanel eng={eng} />
        {s.act === 2 && <SituationReport eng={eng} />}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   12 · ACT 3 · AFTER ACTION REVIEW
   ══════════════════════════════════════════════════════════════════════════ */

function ChangeSlider() {
  const [pos, setPos] = useState(50)
  const [detect, setDetect] = useState(false)
  const box = useRef(null)
  const drag = useRef(false)
  const terrain = useTerrain()

  const move = useCallback((clientX) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setPos(clamp(((clientX - r.left) / r.width) * 100, 2, 98))
  }, [])

  useEffect(() => {
    const mm = (e) => drag.current && move(e.clientX ?? e.touches?.[0]?.clientX)
    const mu = () => { drag.current = false }
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [move])

  return (
    <div ref={box} className="relative h-full w-full select-none overflow-hidden rounded-lg border border-sky-400/15 bg-[#04070E]"
      onPointerDown={(e) => { drag.current = true; move(e.clientX) }}>
      {/* AFTER (full width, underneath) */}
      <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <TerrainDefs />
        <OpticalScene terrain={terrain} mud damaged />
      </svg>
      {/* BEFORE (clipped to slider position) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full"
          style={{ width: `${(100 / pos) * 100}%` }}>
          <TerrainDefs />
          <OpticalScene terrain={terrain} />
        </svg>
      </div>

      {/* Change-detection overlay */}
      {detect && (
        <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
          <path d={terrain.riverPath} stroke="#FF003C" strokeWidth="62" fill="none" opacity="0.16" strokeLinecap="round" />
          <path d={terrain.riverPath} stroke="#FF003C" strokeWidth="1.6" fill="none" strokeDasharray="9 6" opacity="0.9" />
          {terrain.gaps.map((g, i) => (
            <g key={i}>
              <rect x={g.x - 16} y={g.y - 12} width="32" height="24" fill="none" stroke="#FF003C" strokeWidth="1.1" opacity="0.85" />
              <text x={g.x + 19} y={g.y + 3} fontSize="7" fill="#FF6B8A" className="font-mono">CHG {String(i + 1).padStart(2, '0')}</text>
            </g>
          ))}
        </svg>
      )}

      {/* Labels */}
      <div className="pointer-events-none absolute left-4 top-4">
        <div className="font-mono text-[22px] font-bold tracking-[0.09em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">BEFORE</div>
        <div className="num mt-0.5 text-[11px] tracking-[0.12em] text-slate-300 drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">28 APR 2025</div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 text-right">
        <div className="font-mono text-[22px] font-bold tracking-[0.09em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">AFTER</div>
        <div className="num mt-0.5 text-[11px] tracking-[0.12em] text-slate-300 drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">07 MAY 2025</div>
      </div>

      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setDetect((d) => !d)}
        className={`btn absolute right-4 top-[70px] px-3 py-1.5 ${detect
          ? 'border-[#FF003C]/60 bg-[#FF003C]/20 text-[#FF6B8A]' : 'border-sky-400/30 bg-[#070D1C]/85 text-sky-200 backdrop-blur'}`}>
        <span className="flex items-center gap-1.5"><ScanLine size={11} /> CHANGE DETECTION</span>
      </button>

      {/* Divider + handle */}
      <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white/85" style={{ left: `${pos}%`, boxShadow: '0 0 14px rgba(255,255,255,.7)' }} />
      <div className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white/85 bg-[#0B132B]/90 backdrop-blur"
        style={{ left: `${pos}%`, boxShadow: '0 0 22px rgba(255,255,255,.45)' }}
        onPointerDown={(e) => { e.stopPropagation(); drag.current = true }}>
        <div className="flex items-center gap-[3px] text-white">
          <ChevronRight size={12} className="rotate-180" /><ChevronRight size={12} />
        </div>
      </div>
    </div>
  )
}

function AarStatStrip() {
  return (
    <Panel className="shrink-0">
      <div className="flex divide-x divide-white/[0.07]">
        {DAMAGE_STATS.map((d) => (
          <div key={d.name} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
            <d.icon size={19} className="shrink-0 text-sky-300/70" />
            <div className="min-w-0">
              <div className="hud-label truncate">{d.name}</div>
              <div className="num mt-1 text-[15px] font-bold leading-none text-white">{d.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function OperationTimeline() {
  const data = DECISION_SPEED.map((d, i) => ({ ...d, idx: i, label: AAR_TIMELINE[i].ts }))
  return (
    <Panel className="flex shrink-0 flex-col">
      <PanelHead title="OPERATION TIMELINE & DECISION SPEED" icon={Clock} />
      {/* Milestone rail */}
      <div className="flex gap-1 overflow-x-auto px-3 pt-3">
        {AAR_TIMELINE.map((m) => (
          <div key={m.key} className="flex min-w-[118px] flex-1 items-center gap-2 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border"
              style={{ borderColor: `${m.hex}66`, background: `${m.hex}18` }}>
              <m.icon size={11} style={{ color: m.hex }} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-[7.5px] font-bold tracking-[0.08em]" style={{ color: m.hex }}>{m.key}</span>
              <span className="num block text-[8px] text-slate-500">{m.ts}</span>
            </span>
          </div>
        ))}
      </div>
      {/* Speed chart */}
      <div className="h-[168px] px-2 pb-2 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 18, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="rgba(148,163,184,.09)" />
            <XAxis dataKey="idx" hide />
            <YAxis domain={[0, 120]} ticks={[0, 30, 60, 90, 120]} width={34}
              tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <ReferenceLine y={60} stroke="#00FF41" strokeDasharray="6 5" strokeOpacity={0.65}
              label={{ value: 'Target: < 60 Minutes', position: 'insideBottomLeft', fill: '#7CFFA0', fontSize: 9, fontFamily: 'monospace', dy: 14 }} />
            <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }}
              labelFormatter={(i) => DECISION_SPEED[i]?.phase} formatter={(v) => [`${v} min`, 'Decision time']} />
            <Line type="linear" dataKey="min" stroke="#38BDF8" strokeWidth={1.6} strokeDasharray="6 4"
              dot={(p) => (
                <g key={p.index}>
                  <circle cx={p.cx} cy={p.cy} r="7" fill={DECISION_SPEED[p.index].hex} fillOpacity="0.2" />
                  <circle cx={p.cx} cy={p.cy} r="4.2" fill={DECISION_SPEED[p.index].hex}
                    style={{ filter: `drop-shadow(0 0 6px ${DECISION_SPEED[p.index].hex})` }} />
                  <text x={p.cx} y={p.cy - 12} textAnchor="middle" fontSize="10.5" fontWeight="700"
                    fill={DECISION_SPEED[p.index].hex} fontFamily="monospace">{DECISION_SPEED[p.index].min}</text>
                </g>
              )}
              activeDot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-1.5">
        <span className="hud-label">Decision Speed (Minutes)</span>
        <span className="flex items-center gap-2 font-mono text-[8.5px] text-slate-500">
          <Src t="scenario" mini /> peak flood decision breached target by 36 min
        </span>
      </div>
    </Panel>
  )
}

/* ── Relief adjudication (DECISIONS tab) ────────────────────────────────── */
function evaluate(roof, verdict) {
  const eFlat = roof.truth.flat, eMud = roof.truth.mud
  if (verdict === 'reject') return eFlat ? 'denial' : 'correct'
  if (verdict === 'flat') return eFlat ? (eMud ? 'under' : 'correct') : 'overpay'
  if (verdict === 'both') return eFlat && eMud ? 'correct' : 'overpay'
  return 'pending'
}

function AdjudicationTable({ eng }) {
  const { s, adjudicate, survey } = eng
  const results = ROOFS.map((r) => ({ r, v: s.adjudged[r.id], out: s.adjudged[r.id] ? evaluate(r, s.adjudged[r.id]) : 'pending' }))
  const done = results.filter((x) => x.v)
  const tally = {
    correct: done.filter((x) => x.out === 'correct').length,
    overpay: done.filter((x) => x.out === 'overpay').length,
    denial: done.filter((x) => x.out === 'denial').length,
    under: done.filter((x) => x.out === 'under').length,
  }
  const budget = done.reduce((sum, x) =>
    sum + (x.v === 'flat' ? FLAT_GRANT : x.v === 'both' ? FLAT_GRANT + MUD_GRANT : 0), 0)
    + s.surveyed.length * SURVEY_COST

  const mudLabel = { clear: 'MUD CONFIRMED', partial: 'PARTIAL / OBSCURED', none: 'NO MUD SIGNATURE' }
  const mudHex = { clear: '#FF7A1A', partial: '#FFB300', none: '#64748b' }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-5 gap-2">
        {[
          ['ADJUDICATED', `${done.length} / ${ROOFS.length}`, '#38BDF8'],
          ['CORRECT', tally.correct, '#00FF41'],
          ['OVER-PAYMENT', tally.overpay, '#FFB300'],
          ['WRONGFUL DENIAL', tally.denial, '#FF003C'],
          ['BUDGET COMMITTED', baht(budget), '#7dd3fc'],
        ].map(([l, v, hex]) => (
          <div key={l} className="relative rounded border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
            <Corners color={`${hex}44`} />
            <div className="hud-label truncate">{l}</div>
            <div className="num mt-1.5 text-[16px] font-bold leading-none" style={{ color: hex }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[10px] leading-snug text-slate-400">
        Evidence: standing-water duration from the RADARSAT-2 time series, mud deposition from THEOS-2 Pan 0.5 m
        before/after pairs. Eligibility follows the Cabinet resolution of 17 Sep 2024 — flat {baht(FLAT_GRANT)} per household
        at ≥ {INUNDATION_MIN} days inundation, plus {baht(MUD_GRANT)} per roof for mud clearing.
        <span className="ml-1 text-slate-500">Where evidence is insufficient you must choose: dispatch a ground survey (accurate but slow), approve anyway (risk over-payment), or reject (risk a wrongful denial).</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-white/[0.07]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0A1120]">
            <tr className="border-b border-white/10">
              {['ROOF ID', 'COMMUNITY', 'INUNDATION', 'MUD SIGNATURE', 'CONF.', 'DECISION', 'RESULT'].map((h) => (
                <th key={h} className="hud-label px-2.5 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map(({ r, v, out }) => {
              const revealed = s.surveyed.includes(r.id)
              const insufficient = r.days === null || r.conf < 0.55
              const outHex = { correct: '#00FF41', overpay: '#FFB300', denial: '#FF003C', under: '#FF7A1A', pending: '#64748b' }[out]
              return (
                <tr key={r.id} className="border-b border-white/[0.05] transition hover:bg-white/[0.025]">
                  <td className="num px-2.5 py-2 text-[10.5px] text-white">{r.id}</td>
                  <td className="px-2.5 py-2 text-[10.5px] text-slate-300">{r.com}</td>
                  <td className="px-2.5 py-2">
                    {r.days === null
                      ? <span className="font-mono text-[9.5px] text-[#FF003C]">NO RADAR PASS</span>
                      : <span className="num text-[10.5px]" style={{ color: r.days >= INUNDATION_MIN ? '#7CFFA0' : '#94a3b8' }}>
                        {r.days} days {r.days >= INUNDATION_MIN ? '✓' : ''}
                      </span>}
                    <Src t="radar" mini />
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="font-mono text-[9.5px]" style={{ color: mudHex[r.mud] }}>{mudLabel[r.mud]}</span>
                    <span className="ml-1"><Src t="image" mini /></span>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="num text-[10px]" style={{ color: r.conf >= 0.7 ? '#7CFFA0' : r.conf >= 0.5 ? '#FFD066' : '#FF6B8A' }}>
                      {Math.round(r.conf * 100)}%
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => adjudicate(r.id, 'flat')}
                        className={`btn px-1.5 py-1 ${v === 'flat' ? 'border-[#00FF41]/60 bg-[#00FF41]/18 text-[#7CFFA0]' : 'border-white/12 bg-white/[0.04] text-slate-400 hover:text-white'}`}>
                        ฿9,000
                      </button>
                      <button onClick={() => adjudicate(r.id, 'both')}
                        className={`btn px-1.5 py-1 ${v === 'both' ? 'border-[#FFB300]/60 bg-[#FFB300]/18 text-[#FFD066]' : 'border-white/12 bg-white/[0.04] text-slate-400 hover:text-white'}`}>
                        +฿10,000
                      </button>
                      <button onClick={() => adjudicate(r.id, 'reject')}
                        className={`btn px-1.5 py-1 ${v === 'reject' ? 'border-[#FF003C]/60 bg-[#FF003C]/18 text-[#FF6B8A]' : 'border-white/12 bg-white/[0.04] text-slate-400 hover:text-white'}`}>
                        Reject
                      </button>
                      {insufficient && (
                        <button onClick={() => survey(r.id)} disabled={revealed}
                          className={`btn px-1.5 py-1 ${revealed ? 'border-sky-400/50 bg-sky-400/15 text-sky-200' : 'border-sky-400/30 bg-sky-400/[0.06] text-sky-300 hover:bg-sky-400/15'}`}>
                          {revealed ? 'Surveyed' : 'Survey'}
                        </button>
                      )}
                    </div>
                    {revealed && (
                      <div className="mt-1 font-mono text-[8.5px] text-sky-300/80">
                        FIELD: flat {r.truth.flat ? 'ELIGIBLE' : 'NOT ELIGIBLE'} · mud {r.truth.mud ? 'PRESENT' : 'ABSENT'}
                      </div>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="num text-[9.5px] font-bold uppercase" style={{ color: outHex }}>
                      {out === 'pending' ? '—' : out === 'under' ? 'UNDER-PAID' : out}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {done.length === ROOFS.length && (
        <div className="shrink-0 rounded border border-sky-400/30 bg-sky-400/[0.07] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 size={13} className="text-sky-300" />
            <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-sky-200">ADJUDICATION ERROR MATRIX · ตารางความผิดพลาด</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[
              ['Correct', tally.correct, '#00FF41', 'Evidence and verdict agree'],
              ['Over-payment', tally.overpay, '#FFB300', 'Public funds paid without entitlement'],
              ['Wrongful denial', tally.denial, '#FF003C', 'Entitled household turned away'],
              ['Under-payment', tally.under, '#FF7A1A', 'Mud top-up missed'],
            ].map(([l, v, hex, note]) => (
              <div key={l} className="rounded border px-2 py-1.5" style={{ borderColor: `${hex}33`, background: `${hex}0C` }}>
                <div className="num text-[18px] font-bold leading-none" style={{ color: hex }}>{v}</div>
                <div className="mt-1 text-[9px] font-semibold text-slate-300">{l}</div>
                <div className="text-[8px] leading-tight text-slate-500">{note}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9.5px] leading-snug text-slate-400">
            Total committed <b className="num text-sky-200">{baht(budget)}</b> across {done.length} roofs,
            including {s.surveyed.length} ground survey{s.surveyed.length === 1 ? '' : 's'} at {baht(SURVEY_COST)} each.
            Evidence resolution — not policy — decided who was paid.
          </div>
        </div>
      )}
    </div>
  )
}

function AarTabs({ tab, setTab }) {
  const items = [
    ['summary', 'SUMMARY'], ['operations', 'OPERATIONS'], ['decisions', 'DECISIONS'],
    ['impact', 'IMPACT'], ['lessons', 'LESSONS LEARNED'], ['report', 'REPORT'],
  ]
  return (
    <div className="flex shrink-0 gap-1">
      {items.map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)}
          className={`clip-tab flex-1 px-4 py-2.5 font-mono text-[10px] font-semibold tracking-[0.13em] transition
            ${tab === id
              ? 'bg-gradient-to-b from-sky-400/25 to-sky-400/[0.08] text-white shadow-[inset_0_-2px_0_#38BDF8]'
              : 'bg-white/[0.03] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function AarLeftColumn({ eng }) {
  const rows = [
    { icon: Clock, label: 'Operation Duration', value: '7 Days', src: 'scenario' },
    { icon: Waves, label: 'Event Type', value: 'Severe Flood & Landslide', src: 'scenario' },
    { icon: Users, label: 'Affected Area', value: '12.4 km²', src: 'radar' },
    { icon: Users, label: 'Population Affected', value: '23,860', src: 'scenario' },
    { icon: Boxes, label: 'Resources Deployed', value: '1,268', src: 'scenario' },
    { icon: Wrench, label: 'Total Cost', value: '฿ 34,780,000', src: 'scenario' },
  ]
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <Panel className="shrink-0">
        <PanelHead title="OPERATION SUMMARY" icon={ClipboardList} />
        <div className="px-3 py-1.5">
          {rows.map((r) => <StatLine key={r.label} {...r} />)}
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="MISSION SUCCESS RATE" icon={Target} />
        <div className="px-3 pb-3 pt-4">
          <ArcGauge value={86} color="#38BDF8" label="SUCCESSFUL" size={168} delta="18% vs Plan" deltaDir="up" />
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="FINAL TRUST INDEX" icon={Activity} accent="#FF7A1A" />
        <div className="px-3 pb-2 pt-4">
          <ArcGauge value={eng.s.trust} color="#FF7A1A" label="HIGH" sub="Final Score" size={168}
            delta="14% vs Pre-Event" deltaDir="up" />
        </div>
        <div className="px-3 pb-3">
          <div className="flex justify-between font-mono text-[8px] text-slate-500"><span>100%</span></div>
          <Spark data={[22, 26, 34, 33, 42, 48, 55, 63, 72, 88, 96]} color="#38BDF8" h={92} dots fill={false} />
          <div className="flex justify-between font-mono text-[8px] text-slate-500"><span>0%</span></div>
        </div>
      </Panel>
    </div>
  )
}

function AarRightColumn({ eng, setTab }) {
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pl-1">
      <Panel className="shrink-0">
        <PanelHead title="IMPACT OVERVIEW" icon={AlertTriangle} accent="#FF7A1A" />
        <div className="px-3 py-1.5">
          {IMPACT_OVERVIEW.map((i) => <StatLine key={i.name} icon={i.icon} label={i.name} value={i.value} src={i.src} />)}
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="RESOURCE UTILIZATION" icon={Boxes} />
        <div className="px-3 py-1">
          {UTILISATION.map((u) => <MeterRow key={u.name} {...u} />)}
        </div>
        <div className="px-3 pb-3 pt-1">
          <Btn variant="ghost" className="w-full" icon={FileText} onClick={() => setTab('operations')}>View Resource Report</Btn>
        </div>
      </Panel>

      {/* Relief budget — the rates that decide who gets paid, per Cabinet 17 Sep 2024 */}
      <Panel className="shrink-0" glow="#00FF41">
        <PanelHead title="RELIEF BUDGET · งบเยียวยา" icon={Building2} accent="#7CFFA0"
          right={<Src t="scenario" mini />} />
        <div className="px-3 py-2">
          {(() => {
            const done = ROOFS.filter((r) => eng.s.adjudged[r.id])
            const flats = done.filter((r) => eng.s.adjudged[r.id] === 'flat' || eng.s.adjudged[r.id] === 'both').length
            const muds = done.filter((r) => eng.s.adjudged[r.id] === 'both').length
            const surveys = eng.s.surveyed.length
            const total = flats * FLAT_GRANT + muds * MUD_GRANT + surveys * SURVEY_COST
            const rows = [
              { n: 'Flat grant per household', th: 'เหมาจ่ายครัวเรือนละ', rate: FLAT_GRANT, qty: flats, hex: '#00FF41' },
              { n: 'Mud-clearing top-up per roof', th: 'ค่าล้างโคลนต่อหลัง', rate: MUD_GRANT, qty: muds, hex: '#FFB300' },
              { n: 'Ground survey dispatch', th: 'ส่งสำรวจภาคพื้น', rate: SURVEY_COST, qty: surveys, hex: '#38BDF8' },
            ]
            return (
              <>
                {rows.map((r) => (
                  <div key={r.n} className="border-b border-white/[0.05] py-[7px] last:border-0"
                    title={`${r.th} — ${baht(r.rate)} × ${r.qty}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-300">{r.n}</span>
                      <span className="num shrink-0 text-[11.5px] font-bold" style={{ color: r.hex }}>{baht(r.rate)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="font-thai text-[9px] text-slate-500">{r.th}</span>
                      <span className="num text-[9px] text-slate-400">× {r.qty} = {baht(r.rate * r.qty)}</span>
                    </div>
                  </div>
                ))}
                <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-[#7CFFA0]">COMMITTED</span>
                  <span className="num text-[14px] font-bold text-white">{baht(total)}</span>
                </div>
                <div className="mt-1 text-[8.5px] leading-snug text-slate-500">
                  {done.length} of {ROOFS.length} roofs adjudicated. Rates per Cabinet resolution 17 Sep 2024;
                  eligibility needs ≥ {INUNDATION_MIN} days of standing water from the radar time series.
                </div>
                <Btn variant="go" size="sm" className="mt-2 w-full" icon={ClipboardList} onClick={() => setTab('decisions')}>
                  Open Roof-by-Roof Adjudication
                </Btn>
              </>
            )
          })()}
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="COST SUMMARY" icon={Wrench} />
        <div className="px-3 py-1.5">
          {COST_SUMMARY.map((c) => (
            <div key={c.name} className="flex items-center justify-between border-b border-white/[0.04] py-[7px]">
              <span className="flex items-center gap-2 text-[11px] text-slate-300">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: c.hex }} />{c.name}
              </span>
              <span className="num text-[11.5px] text-white">{baht(c.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2.5">
            <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-sky-200">TOTAL COST</span>
            <span className="num text-[14px] font-bold text-white">{baht(34_780_000)}</span>
          </div>
          <div className="pb-2 pt-1 text-right"><Src t="scenario" mini /></div>
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="TOP 3 LESSONS LEARNED" icon={ScrollText} />
        <div className="space-y-2 px-3 py-2.5">
          {LESSONS.slice(0, 3).map((l) => (
            <div key={l.n} className="flex gap-2.5">
              <span className="num grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-sky-400/45 bg-sky-400/12 text-[11px] font-bold text-sky-200">
                {l.n}
              </span>
              <span className="text-[10.5px] leading-snug text-slate-300">{l.txt}</span>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3">
          <Btn variant="ghost" className="w-full" icon={ScrollText} onClick={() => setTab('lessons')}>View Full Lessons Learned</Btn>
        </div>
      </Panel>
    </div>
  )
}

function AarShell({ eng }) {
  const [tab, setTab] = useState('summary')

  const exportCSV = useCallback(() => {
    const rows = [
      ['THEOS-2 MAE SAI COMMAND — SESSION EXPORT'],
      ['Generated', new Date().toISOString()],
      [],
      ['SECTION', 'KEY', 'VALUE', 'PROVENANCE'],
      ['STATE', 'Final trust index', `${eng.s.trust.toFixed(1)}%`, 'SCENARIO'],
      ['STATE', 'Action points remaining', eng.s.ap, 'SCENARIO'],
      ['STATE', 'Data coins remaining', eng.s.coins, 'SCENARIO'],
      ['STATE', 'Swaths tasked', eng.s.tasked.join(' ') || 'none', 'IMAGE'],
      ['STATE', 'Scars detected', eng.sfvi.scarsSeen, 'IMAGE'],
      ['STATE', 'Channel width (m)', eng.s.channelWidth, 'IMAGE'],
      ['STATE', 'False alarms', eng.s.falseAlarms, 'SCENARIO'],
      ['STATE', 'Hold decisions', eng.s.holdCount, 'SCENARIO'],
      ['SFVI', 'W', eng.sfvi.W.toFixed(4), 'MEASURED'],
      ['SFVI', 'R', eng.sfvi.R.toFixed(4), 'MEASURED'],
      ['SFVI', 'L', eng.sfvi.L.toFixed(4), 'IMAGE'],
      ['SFVI', 'N', eng.sfvi.N.toFixed(4), 'IMAGE'],
      ['SFVI', 'P', eng.sfvi.P.toFixed(4), 'SCENARIO'],
      ['SFVI', 'Basin score', eng.sfvi.basin.toFixed(4), 'DERIVED'],
      [],
      ['ROOF ID', 'COMMUNITY', 'INUNDATION DAYS', 'MUD', 'VERDICT', 'OUTCOME'],
      ...ROOFS.map((r) => [r.id, r.com, r.days ?? 'NO PASS', r.mud,
        eng.s.adjudged[r.id] ?? 'pending', eng.s.adjudged[r.id] ? evaluate(r, eng.s.adjudged[r.id]) : 'pending']),
      [],
      ['DECISION LOG', 'CLOCK', 'WATER (m)', 'SFVI'],
      ...eng.s.decisions.map((d) => [d.kind, clockLabel(d.clock), d.water.toFixed(2), d.sfvi.toFixed(3)]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `maesai-command-aar-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    eng.push('good', 'EXPORT', 'After Action Review exported as CSV — teacher mode class log.', 'ส่งออกบันทึกการใช้งานเป็นไฟล์ CSV')
  }, [eng])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      {/* AAR sub-header */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex flex-1 items-center gap-3">
          <AarTabs tab={tab} setTab={setTab} />
        </div>
        <div className="flex shrink-0 items-center gap-2.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <Clock size={13} className="text-sky-300/70" />
          <div className="leading-none">
            <div className="hud-label">REVIEW DATE</div>
            <div className="num mt-1 text-[11.5px] font-semibold text-white">07 MAY 2025 &nbsp;14:30</div>
          </div>
        </div>
        <Btn variant="primary" size="lg" icon={Download} onClick={exportCSV}>Export Report</Btn>
      </div>

      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: 'minmax(232px,268px) minmax(0,1fr) minmax(272px,326px)' }}>
        <AarLeftColumn eng={eng} />

        {/* CENTER — tab content */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
          {tab === 'summary' && (
            <>
              <div className="min-h-[340px] flex-1"><ChangeSlider /></div>
              <AarStatStrip />
              <OperationTimeline />
            </>
          )}

          {tab === 'operations' && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <Panel>
                <PanelHead title="RESOURCE UTILIZATION DETAIL" icon={Boxes} />
                <div className="h-[220px] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={UTILISATION} layout="vertical" margin={{ top: 4, right: 30, left: 26, bottom: 4 }}>
                      <CartesianGrid stroke="rgba(148,163,184,.09)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fill: '#9fb6d4', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="pct" radius={[0, 3, 3, 0]} barSize={16}>
                        {UTILISATION.map((u, i) => <Cell key={i} fill={u.pct >= 70 ? '#38BDF8' : u.pct >= 60 ? '#22D3EE' : '#FFB300'} />)}
                        <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`}
                          style={{ fill: '#cbd5e1', fontSize: 10, fontFamily: 'monospace' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel>
                <PanelHead title="OPERATION TIMELINE — FULL LOG" icon={Clock} />
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['MILESTONE', 'TIMESTAMP', 'DECISION TIME', 'VS TARGET', 'PROVENANCE'].map((h) =>
                        <th key={h} className="hud-label px-3 py-2 text-left">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {AAR_TIMELINE.map((m, i) => {
                      const d = DECISION_SPEED[i]
                      const over = d.min > 60
                      return (
                        <tr key={m.key} className="border-b border-white/[0.05] hover:bg-white/[0.025]">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2 text-[11px] text-slate-200">
                              <m.icon size={12} style={{ color: m.hex }} />{m.key}
                            </span>
                          </td>
                          <td className="num px-3 py-2 text-[10.5px] text-slate-300">{m.ts}</td>
                          <td className="num px-3 py-2 text-[11px] font-semibold" style={{ color: d.hex }}>{d.min} min</td>
                          <td className="num px-3 py-2 text-[10.5px]" style={{ color: over ? '#FF003C' : '#00FF41' }}>
                            {over ? `+${d.min - 60} OVER` : `−${60 - d.min} UNDER`}
                          </td>
                          <td className="px-3 py-2"><Src t="scenario" mini /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Panel>

              <Panel>
                <PanelHead title="SENSOR TASKING RECORD" icon={Satellite} />
                <div className="grid grid-cols-3 gap-2 p-3">
                  {SECTORS.map((sec) => {
                    const done = eng.s.tasked.includes(sec.id)
                    return (
                      <div key={sec.id} className="rounded border px-2.5 py-2"
                        style={{ borderColor: done ? '#00FF4133' : 'rgba(255,255,255,.07)', background: done ? '#00FF410A' : 'rgba(255,255,255,.02)' }}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold" style={{ color: done ? '#7CFFA0' : '#64748b' }}>{sec.label}</span>
                          {done ? <CheckCircle2 size={11} className="text-[#00FF41]" /> : <XCircle size={11} className="text-slate-600" />}
                        </div>
                        <div className="num mt-1 text-[9px] text-slate-500">
                          {done ? `${sec.scars} scars · forest loss ${sec.forestLoss}%` : 'never imaged — blind sector'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>
          )}

          {tab === 'decisions' && (
            <Panel className="flex min-h-0 flex-1 flex-col">
              <PanelHead title="RELIEF ADJUDICATION · บัญชีหลังคาเรือน" icon={Building2}
                right={<span className="hud-label">CABINET RESOLUTION 17 SEP 2024</span>} />
              <div className="min-h-0 flex-1 overflow-hidden p-3">
                <AdjudicationTable eng={eng} />
              </div>
            </Panel>
          )}

          {tab === 'impact' && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <Panel>
                <PanelHead title="INUNDATED AREA — GISTDA RADAR TIME SERIES" icon={Waves} accent="#A78BFA"
                  right={<Src t="radar" />} />
                <div className="h-[210px] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { d: '08 SEP', rai: 1_240 }, { d: '10 SEP', rai: 6_182 }, { d: '11 SEP', rai: 14_900 },
                      { d: '12 SEP', rai: 25_204 }, { d: '14 SEP', rai: 19_600 }, { d: '17 SEP', rai: 8_420 },
                    ]} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148,163,184,.09)" />
                      <XAxis dataKey="d" tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis width={48} tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(167,139,250,.35)', borderRadius: 6, fontSize: 11 }}
                        formatter={(v) => [`${fmt(v)} rai`, 'Inundated']} />
                      <ReferenceArea x1="10 SEP" x2="12 SEP" fill="#FF003C" fillOpacity={0.07}
                        label={{ value: '×4 in 2 days', fill: '#FF6B8A', fontSize: 10, fontFamily: 'monospace' }} />
                      <Area type="monotone" dataKey="rai" stroke="#A78BFA" strokeWidth={2} fill="url(#ag)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="border-t border-white/[0.07] px-3 py-2 text-[10px] text-slate-400">
                  6,182 rai (10 Sep) → 25,204 rai (12 Sep). The evacuation decision window is roughly two days wide —
                  and optical satellites were blind for all of it.
                </div>
              </Panel>

              <div className="grid grid-cols-2 gap-3">
                <Panel>
                  <PanelHead title="COST BREAKDOWN" icon={Wrench} right={<Src t="scenario" />} />
                  <div className="h-[212px] p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={COST_SUMMARY} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none">
                          {COST_SUMMARY.map((c, i) => <Cell key={i} fill={c.hex} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }}
                          formatter={(v, n) => [baht(v), n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-3 pb-3">
                    {COST_SUMMARY.map((c) => (
                      <span key={c.name} className="flex items-center gap-1.5 font-mono text-[8.5px] text-slate-400">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: c.hex }} />{c.name.replace(' Cost', '')}
                      </span>
                    ))}
                  </div>
                </Panel>

                <Panel>
                  <PanelHead title="RESOLUTION vs MEASURABILITY" icon={Search} right={<Src t="image" />} />
                  <div className="p-3"><ResolutionProof /></div>
                </Panel>
              </div>
            </div>
          )}

          {tab === 'lessons' && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <Panel>
                <PanelHead title="LESSONS LEARNED — FULL REGISTER" icon={ScrollText} />
                <div className="space-y-2 p-3">
                  {LESSONS.map((l) => (
                    <div key={l.n} className="flex gap-3 rounded border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                      <span className="num grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-sky-400/45 bg-sky-400/12 text-[12px] font-bold text-sky-200">
                        {l.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-sky-400/25 bg-sky-400/[0.08] px-1.5 py-[2px] font-mono text-[8px] tracking-[0.1em] text-sky-300">{l.tag}</span>
                        </div>
                        <div className="mt-1.5 text-[11.5px] leading-snug text-slate-200">{l.txt}</div>
                        <div className="font-thai mt-1 text-[10px] leading-snug text-slate-500">{l.th}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelHead title="STRESS TEST REGISTER — แผนทดสอบความทนทานของกฎ" icon={AlertTriangle} accent="#FFB300" />
                <div className="grid grid-cols-2 gap-2 p-3">
                  {[
                    ['Cloud cover 3 days straight', 'L goes stale → weight cut, confidence flagged LOW; radar carries the phase.'],
                    ['Upstream station stops reporting', 'R drops out; W and N carry the index at reduced confidence.'],
                    ['A community loses its last exit', 'Tie-break promotes it to first dispatch regardless of score.'],
                    ['Second surge before mud clearing', 'Recovery resets to critical phase; mud grants re-open.'],
                    ['Player never issues an order in Act 1', 'Clock runs; the system plays out all four communities and shows both branches.'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded border border-[#FFB300]/20 bg-[#FFB300]/[0.05] px-2.5 py-2">
                      <div className="text-[10.5px] font-semibold text-[#FFD066]">{k}</div>
                      <div className="mt-1 text-[9.5px] leading-snug text-slate-400">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/[0.07] px-3 py-2 text-[9.5px] text-slate-500">
                  In every case the decision rule degrades by dropping factors in priority order — it never stops working.
                </div>
              </Panel>
            </div>
          )}

          {tab === 'report' && <ReportTab eng={eng} exportCSV={exportCSV} />}
        </div>

        <AarRightColumn eng={eng} setTab={setTab} />
      </div>
    </div>
  )
}

function ReportTab({ eng, exportCSV }) {
  const { s, sfvi } = eng
  const done = ROOFS.filter((r) => s.adjudged[r.id])
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <Panel>
        <PanelHead title="AFTER ACTION REPORT — MAE SAI FLOOD RESPONSE" icon={FileText}
          right={<Btn size="sm" variant="primary" icon={Download} onClick={exportCSV}>Export CSV</Btn>} />
        <div className="space-y-4 p-4 text-[11.5px] leading-relaxed text-slate-300">
          <section>
            <h3 className="font-mono text-[10px] font-bold tracking-[0.14em] text-sky-200">1 · WHY SATELLITE EVIDENCE WAS NOT OPTIONAL</h3>
            <p className="mt-1.5">
              The Sai River catchment sits inside Myanmar. Thailand cannot install gauging stations there and Thai UAVs
              cannot cross the border. A single reported level at Ban Jotada does not cover a catchment. Earth observation
              was the only sensor that could see the ground that decides Mae Sai's fate — this is not a case where
              satellites are the better option, it is a case where there is no other option.
            </p>
          </section>
          <section>
            <h3 className="font-mono text-[10px] font-bold tracking-[0.14em] text-sky-200">2 · SENSOR HANDOVER</h3>
            <p className="mt-1.5">
              THEOS-2 (Pan 0.5 m / MS 2 m, {SWATH_KM} km swath, 1.9-day mean revisit, Level 3 Ortho via AWAGAD) carried the
              pre-event and post-event phases. During the critical phase, cloud cover reached 100% and optical layers were
              locked out; RADARSAT-2 through GISTDA's เช็คน้ำ and Disaster Platform carried the flood extent and the
              standing-water day count. This mirrors GISTDA's own practice during 10–12 September 2024.
            </p>
          </section>
          <section>
            <h3 className="font-mono text-[10px] font-bold tracking-[0.14em] text-sky-200">3 · DECISION RULE AS EXECUTED</h3>
            <div className="mt-1.5 grid grid-cols-5 gap-2">
              {[['W', sfvi.W, 0.30, 'measured'], ['R', sfvi.R, 0.25, 'measured'], ['L', sfvi.L, sfvi.Lw, 'image'],
              ['N', sfvi.N, 0.15, 'image'], ['P', sfvi.P, 0.10, 'scenario']].map(([k, v, w, src]) => (
                <div key={k} className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 text-center">
                  <div className="num text-[13px] font-bold text-sky-200">{k}</div>
                  <div className="num text-[14px] font-bold text-white">{Number(v).toFixed(2)}</div>
                  <div className="num text-[8px] text-slate-500">weight {Number(w).toFixed(2)}</div>
                  <div className="mt-1 flex justify-center"><Src t={src} mini /></div>
                </div>
              ))}
            </div>
            <p className="mt-2">
              Final basin SFVI <b className="num text-sky-200">{sfvi.basin.toFixed(3)}</b> at
              <b className="num text-sky-200"> {Math.round(sfvi.confidence * 100)}%</b> evidence confidence.
              Veto 1 (≥ {CRITICAL_LEVEL.toFixed(2)} m at Ban Tham Pha Chom) {eng.veto1 ? 'was triggered' : 'was not triggered'}.
              Veto 2 (stale optical under cloud) {sfvi.stale ? `reduced the L weight to ${sfvi.Lw.toFixed(2)}` : 'did not apply'}.
            </p>
          </section>
          <section>
            <h3 className="font-mono text-[10px] font-bold tracking-[0.14em] text-sky-200">4 · COMMANDER'S RECORD</h3>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {[
                ['Swaths tasked', `${s.tasked.length} / 3`], ['Scars detected', `${sfvi.scarsSeen} / ${TOTAL_SCARS}`],
                ['False alarms', s.falseAlarms], ['Hold decisions', s.holdCount],
                ['AP remaining', fmt(s.ap)], ['Data coins left', s.coins],
                ['Roofs adjudicated', `${done.length} / ${ROOFS.length}`], ['Ground surveys', s.surveyed.length],
              ].map(([k, v]) => (
                <div key={k} className="rounded border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
                  <div className="hud-label truncate">{k}</div>
                  <div className="num mt-1 text-[14px] font-bold text-white">{v}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-mono text-[10px] font-bold tracking-[0.14em] text-sky-200">5 · ACCURACY NOTE — หมายเหตุด้านความถูกต้อง</h3>
            <p className="mt-1.5 text-slate-400">
              Station critical levels and relief criteria are reviewed periodically. Every threshold in this simulator lives in a
              configuration block, not hard-coded logic. Building counts and relief budgets shown here are computed from the
              player's own decisions at the rates set by the Cabinet resolution of 17 September 2024 — they are not the actual
              damage figures of the 2024 event, and each carries a SCENARIO provenance tag.
            </p>
          </section>
        </div>
      </Panel>

      <Panel>
        <PanelHead title="PROVENANCE LEGEND · ป้ายกำกับที่มาของข้อมูล 4 แบบ" icon={Database} />
        <div className="grid grid-cols-2 gap-2 p-3">
          {Object.entries(SRC).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2.5 rounded border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
              <Src t={k} />
              <div className="min-w-0">
                <div className="font-thai text-[11px] text-white">{v.th}</div>
                <div className="text-[9.5px] leading-snug text-slate-400">{v.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   13 · ROOT
   ══════════════════════════════════════════════════════════════════════════ */

function Toast({ flash }) {
  if (!flash) return null
  const hex = flash.kind === 'crit' ? '#FF003C' : flash.kind === 'warn' ? '#FFB300' : '#00FF41'
  return (
    <div className="pointer-events-none fixed left-1/2 top-[86px] z-50 -translate-x-1/2 animate-[riseIn_.3s_ease-out]">
      <div className="flex items-center gap-2.5 rounded-md border-2 px-5 py-2.5 backdrop-blur-md"
        style={{ borderColor: hex, background: `${hex}1A`, boxShadow: `0 0 34px -8px ${hex}` }}>
        <AlertTriangle size={15} style={{ color: hex }} />
        <span className="font-mono text-[12px] font-bold tracking-[0.11em]" style={{ color: hex }}>{flash.text}</span>
      </div>
    </div>
  )
}

function StatusBar({ eng }) {
  const { s } = eng
  return (
    <footer className="relative z-20 flex h-8 shrink-0 items-center gap-4 border-t border-sky-400/15 bg-[#060B16]/92 px-4 backdrop-blur-xl">
      <span className="hud-label">DATA SOURCE:</span>
      <span className="font-mono text-[9.5px] tracking-[0.12em] text-sky-200/80">THEOS-2</span>
      <span className="text-slate-700">|</span>
      <span className="font-mono text-[9.5px] tracking-[0.12em] text-sky-200/80">GISTDA</span>
      <span className="text-slate-700">|</span>
      <span className="font-mono text-[9.5px] tracking-[0.12em] text-sky-200/60">
        {s.act === 2 ? 'RADARSAT-2 · เช็คน้ำ · DISASTER PLATFORM' : 'SPHERE MAP / ELEVATION / ROUTING API · AWAGAD · LANDX'}
      </span>

      {s.act === 2 && (
        <span className="mx-auto flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] text-[#FF6B8A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF003C] animate-[flash_1s_ease-in-out_infinite]" />
          LIVE MODE: REAL-TIME DATA STREAM
        </span>
      )}

      <span className="ml-auto flex items-center gap-2">
        <span className="hud-label">SYSTEM STATUS:</span>
        <span className="h-2 w-2 rounded-full bg-[#00FF41]" style={{ boxShadow: '0 0 8px #00FF41' }} />
        <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-[#7CFFA0]">ONLINE</span>
      </span>
    </footer>
  )
}

export default function App() {
  const eng = useEngine()
  const act = ACTS.find((a) => a.n === eng.s.act)

  /* Keyboard: 1 / 2 / 3 jump between acts, Space toggles the clock. */
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === '1') eng.goAct(1)
      if (e.key === '2') eng.goAct(2)
      if (e.key === '3') eng.goAct(3)
      if (e.code === 'Space' && eng.s.act !== 3) { e.preventDefault(); eng.setRunning((r) => !r) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [eng])

  return (
    <div className="crt grid-bg flex h-screen w-screen flex-col overflow-hidden bg-[#050912]">
      {/* Ambient act-coloured wash */}
      <div className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
        style={{ background: `radial-gradient(120% 70% at 50% 0%, ${act.hex}0F, transparent 62%)` }} />

      <TopBar eng={eng} />
      {eng.s.act === 3 ? <AarShell eng={eng} /> : <CommandShell eng={eng} />}
      <StatusBar eng={eng} />
      <Toast flash={eng.flash} />
    </div>
  )
}
