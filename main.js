import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { DesktopSurface } from "./desktop-surface.js";
import { bakeContactShadows } from "./contact-shadows.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { buildRealisticScene } from "./realistic-scene.js";
import { AudioManager, MOUSE_POS } from "./audio-manager.js";
import { CameraManager, Easing, HENRY_CUBIC, KEY } from "./camera-manager.js";

// Audio (henryheffernan port): assigned after camera/scene exist; typeInto/keys guard on null.
let audioManager = null;
let lastKey = "";
// Henry camera (camera-manager.js): assigned after camera/controls exist; flow handlers guard on null.
let camManager = null;

const SITE = window.SITE || {};
const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function typeInto(el, text, speed = 34) {
  // Henry staged auto-type: jittered 50-170ms/char (not fixed interval).
  return new Promise((res) => {
    el.textContent = "";
    let i = 0;
    const step = () => {
      el.textContent = text.slice(0, ++i);
      // Original _AUTO_ path: every auto-typed char plays ccType {vol .1, pitch 20}.
      try { audioManager?.playCcType(); } catch { /* audio not ready */ }
      if (i >= text.length) { res(); return; }
      setTimeout(step, 45 + Math.random() * 75);
    };
    setTimeout(step, 45 + Math.random() * 75);
  });
}

/* ── Placeholders into HUD / gate ───────────────────────────── */
const OWNER = SITE.name || "Your Name";
document.title = `${OWNER} — Portfolio · henry-motion mock`;
$("gateTitle").textContent = `${OWNER} Portfolio Showcase`;
$("hudName").textContent = OWNER;
$("hudRole").textContent = SITE.role || "Site Reliability Engineer";
$("macOwner").textContent = OWNER;

/* ── Clocks ─────────────────────────────────────────────────── */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function tickClocks() {
  const d = new Date();
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const p = (n) => String(n).padStart(2, "0");
  $("hudClock").textContent = `${p(h12)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
  $("macClock").textContent = `${DAYS[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}  ${p(h12)}:${p(d.getMinutes())} ${ap}`;
}
tickClocks();
setInterval(tickClocks, 1000);

/* ── Section columns (same everywhere, placeholder-fed) ─────── */
const TABS = [
  { id: "about", icon: "person" },
  { id: "experience", icon: "briefcase" },
  { id: "projects", icon: "grid" },
  { id: "contact", icon: "at" },
];

/* Original hand-drawn SVG icon set (48px squircle style) */
const ICONS = {
  finder: `<svg viewBox="0 0 48 48"><defs><linearGradient id="icFldB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ab3ff"/><stop offset="1" stop-color="#2f7fe0"/></linearGradient><linearGradient id="icFldF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5d9ff"/><stop offset="1" stop-color="#6aaef5"/></linearGradient></defs><path d="M6 15a4 4 0 0 1 4-4h8l4 5h16a4 4 0 0 1 4 4v1H6z" fill="url(#icFldB)"/><rect x="6" y="17" width="36" height="21" rx="4" fill="url(#icFldF)"/></svg>`,
  term: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#232328"/><circle cx="12.5" cy="12" r="2.4" fill="#ff5f57"/><circle cx="19.5" cy="12" r="2.4" fill="#febc2e"/><circle cx="26.5" cy="12" r="2.4" fill="#28c840"/><text x="10" y="34" font-family="monospace" font-size="16" font-weight="bold" fill="#fff">&gt;_</text></svg>`,
  compass: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#f2f4f9"/><circle cx="24" cy="24" r="14.5" fill="#0a84ff"/><circle cx="24" cy="24" r="14.5" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.5"/><path d="M24 12 L28.5 24 L24 36 L19.5 24 Z" fill="#fff"/><path d="M24 12 L28.5 24 L19.5 24 Z" fill="#ff5f57"/></svg>`,
  mail: `<svg viewBox="0 0 48 48"><defs><linearGradient id="icMail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f9bff"/><stop offset="1" stop-color="#0a63d6"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="10" fill="url(#icMail)"/><rect x="10" y="15" width="28" height="19" rx="3" fill="#fff"/><path d="M11 18 L24 27 L37 18" stroke="#0a63d6" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  photos: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#f2f4f9"/><g opacity="0.85"><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#fa4c64"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#ff9d5c" transform="rotate(45 24 24)"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#ffd479" transform="rotate(90 24 24)"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#30c48d" transform="rotate(135 24 24)"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#5aa9ff" transform="rotate(180 24 24)"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#7d7aff" transform="rotate(225 24 24)"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#b07fe8" transform="rotate(270 24 24)"/><ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="#ff7ab8" transform="rotate(315 24 24)"/></g></svg>`,
  music: `<svg viewBox="0 0 48 48"><defs><linearGradient id="icMus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fc6a7f"/><stop offset="1" stop-color="#e8253d"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="10" fill="url(#icMus)"/><ellipse cx="18.5" cy="33" rx="6" ry="4.6" fill="#fff"/><rect x="23" y="12" width="3.2" height="20" fill="#fff"/><path d="M23 12 q11 1.5 11 10.5 l-3.4 0 q0-6.5-7.6-7.3z" fill="#fff"/></svg>`,
  trash: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#e9ebf1"/><path d="M15.5 17.5 h17 l-1.8 18 a2.5 2.5 0 0 1-2.5 2.3 H19.8 a2.5 2.5 0 0 1-2.5-2.3z" fill="#a7abb6"/><rect x="13" y="14.5" width="22" height="3" rx="1.5" fill="#7c7f89"/><rect x="21" y="11.5" width="6" height="3" rx="1.5" fill="#7c7f89"/><line x1="21" y1="21" x2="21" y2="33" stroke="#e9ebf1" stroke-width="2"/><line x1="24" y1="21" x2="24" y2="33" stroke="#e9ebf1" stroke-width="2"/><line x1="27" y1="21" x2="27" y2="33" stroke="#e9ebf1" stroke-width="2"/></svg>`,
  folder: `<svg viewBox="0 0 48 48"><defs><linearGradient id="icFoF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5d9ff"/><stop offset="1" stop-color="#6aaef5"/></linearGradient></defs><path d="M6 15a4 4 0 0 1 4-4h8l4 5h16a4 4 0 0 1 4 4v1H6z" fill="#2f7fe0"/><rect x="6" y="17" width="36" height="21" rx="4" fill="url(#icFoF)"/></svg>`,
  person: `<svg viewBox="0 0 48 48"><defs><linearGradient id="icPer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a9aa2"/><stop offset="1" stop-color="#63636b"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="10" fill="url(#icPer)"/><circle cx="24" cy="18" r="7.5" fill="#fff"/><path d="M9 41 q3.5-12 15-12 t15 12z" fill="#fff"/></svg>`,
  briefcase: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#f2f4f9"/><rect x="9" y="17" width="30" height="19" rx="4" fill="#b07a45"/><rect x="9" y="24" width="30" height="4" fill="#7c4f26"/><path d="M18 17 v-3.5 a2 2 0 0 1 2-2 h8 a2 2 0 0 1 2 2 V17" stroke="#7c4f26" stroke-width="3" fill="none"/><rect x="15" y="24" width="4" height="6" fill="#f2d38a"/><rect x="29" y="24" width="4" height="6" fill="#f2d38a"/></svg>`,
  grid: `<svg viewBox="0 0 48 48"><defs><linearGradient id="icGrd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f9bff"/><stop offset="1" stop-color="#0a63d6"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="10" fill="url(#icGrd)"/><rect x="12" y="12" width="10.5" height="10.5" rx="2.5" fill="#fff"/><rect x="25.5" y="12" width="10.5" height="10.5" rx="2.5" fill="#fff" opacity="0.75"/><rect x="12" y="25.5" width="10.5" height="10.5" rx="2.5" fill="#fff" opacity="0.75"/><rect x="25.5" y="25.5" width="10.5" height="10.5" rx="2.5" fill="#fff"/></svg>`,
  at: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#1c1c20"/><text x="24" y="33" text-anchor="middle" font-family="sans-serif" font-size="25" font-weight="bold" fill="#fff">@</text></svg>`,
  doc: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#f2f4f9"/><path d="M15 8 h11 l8 8 v24 h-19z" fill="#fff" stroke="#c2c7d1" stroke-width="1.5"/><path d="M26 8 v8 h8" fill="#dfe3ea"/><line x1="18" y1="24" x2="30" y2="24" stroke="#c2c7d1" stroke-width="2"/><line x1="18" y1="28.5" x2="30" y2="28.5" stroke="#c2c7d1" stroke-width="2"/><line x1="18" y1="33" x2="27" y2="33" stroke="#c2c7d1" stroke-width="2"/></svg>`,
  link: `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="10" fill="#8e8e96"/><path d="M19 29 L29 19 M21 19 h8 v8" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
let macTab = 0;

function setMacTab(i) {
  macTab = ((i % TABS.length) + TABS.length) % TABS.length;

  renderMac();
}

/* ── macOS overlay: icons, Finder, dock ─────────────────────── */
function buildMacChrome() {
  $("macIcons").innerHTML = TABS.map((t, i) =>
    `<button class="mac-icon" data-tab="${i}"><span class="glyph">${ICONS[t.icon]}</span><span>${t.id}</span></button>`
  ).join("");
  $("finSide").innerHTML = TABS.map((t, i) =>
    `<button data-tab="${i}" class="${i === macTab ? "active" : ""}"><span class="sw">${ICONS[t.icon]}</span>${t.id}</button>`
  ).join("");
  const dock = [{ icon: "finder", tab: -1, label: "Finder" },
    ...TABS.map((t) => ({ icon: t.icon, tab: TABS.indexOf(t), label: t.id })),
    { icon: "trash", tab: -2, label: "Trash" }];
  $("macDock").innerHTML = dock.map((d) =>
    `<button class="dock-app${d.tab === macTab ? " active" : ""}" data-tab="${d.tab}" title="${esc(d.label)}">${ICONS[d.icon]}</button>`
  ).join("");
  document.querySelectorAll("#macIcons .mac-icon, #macDock .dock-app").forEach((b) =>
    b.addEventListener("click", (e) => {
      try { audioManager?.playMouseDown(); setTimeout(() => { try { audioManager?.playMouseUp(); } catch {} }, 90); } catch {}
      b.classList.remove("bounce"); void b.offsetWidth; b.classList.add("bounce");
      setTimeout(() => b.classList.remove("bounce"), 600);
      const t = parseInt(b.dataset.tab, 10);
      if (t === -2) return;
      if (t >= 0) setMacTab(t);
      popFinder(e.clientX, e.clientY);
      renderMac();
    }));
  document.querySelectorAll("#finSide button").forEach((b) =>
    b.addEventListener("click", () => { try { audioManager?.playMouseDown(); } catch {} setMacTab(parseInt(b.dataset.tab, 10)); renderMac(); }));
}

function renderMac() {
  const tab = TABS[macTab].id;
  document.querySelectorAll("#finSide button").forEach((b) =>
    b.classList.toggle("active", parseInt(b.dataset.tab, 10) === macTab));
  document.querySelectorAll("#macDock .dock-app").forEach((b) =>
    b.classList.toggle("active", parseInt(b.dataset.tab, 10) === macTab));
  $("finName").textContent = `${tab} — Finder`;
  const main = $("finMain");
  if (tab === "about") {
    main.innerHTML =
      `<h2>${esc(SITE.name)}</h2><div class="sub">${esc(SITE.role)} · ${esc(SITE.location || "")}</div>` +
      `<div class="sub">${esc(SITE.tagline || "")}</div>` +
      (SITE.about || []).map((l) => `<div style="margin-bottom:8px">› ${esc(l)}</div>`).join("") +
      `<div style="margin-top:12px">${(SITE.skills || []).map((s) => `<span class="fin-skill">${esc(s)}</span>`).join("")}</div>`;
  } else if (tab === "experience") {
    main.innerHTML = `<h2>experience</h2><div class="sub">${(SITE.experience || []).length} roles</div>` +
      (SITE.experience || []).map((e) =>
        `<div class="fin-row"><span class="glyph">${ICONS.briefcase}</span><div><b>${esc(e.title)}</b>` +
        `<small>${esc(e.period)} — ${(e.points || []).map(esc).join(" · ")}</small></div></div>`
      ).join("");
  } else if (tab === "projects") {
    main.innerHTML = `<h2>projects</h2><div class="sub">double-click to open</div>` +
      (SITE.projects || []).map((p) =>
        `<a class="fin-row" href="${esc(p.url)}" target="_blank" rel="noreferrer"><span class="glyph">${ICONS.grid}</span>` +
        `<div><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></div></a>`
      ).join("");
  } else {
    main.innerHTML = `<h2>contact</h2><div class="sub">open to SRE / platform roles</div>` +
      `<a class="fin-row" href="mailto:${esc(SITE.email)}"><span class="glyph">${ICONS.at}</span>` +
      `<div><b>${esc(SITE.email)}</b><small>email</small></div></a>` +
      `<a class="fin-row" href="${esc(SITE.resumeUrl)}" target="_blank" rel="noreferrer"><span class="glyph">${ICONS.doc}</span>` +
      `<div><b>resume</b><small>download</small></div></a>` +
      (SITE.socials || []).map((s) =>
        `<a class="fin-row" href="${esc(s.url)}" target="_blank" rel="noreferrer"><span class="glyph">${ICONS.link}</span>` +
        `<div><b>${esc(s.label)}</b><small>${esc(s.url)}</small></div></a>`
      ).join("");
  }
  const fm = $("finMain");
  if (fm.animate) fm.animate(
    [{ opacity: 0, transform: "translateX(16px)" }, { opacity: 1, transform: "none" }],
    { duration: 180, easing: "ease-out" });
}

let screenMeshRef = null;
let desktopOpen = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let returnView = null;

/* Finder grows from the clicked icon, shrinks back on close */
function finderBase() {
  const t = getComputedStyle($("finder")).transform;
  return t === "none" ? "" : t + " ";
}
function popFinder(x, y) {
  const fin = $("finder");
  fin.style.display = "flex";
  const r = fin.getBoundingClientRect();
  fin.style.transformOrigin = `${x - r.left}px ${y - r.top}px`;
  if (fin.animate) fin.animate(
    [{ transform: finderBase() + "scale(0.55)", opacity: 0 }, { transform: finderBase() + "scale(1)", opacity: 1 }],
    { duration: 240, easing: "cubic-bezier(0.2,0.9,0.25,1.15)" });
}
function closeFinder() {
  const fin = $("finder");
  if (fin.style.display === "none") return;
  if (!fin.animate) { fin.style.display = "none"; return; }
  const a = fin.animate(
    [{ transform: finderBase() + "scale(1)", opacity: 1 }, { transform: finderBase() + "scale(0.55)", opacity: 0 }],
    { duration: 200, easing: "ease-in" });
  a.onfinish = () => { fin.style.display = "none"; };
}

function openMacOS(tab = macTab) {
  if (flying || desktopOpen || !screenMeshRef) return;
  setMacTab(tab);
  renderMac();
  returnView = { position: camera.position.clone(), target: controls.target.clone() };
  flying = true;
  try { camManager?.cancelToManual(); if (camManager) camManager.current = null; } catch {}
  controls.enabled = false;
  controls.autoRotate = false;
  tooltip.style.display = "none";
  $("hud").classList.remove("on");
  screenMeshRef.updateWorldMatrix(true, false);
  const center = screenMeshRef.getWorldPosition(new THREE.Vector3());
  const orientation = screenMeshRef.getWorldQuaternion(new THREE.Quaternion());
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
  const scale = screenMeshRef.getWorldScale(new THREE.Vector3());
  const width = screenMeshRef.geometry.parameters.width * scale.x;
  const height = screenMeshRef.geometry.parameters.height * scale.y;
  const distance = Math.max(height, width / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.08;
  flyTo(center.clone().addScaledVector(normal, distance), center, reducedMotion.matches ? 0.01 : 1.45, async () => {
    desktopOpen = true;
    // Henry MONITOR keyframe while inside the screen.
    try { if (camManager) { camManager.current = KEY.MONITOR; camManager.target = null; } } catch {}
    await desktopSurface.expand(camera, reducedMotion.matches);
    flying = false;
  });
}
async function closeMacOS() {
  if (!desktopOpen || flying) return;
  flying = true;
  await desktopSurface.collapse(camera, reducedMotion.matches);
  desktopOpen = false;
  flyTo(returnView?.position || DESK_POS, returnView?.target || DESK_TGT, reducedMotion.matches ? 0.01 : 1.4, () => {
    flying = false;
    controls.enabled = true;
    controls.autoRotate = rotatePref;
    // Back on the desk keyframe so parallax/drift resume.
    try { if (camManager) { camManager.current = KEY.DESK; camManager.target = null; } } catch {}
    $("hud").classList.add("on");
  });
}
$("macExit").addEventListener("click", () => { try { audioManager?.playMouseDown(); } catch {} closeMacOS(); });
$("macBack").addEventListener("click", () => { try { audioManager?.playMouseDown(); } catch {} closeMacOS(); });
/* Clicking empty desktop (wallpaper) also goes back to the 3D desk */
$("macos").addEventListener("click", (e) => {
  if (e.target.closest(".finder, .mac-icons, .mac-dock, .mac-menu, #macBack")) return;
  closeMacOS();
});
$("finClose").addEventListener("click", () => { try { audioManager?.playMouseDown(); } catch {} closeFinder(); });
$("btnMac").addEventListener("click", () => { try { audioManager?.playMouseDown(); } catch {} openMacOS(); });
$("btnMute")?.addEventListener("click", (e) => {
  const muted = audioManager ? audioManager.setMuted(!audioManager.muted) : false;
  e.currentTarget.textContent = muted ? "UNMUTE" : "MUTE";
  e.currentTarget.classList.toggle("active", !muted);
});
window.addEventListener("keydown", (e) => {
  // Original real-key path: distinct keys play keyboardKeydown (random 1-6), vol .8 positional.
  // M toggles mute (maps original muteToggle button).
  if (e.key === "m" || e.key === "M") {
    const muted = audioManager ? audioManager.setMuted(!audioManager.muted) : false;
    const b = $("btnMute");
    if (b) { b.textContent = muted ? "UNMUTE" : "MUTE"; }
    return;
  }
  if (e.key === "Escape") {
    if (e.repeat !== true && lastKey !== "Escape") try { audioManager?.playKeyboard(); } catch {}
    lastKey = "Escape";
    if (flying) { if (!desktopOpen) cancelFlight(); return; }
    if (desktopOpen) closeMacOS();
    return;
  }
  const n = ["1", "2", "3", "4"].indexOf(e.key);
  if (n >= 0) {
    if (lastKey !== e.key) try { audioManager?.playKeyboard(); } catch {}
    lastKey = e.key;
    setMacTab(n);
    return;
  }
  // Any other real key (desk / macOS open): original inComputer keyboard click, no auto-repeat spam.
  if (!e.repeat && lastKey !== e.key && (stage === "desk" || desktopOpen)) {
    try { audioManager?.playKeyboard(); } catch {}
  }
  lastKey = e.key;
});
window.addEventListener("keyup", () => { lastKey = ""; });

/* Finder drag */
{
  const fin = $("finder"), bar = $("finTitle");
  let drag = null;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.id === "finClose") return;
    const r = fin.getBoundingClientRect();
    drag = { x: e.clientX - r.left, y: e.clientY - r.top };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", (e) => {
    if (!drag) return;
    fin.style.left = `${e.clientX - drag.x}px`;
    fin.style.top = `${e.clientY - drag.y}px`;
    fin.style.transform = "none";
  });
  bar.addEventListener("pointerup", () => { drag = null; });
}

/* ── Flow: gate → wide → desk ───────────────────────────────── */
let stage = "gate";
let flying = false;
let camTween = null;
// Henry drift phases key off elapsed seconds; performance clock is equivalent here.
function clockTime() { return performance.now() / 1000; }
/* Wall-clock tweens: always finish in `dur` seconds, even at low fps */
function flyTo(pos, tgt, dur = 2.2, done = null) {
  camTween = { start: performance.now(), durMs: dur * 1000, fp: camera.position.clone(), tp: pos.clone(), ft: controls.target.clone(), tt: tgt.clone(), done };
}
function cancelFlight() {
  camTween = null; flying = false;
  controls.enabled = true;
  if (rotatePref && stage === "desk") controls.autoRotate = true;
  if (stage === "desk") $("hud").classList.add("on");
}
$("startBtn").addEventListener("click", () => {
  if (stage !== "gate") return;
  // Original needs a user gesture to create/resume AudioContext — START is ours.
  try { audioManager?.unlock(); audioManager?.preload(); } catch {}
  stage = "wide";
  $("gate").classList.add("gone");
  $("beginPill").classList.remove("hidden");
  typeInto($("beginText"), "Click anywhere to begin ", 45);
  // Henry setPostLoadTransition: loading -> IDLE 2500ms Exponential.Out sweep.
  try { camManager?.transition(KEY.IDLE, 2500, Easing.ExponentialOut, null, clockTime()); } catch {}
  setTimeout(() => $("gate").remove(), 700);
});
window.addEventListener("pointerup", (e) => {
  if (stage !== "wide") return;
  if (pointerDragged) return;
  if (e.target.closest("#gate, #hud, #macos, button")) return;
  stage = "desk";
  // Original loadingScreenDone: office loop (lowpass 1000) + startup once, in this order.
  try { audioManager?.startAmbience(); } catch {}
  const pill = $("beginPill");
  pill.classList.add("flash");
  setTimeout(() => { pill.classList.add("hidden"); pill.classList.remove("flash"); }, 220);
  $("hud").classList.add("on");
  // Henry DESK entry: 1000ms Quintic.InOut (was 2.4s smoothstep).
  try {
    if (camManager) camManager.transition(KEY.DESK, 1000, Easing.QuinticInOut, null, clockTime());
    else flyTo(DESK_POS, DESK_TGT, 2.4);
  } catch { flyTo(DESK_POS, DESK_TGT, 2.4); }
  (async () => {
    document.querySelector(".hud-row").style.opacity = "0";
    await typeInto($("hudName"), OWNER, 42);
    await typeInto($("hudRole"), SITE.role || "Site Reliability Engineer", 26);
    document.querySelector(".hud-row").style.opacity = "1";
  })();
});
// Henry freeCam starts OFF (was auto-rotate ON in v1) — ROTATE enables the orbit view.
let rotatePref = false;
$("btnCam").addEventListener("click", () => {
  try { audioManager?.playMouseDown(); } catch {}
  controls.enabled = true;
  controls.autoRotate = rotatePref;
  try {
    if (camManager) camManager.transition(KEY.DESK, 1000, Easing.QuinticInOut, null, clockTime());
    else flyTo(DESK_POS, DESK_TGT, 1.4);
  } catch { flyTo(DESK_POS, DESK_TGT, 1.4); }
});
$("btnRotate").addEventListener("click", (e) => {
  rotatePref = !rotatePref;
  e.currentTarget.classList.toggle("active", rotatePref);
  try { audioManager?.playMouseDown(); } catch {}
  // Henry setFreeCamListeners: on -> ORBIT_START 750ms custom cubic; off -> IDLE 4000ms Exponential.Out.
  try {
    if (camManager) {
      if (rotatePref) {
        controls.enabled = true;
        camManager.transition(KEY.ORBIT_START, 750, HENRY_CUBIC, () => { controls.autoRotate = true; }, clockTime());
      } else {
        controls.autoRotate = false;
        camManager.transition(KEY.IDLE, 4000, Easing.ExponentialOut, null, clockTime());
      }
    } else {
      controls.autoRotate = rotatePref;
    }
  } catch { controls.autoRotate = rotatePref; }
});

/* ── Three.js light-studio scene (procedural, original) ─────── */
const stageEl = $("stage");
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stageEl.appendChild(renderer.domElement);
const desktopSurface = new DesktopSurface($("macos"), stageEl);

const scene = new THREE.Scene();
const STUDIO = new THREE.Color(0xd9d9de);
scene.background = STUDIO;
scene.fog = new THREE.Fog(STUDIO, 15, 32);

/* Studio reflections so metals read as metal */
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
const WIDE_POS = new THREE.Vector3(5.4, 3.5, 7.4);
const WIDE_TGT = new THREE.Vector3(0, 0.75, 0);
const DESK_POS = new THREE.Vector3(1.5, 1.95, 3.1);
const DESK_TGT = new THREE.Vector3(0, 1.08, 0.05);
// Henry LOADING keyframe: gate sits on the high sweep start, START flies to IDLE.
camera.position.set(9.5, 7.5, 13.5);

/* Audio: same graph as original (listener on camera, office+startup, positional mouse/keys) */
audioManager = new AudioManager(camera, scene);
audioManager.preload();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.4, 0);
controls.enableDamping = true;
controls.enableRotate = true;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.dampingFactor = 0.06;
controls.minDistance = 1.2;
controls.maxDistance = 16;
controls.maxPolarAngle = 1.53;
// Henry: no auto-rotate until freeCam (ROTATE) is enabled.
controls.autoRotate = false;
controls.autoRotateSpeed = 0.55;

/* Henry camera keyframes (camera-manager.js): idle drift + desk parallax + aspect dolly. */
camManager = new CameraManager(camera, controls);
let idleTimer = null;
controls.addEventListener("start", () => {
  // Manual input takes ownership from a reset/entry camera animation.
  if (camTween) cancelFlight();
  try { camManager?.cancelToManual(); } catch {}
  controls.autoRotate = false;
  if (idleTimer) clearTimeout(idleTimer);
});
controls.addEventListener("end", () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (rotatePref && controls.enabled && !flying && !desktopOpen) controls.autoRotate = true;
  }, 4000);
});

/* Lights */
scene.add(new THREE.HemisphereLight(0xffffff, 0x8f959e, 0.6));
scene.add(new THREE.AmbientLight(0xffffff, 0.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.65);
sun.position.set(-3, 7, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -3.8; sun.shadow.camera.right = 3.8;
sun.shadow.camera.top = 3.8; sun.shadow.camera.bottom = -3.8;
sun.shadow.camera.far = 25;
sun.shadow.bias = -0.00005;
sun.shadow.normalBias = 0.012;
sun.shadow.radius = 5;
sun.shadow.blurSamples = 12;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xeef2ff, 0.5);
fill.position.set(-4, 3, -3);
scene.add(fill);
const screenGlow = new THREE.PointLight(0xd8e8ff, 3, 4, 1.8);
screenGlow.position.set(0, 1.8, 1.1);
scene.add(screenGlow);

/* Materials */
const M = {
  deskTop: new THREE.MeshStandardMaterial({ color: 0x3f3f45, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc7cad1, roughness: 0.35, metalness: 0.8 }),
  drawer: new THREE.MeshStandardMaterial({ color: 0xdfe1e6, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.6 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  tray: new THREE.MeshStandardMaterial({ color: 0xb3a48d, roughness: 0.8 }),
  binderA: new THREE.MeshStandardMaterial({ color: 0x4d423b, roughness: 0.7 }),
  binderB: new THREE.MeshStandardMaterial({ color: 0x6b6259, roughness: 0.7 }),
  mug: new THREE.MeshStandardMaterial({ color: 0xf5f5f6, roughness: 0.4 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x63b96f, roughness: 0.7 }),
  pot: new THREE.MeshStandardMaterial({ color: 0x9a7a5f, roughness: 0.8 }),
  chairTan: new THREE.MeshStandardMaterial({ color: 0xc08a54, roughness: 0.65 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.3, metalness: 0.85 }),
  aluDark: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xcfcfd6, roughness: 0.95 }),
  logoGlow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.2 }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

const TOP = 1.0;
const updateAtmosphere = buildRealisticScene(scene, TOP, renderer);

/* ── Canvas helpers ─────────────────────────────────────────── */
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function makeTex(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx: canvas.getContext("2d"), tex };
}

/* Keyboard deck texture */
const deck = makeTex(1024, 640);
{
  const g = deck.ctx;
  g.fillStyle = "#ccd1d8"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#2a2e35";
  const cols = 14, rows = 5, gx = 40, gy = 70, gw = 944, gh = 330;
  const kw = gw / cols, kh = gh / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    rr(g, gx + c * kw + 4, gy + r * kh + 4, kw - 8, kh - 8, 8); g.fill();
  }
  g.fillStyle = "#b7bdc6"; rr(g, 342, 440, 340, 160, 18); g.fill();
  g.fillStyle = "#ccd1d8"; rr(g, 348, 446, 328, 148, 14); g.fill();
  deck.tex.needsUpdate = true;
}

/* Glowing lid emblem: pack's logo art, inverted to white-on-transparent */
const logoCanvas = document.createElement("canvas");
logoCanvas.width = logoCanvas.height = 256;
const logoTex = new THREE.CanvasTexture(logoCanvas);
logoTex.colorSpace = THREE.SRGBColorSpace;
const logoImg = new Image();
function paintLogo() {
  if (!logoImg.complete || !logoImg.naturalWidth) return;
  const lg = logoCanvas.getContext("2d");
  lg.clearRect(0, 0, 256, 256);
  lg.drawImage(logoImg, 0, 0, 256, 256);
  lg.globalCompositeOperation = "difference";
  lg.fillStyle = "#fff";
  lg.fillRect(0, 0, 256, 256);
  lg.globalCompositeOperation = "source-over";
  logoTex.needsUpdate = true;
}
logoImg.onload = () => paintLogo();
logoImg.src = "assets/macbook/apple-logo.jpg";
paintLogo();
const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: logoTex, transparent: true });


/* ── MacBook: real 2020 model first, procedural fallback ────── */
const interactives = [];
function buildProceduralMacBook() {
const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.0), M.alu);
base.position.set(0, TOP + 0.03, 0.12);
base.castShadow = true; base.receiveShadow = true;
base.userData = { action: "macbook", label: "open ▸ macOS desktop" };
scene.add(base);
interactives.push(base);
{
  const deckPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.92),
    new THREE.MeshStandardMaterial({ map: deck.tex, roughness: 0.5, metalness: 0.4 }));
  deckPlane.rotation.x = -Math.PI / 2;
  deckPlane.position.set(0, TOP + 0.062, 0.12);
  scene.add(deckPlane);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.24, 20), M.aluDark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, TOP + 0.06, -0.38);
  scene.add(hinge);
}
const lid = new THREE.Group();
lid.position.set(0, TOP + 0.06, -0.38);
lid.rotation.x = -0.30;
scene.add(lid);
{
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.045), M.alu);
  panel.position.set(0, 0.5, 0);
  panel.castShadow = true;
  lid.add(panel);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.92, 0.012), M.dark);
  bezel.position.set(0, 0.5, 0.024);
  lid.add(bezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.84),
    new THREE.MeshBasicMaterial({ color: 0x000000 }));
  screen.position.set(0, 0.5, 0.032);
  screen.userData = { action: "macbook", label: "open ▸ macOS desktop" };
  lid.add(screen);
  interactives.push(screen);
  screenMeshRef = screen;
  desktopSurface.attach(screen);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12),
    new THREE.MeshBasicMaterial({ color: 0x1a2733 }));
  cam.position.set(0, 0.93, 0.032);
  lid.add(cam);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.052, 32), M.logoGlow);
  logo.position.set(0, 0.52, -0.024);
  logo.rotation.y = Math.PI;
  lid.add(logo);
}
}

/* Real MacBook Pro 2020 model (mm units, y-up, open at 90°) */
{
  const alu = new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.32, metalness: 0.85 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.7 });
  const camMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.4, metalness: 0.3 });
  const keyTex = new THREE.TextureLoader().load("assets/macbook/keyboard.jpg");
  keyTex.colorSpace = THREE.SRGBColorSpace;
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.2, map: keyTex });
  const keyMatPlain = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.7, metalness: 0.2 });

  new OBJLoader().load("assets/macbook/macbook.obj", (model) => {
    let lidMesh = null, lidArea = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.geometry.computeBoundingBox();
      const sz = o.geometry.boundingBox.getSize(new THREE.Vector3());
      const nm = (o.name || "").toLowerCase();
      if (nm.includes("object026")) {
        o.material = o.geometry.attributes.uv ? keyMat : keyMatPlain;
      } else if (nm.includes("plane006") || nm.includes("cylinder007") || nm.includes("object027")) {
        o.material = camMat;
      } else if (nm.includes("object025") || nm.includes("sphere001")) {
        o.material = aluDark;
      } else {
        o.material = alu;
      }
      if (sz.x > 300 && sz.y > 150 && sz.z < 25 && sz.x * sz.y > lidArea) {
        lidArea = sz.x * sz.y; lidMesh = o;
      }
    });
    /* Live macOS texture on the lid's user-facing side */
    if (lidMesh) {
      const bb = lidMesh.geometry.boundingBox;
      const w = Math.min(bb.max.x - bb.min.x - 22, 340);
      const h = Math.min(bb.max.y - bb.min.y - 30, 218);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      screen.position.set((bb.max.x + bb.min.x) / 2, (bb.max.y + bb.min.y) / 2 + 4, bb.max.z + 0.7);
      screen.userData = { action: "macbook", label: "open ▸ macOS desktop" };
      lidMesh.add(screen);
      interactives.push(screen);
      screenMeshRef = screen;
  desktopSurface.attach(screen);
      const emblem = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), logoMat);
      emblem.position.set((bb.max.x + bb.min.x) / 2, (bb.max.y + bb.min.y) / 2 + 6, bb.min.z - 0.7);
      emblem.rotation.y = Math.PI;
      lidMesh.add(emblem);
    }
    model.traverse((o) => {
      if (o.isMesh && !o.userData.action) o.userData = { action: "macbook", label: "open ▸ macOS desktop" };
    });
    /* Normalize: 358mm wide → 1.5 units, base resting on desk */
    const S = 1.5 / 358;
    model.scale.setScalar(S);
    scene.add(model);
    interactives.push(model);
    const bounds = new THREE.Box3().setFromObject(model);
    model.position.x -= (bounds.min.x + bounds.max.x) / 2;
    model.position.z -= (bounds.min.z + bounds.max.z) / 2;
    model.position.y += TOP - bounds.min.y;
    bakeContactShadows(scene, renderer);
  }, undefined, () => { buildProceduralMacBook(); bakeContactShadows(scene, renderer); });
}

/* ── Picking + tooltip ──────────────────────────────────────── */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const tooltip = $("tooltip");
let downAt = null;
let pointerDragged = false;
function pickAt(cx, cy) {
  ptr.x = (cx / window.innerWidth) * 2 - 1;
  ptr.y = -(cy / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(interactives, true);
  return hits[0]?.object || null;
}
renderer.domElement.addEventListener("pointermove", (e) => {
  if (downAt && Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1]) > 5) pointerDragged = true;
  if (pointerDragged && downAt) {
    tooltip.style.display = "none";
    renderer.domElement.style.cursor = "grabbing";
    return;
  }
  if (stage !== "desk" || renderer.domElement.dataset.busy === "1") { tooltip.style.display = "none"; return; }
  const hit = pickAt(e.clientX, e.clientY);
  if (hit) {
    tooltip.style.display = "block";
    tooltip.style.left = e.clientX + "px";
    tooltip.style.top = e.clientY + "px";
    tooltip.textContent = hit.userData.label || "open";
    renderer.domElement.style.cursor = "pointer";
  } else {
    tooltip.style.display = "none";
    renderer.domElement.style.cursor = "grab";
  }
  // Henry monitor hover: settling on the screen flies to MONITOR (2000ms custom cubic);
  // drifting off flies back to DESK (1000ms Quintic). Guarded so it never fights drags/flights.
  try {
    if (camManager && stage === "desk" && !flying && !desktopOpen && !downAt && !camTween && !camManager.tween) {
      if (hit && camManager.current === KEY.DESK && !camManager.target) {
        camManager.transition(KEY.MONITOR, 2000, HENRY_CUBIC, null, clockTime());
      } else if (!hit && camManager.current === KEY.MONITOR && !camManager.target) {
        camManager.transition(KEY.DESK, 1000, Easing.QuinticInOut, null, clockTime());
      }
    }
  } catch {}
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  downAt = [e.clientX, e.clientY];
  pointerDragged = false;
  // Original mousedown inComputer path (positional, vol .8). Only when desk stage + over macbook.
  if (stage === "desk" && !flying && e.button === 0) {
    try {
      const hit = pickAt(e.clientX, e.clientY);
      if (hit) audioManager?.playMouseDown(MOUSE_POS);
    } catch {}
  }
});
renderer.domElement.addEventListener("pointercancel", () => { downAt = null; pointerDragged = true; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt) return;
  const dx = e.clientX - downAt[0], dy = e.clientY - downAt[1];
  downAt = null;
  // Original mouseup inComputer path — fires even for drags/cancels on the computer.
  try {
    if (stage === "desk" && e.button === 0) {
      const hit = pickAt(e.clientX, e.clientY);
      if (hit) audioManager?.playMouseUp(MOUSE_POS);
    }
  } catch {}
  if (stage !== "desk" || flying || pointerDragged || e.button !== 0 || dx * dx + dy * dy > 25) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (hit) {
    if (hit.userData.action === "macbook") openMacOS(macTab);
    return;
  }
  // Henry mousedown toggle: empty-desk click swaps IDLE<->DESK (1000ms Quintic), like the original.
  try {
    if (camManager && !camTween && !camManager.tween && !desktopOpen) {
      if (camManager.current === KEY.DESK) camManager.transition(KEY.IDLE, 1000, Easing.QuinticInOut, null, clockTime());
      else if (camManager.current === KEY.IDLE) camManager.transition(KEY.DESK, 1000, Easing.QuinticInOut, null, clockTime());
    }
  } catch {}

});

/* ── Resize + loop ──────────────────────────────────────────── */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  desktopSurface.resize();
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  updateAtmosphere(t);

  if (camTween) {
    const kRaw = Math.min(1, (performance.now() - camTween.start) / camTween.durMs);
    const k = kRaw * kRaw * (3 - 2 * kRaw);
    camera.position.lerpVectors(camTween.fp, camTween.tp, k);
    controls.target.lerpVectors(camTween.ft, camTween.tt, k);
    if (kRaw >= 1) { const d = camTween.done; camTween = null; if (d) d(); }
  } else if (!flying && !desktopOpen) {
    // Henry keyframe follow: idle drift + desk parallax (camTween path stays for macOS flights).
    try {
      if (camManager && screenMeshRef && camManager.screenMesh !== screenMeshRef) {
        camManager.setScreenMesh(screenMeshRef);
      }
      camManager?.update(t);
    } catch {}
  }


  // Monitor-video stand-in shimmer (Henry's looping mp4s are gitignored/unavailable here).
  screenGlow.intensity = 3 + Math.sin(t * 1.8) * 0.4 + Math.sin(t * 13.7) * 0.08 + Math.sin(t * 7.3) * 0.06;

  controls.update();
  try { audioManager?.update(); } catch {} // office filter/vol follows camera, like original Yh.update()
  /* Overlay covers the canvas fullscreen: skip 3D work while it idles */
  const covered = desktopOpen && !camTween;
  if (!covered) {
    renderer.render(scene, camera);
    desktopSurface.render(camera);
  }
}
buildMacChrome();
renderMac();
animate();
