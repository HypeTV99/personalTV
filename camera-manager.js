// CameraManager — Henry Heffernan camera port, rescaled to this studio.
// Original (bundle): keyframes Sh { idle(-20k,12k,20k)/(0,-1k,0), monitor(0,950,2k)/(0,950,0),
//   desk(0,1800,5500)/(0,500,0), loading(-35k,35k,35k)/(0,-5k,0), orbitStart(-15k,10k,15k)/(-100,350,0) }
//   transition(name, dur, easing, done) with xh.removeAll() cancel; easings Quintic.InOut (default),
//   Exponential.Out (IDLE sweeps), custom cubic (.13,.99,0,1) (MONITOR 2000ms, freeCam 750ms).
//   Ah drift: x=sin(8e-5*(ms+19k))*ox, y=4000*sin(4e-6*(ms+1k))+oy-3000.
//   Th parallax: foc+=.05*(mouse-px-foc), pos+=.025*(mouse-px-pos), z=oz+3000*aspect-1800.
//   Mh aspect: z=oz+1200*aspect-(mobile?0:600). mousedown toggles IDLE<->DESK (unless prevent-click).
//
// Rescale (original units ~1000s, ours ~1-10, fog 9-24, controls 1.2-16):
//   LOADING (9.5,7.5,13.5)/(0,0.4,0)   — high sweep start, inside far plane
//   IDLE    WIDE (5.4,3.5,7.4)/(0,0.75,0) + drift ±0.35/±0.22 (Henry ±100%/±20% would leave frame)
//   DESK    (1.5,1.95,3.1)/(0,1.08,0.05) + parallax (px->world scaled: nx*0.18/nx*0.10, same .05/.025 lerp)
//   MONITOR computed from screen mesh + normal*dist (dist=clamp(1.05*aspect,1.0,2.2)), fallback (0,1.6,1.7)
//   ORBIT_START (4.8,3.4,6.4)/(0,0.7,0) — pulled-back 3/4 view for free-cam
import * as THREE from "three";

export const Easing = {
  QuinticInOut: (k) => (k < 0.5 ? 16 * k * k * k * k * k : 1 - Math.pow(-2 * k + 2, 5) / 2),
  ExponentialOut: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
};

// cubic-bezier(.13,.99,0,1) solver (Henry _h() preset) — standard BezierEasing impl.
export function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  function solveX(x) {
    let t = x;
    for (let i = 0; i < 4; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (lo < hi) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) return t;
      if (x > v) lo = t;
      else hi = t;
      t = (hi - lo) * 0.5 + lo;
      if (hi - lo < 1e-7) break;
    }
    return t;
  }
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveX(x)));
}
export const HENRY_CUBIC = cubicBezier(0.13, 0.99, 0, 1);

export const KEY = { IDLE: "idle", MONITOR: "monitor", LOADING: "loading", DESK: "desk", ORBIT_START: "orbitControlsStart" };

export class CameraManager {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.mouseNX = 0; // -1..1
    this.mouseNY = 0;
    this.screenMesh = null;
    this.current = KEY.LOADING;
    this.target = null;
    this.tween = null;
    this.base = {
      [KEY.LOADING]: { pos: new THREE.Vector3(9.5, 7.5, 13.5), tgt: new THREE.Vector3(0, 0.4, 0) },
      [KEY.IDLE]: { pos: new THREE.Vector3(5.4, 3.5, 7.4), tgt: new THREE.Vector3(0, 0.75, 0) },
      [KEY.DESK]: { pos: new THREE.Vector3(1.5, 1.95, 3.1), tgt: new THREE.Vector3(0, 1.08, 0.05) },
      [KEY.ORBIT_START]: { pos: new THREE.Vector3(4.8, 3.4, 6.4), tgt: new THREE.Vector3(0, 0.7, 0) },
    };
    // Live desk-follow state (Henry Th.targetFoc/targetPos persist across frames).
    this.deskFoc = this.base[KEY.DESK].tgt.clone();
    this.deskPos = this.base[KEY.DESK].pos.clone();
    window.addEventListener("pointermove", (e) => {
      this.mouseNX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      this.mouseNY = -(e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    });
  }

  setScreenMesh(mesh) {
    this.screenMesh = mesh;
  }

  aspect() {
    return window.innerWidth / window.innerHeight;
  }

  monitorFrame() {
    if (this.screenMesh) {
      this.screenMesh.updateWorldMatrix(true, false);
      const c = this.screenMesh.getWorldPosition(new THREE.Vector3());
      const q = this.screenMesh.getWorldQuaternion(new THREE.Quaternion());
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const dist = Math.min(Math.max(1.05 * this.aspect(), 1.0), 2.2);
      return { pos: c.clone().addScaledVector(n, dist), tgt: c.clone() };
    }
    const a = this.aspect();
    const d = Math.min(Math.max(1.05 * a, 1.0), 2.2);
    return { pos: new THREE.Vector3(0, 1.6, 0.4 + d), tgt: new THREE.Vector3(0, 1.35, 0) };
  }

  idleFrame(t) {
    const b = this.base[KEY.IDLE];
    return {
      pos: new THREE.Vector3(
        b.pos.x + 0.35 * Math.sin(0.08 * (t + 19)),
        b.pos.y + 0.22 * Math.sin(0.004 * (t + 1)) - 0.12,
        b.pos.z
      ),
      tgt: b.tgt.clone(),
    };
  }

  deskFrame() {
    const b = this.base[KEY.DESK];
    // Same .05/.025 lerp factors as Th; px range mapped to nx*0.18 / nx*0.10 world.
    this.deskFoc.x += 0.05 * (b.tgt.x + this.mouseNX * 0.18 - this.deskFoc.x);
    this.deskFoc.y += 0.05 * (b.tgt.y + this.mouseNY * 0.12 - this.deskFoc.y);
    this.deskFoc.z = b.tgt.z;
    this.deskPos.x += 0.025 * (b.pos.x + this.mouseNX * 0.1 - this.deskPos.x);
    this.deskPos.y += 0.025 * (b.pos.y + this.mouseNY * 0.07 - this.deskPos.y);
    // Aspect dolly: Henry z=oz+3000*aspect-1800 -> ours z=oz+(aspect-1.2)*0.8.
    this.deskPos.z = b.pos.z + (this.aspect() - 1.2) * 0.8;
    return { pos: this.deskPos.clone(), tgt: this.deskFoc.clone() };
  }

  frameFor(name, t) {
    if (name === KEY.IDLE) return this.idleFrame(t);
    if (name === KEY.DESK) return this.deskFrame();
    if (name === KEY.MONITOR) return this.monitorFrame();
    const b = this.base[name] || this.base[KEY.IDLE];
    return { pos: b.pos.clone(), tgt: b.tgt.clone() };
  }

  transition(name, durMs = 1000, easing = Easing.QuinticInOut, done = null, t = 0) {
    if (this.current === name && !this.tween) {
      if (done) done();
      return;
    }
    this.tween = null; // like xh.removeAll()
    this.current = undefined;
    this.target = name;
    const dest = this.frameFor(name, t);
    this.tween = {
      t0: performance.now(),
      durMs,
      fp: this.camera.position.clone(),
      tp: dest.pos,
      ft: this.controls.target.clone(),
      tt: dest.tgt,
      easing,
      done,
      name,
    };
  }

  cancelToManual() {
    this.tween = null;
    this.target = null;
  }

  update(t) {
    if (this.tween) {
      const tw = this.tween;
      const kRaw = Math.min(1, (performance.now() - tw.t0) / tw.durMs);
      const k = tw.easing(kRaw);
      this.camera.position.lerpVectors(tw.fp, tw.tp, k);
      this.controls.target.lerpVectors(tw.ft, tw.tt, k);
      if (kRaw >= 1) {
        this.current = tw.name;
        this.target = null;
        this.tween = null;
        if (tw.done) tw.done();
      }
      return;
    }
    // Settled: live-follow like Henry (idle drift + desk parallax), eased so no popping.
    if (this.current === KEY.IDLE) {
      const f = this.idleFrame(t);
      this.camera.position.lerp(f.pos, 0.06);
      this.controls.target.lerp(f.tgt, 0.08);
    } else if (this.current === KEY.DESK) {
      const f = this.deskFrame();
      this.camera.position.lerp(f.pos, 0.05);
      this.controls.target.lerp(f.tgt, 0.07);
    }
  }
}
