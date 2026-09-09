// AudioManager — 1:1 port of henryheffernan.com playback logic, rescaled to this scene.
// Original (bundle.cf64568055686c74.js):
//   Xh (computer): mousedown -> mouseDown {vol .8, pos (800,-300,1200)}
//                  mouseup   -> mouseUp   {vol .8, pos (800,-300,1200)}
//                  keydown real (inComputer) -> keyboardKeydown (random 1-6) {vol .8, pos (-300,-400,1200)}
//                  keydown _AUTO_ -> ccType {vol .1, pitch 20 -> detune 2000}
//   Yh (ambience): on loadingScreenDone -> office {vol 1, loop, lowpass 1000} + startup {vol .4} once
//                  per-frame: dist=|cam|, filter=map(dist,0..10000,100..22000)-3000, vol=clamp(map(dist,1200..10000,0..0.2),.05,.1)
//   $h: muteToggle -> listener.setMasterVolume(0/1), AudioContext.resume() on gesture.
//
// Rescale notes (original units ~1000s, ours ~1-10):
//   MOUSE_POS (0.8,1.1,0.8)  ~= (800,-300,1200)/1000 + desk height
//   KEY_POS   (-0.3,1.05,0.8) ~= (-300,-400,1200)/1000 + desk height
//   office filter/vol maps remapped from [0..10000]/[1200..10000] to [1.2..12]/[1.5..10]
//   so wide shot (~9.9 dist) = bright/loud, desk close-up (~3.9) = muffled/quiet — same feel.
import * as THREE from "three";

export const AUDIO_SOURCES = [
  { name: "mouseDown", path: "audio/mouse/mouse_down.mp3" },
  { name: "mouseUp", path: "audio/mouse/mouse_up.mp3" },
  { name: "keyboardKeydown1", path: "audio/keyboard/key_1.mp3" },
  { name: "keyboardKeydown2", path: "audio/keyboard/key_2.mp3" },
  { name: "keyboardKeydown3", path: "audio/keyboard/key_3.mp3" },
  { name: "keyboardKeydown4", path: "audio/keyboard/key_4.mp3" },
  { name: "keyboardKeydown5", path: "audio/keyboard/key_5.mp3" },
  { name: "keyboardKeydown6", path: "audio/keyboard/key_6.mp3" },
  { name: "startup", path: "audio/startup/startup.mp3" },
  { name: "office", path: "audio/atmosphere/office.mp3" },
  { name: "ccType", path: "audio/cc/type.mp3" },
];

export const MOUSE_POS = new THREE.Vector3(0.8, 1.1, 0.8);
export const KEY_POS = new THREE.Vector3(-0.3, 1.05, 0.8);

function mapValues(v, inMin, inMax, outMin, outMax) {
  return outMin + ((outMax - outMin) / (inMax - inMin)) * (v - inMin);
}

export class AudioManager {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.buffers = {}; // name -> AudioBuffer
    this.pool = {}; // id -> THREE.Audio
    this.poolSeq = 0;
    this.officeKey = null;
    this.ambienceStarted = false;
    this.muted = false;
    this.loaded = false;
    this._loadPromise = null;
  }

  preload() {
    if (this._loadPromise) return this._loadPromise;
    const loader = new THREE.AudioLoader();
    this._loadPromise = Promise.all(
      AUDIO_SOURCES.map(
        (s) =>
          new Promise((resolve) => {
            loader.load(
              s.path,
              (buf) => {
                this.buffers[s.name] = buf;
                resolve(true);
              },
              undefined,
              () => resolve(false)
            );
          })
      )
    ).then(() => {
      this.loaded = true;
    });
    return this._loadPromise;
  }

  unlock() {
    const ctx = this.listener.context;
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  getRandomVariant(base) {
    const keys = Object.keys(this.buffers).filter((k) => k.includes(base));
    if (!keys.length) return base;
    return keys[Math.floor(Math.random() * keys.length)];
  }

  setDetuneSafe(audioObj, cents) {
    try {
      if (typeof audioObj.setDetune === "function") audioObj.setDetune(cents);
      else if (audioObj.source && audioObj.source.detune)
        audioObj.source.detune.value = cents;
    } catch { /* ignore */ }
  }

  playAudio(baseName, opts = {}) {
    this.unlock();
    const name = this.getRandomVariant(baseName);
    const buf = this.buffers[name];
    if (!buf) return null;
    let sound;
    let anchor = null;
    if (opts.position) {
      sound = new THREE.PositionalAudio(this.listener);
      try {
        sound.setRefDistance(opts.refDistance || 2.5);
      } catch { /* older three */ }
      anchor = new THREE.Object3D();
      anchor.position.copy(opts.position);
      anchor.add(sound);
      this.scene.add(anchor);
    } else {
      sound = new THREE.Audio(this.listener);
    }
    sound.setBuffer(buf);
    if (opts.filter) {
      try {
        const ctx = this.listener.context;
        const flt = ctx.createBiquadFilter();
        flt.type = opts.filter.type || "lowpass";
        flt.frequency.setValueAtTime(opts.filter.frequency, ctx.currentTime);
        if (typeof sound.setFilter === "function") sound.setFilter(flt);
      } catch { /* ignore */ }
    }
    try {
      sound.setLoop(!!opts.loop);
    } catch { /* ignore */ }
    try {
      sound.setVolume(opts.volume ?? 1);
    } catch { /* ignore */ }
    try {
      sound.play();
    } catch {
      if (anchor) this.scene.remove(anchor);
      return null;
    }
    // Original detune: (200*rand-100) * (randDetuneScale ?? 0), plus 100*pitch.
    const scale = opts.randDetuneScale ?? 0;
    const rand = (200 * Math.random() - 100) * scale;
    if (rand) this.setDetuneSafe(sound, rand);
    if (opts.pitch) this.setDetuneSafe(sound, 100 * opts.pitch);
    const id = `${name}_${this.poolSeq++}`;
    this.pool[id] = { sound, anchor, positional: !!opts.position };
    const src = sound.source;
    if (src) {
      src.onended = () => {
        // Looped office never ends; one-shots get cleaned up like the original.
        if (this.pool[id]) {
          try {
            this.scene.remove(this.pool[id].anchor);
          } catch { /* ignore */ }
          try {
            this.pool[id].sound.stop();
          } catch { /* ignore */ }
          delete this.pool[id];
        }
      };
    }
    return id;
  }

  setAudioFilterFrequency(id, freq) {
    const entry = this.pool[id];
    if (!entry) return;
    try {
      const flt =
        typeof entry.sound.getFilter === "function" ? entry.sound.getFilter() : null;
      if (!flt) return;
      const ctx = this.listener.context;
      const v = Math.max(0, Math.min(22050, freq));
      flt.frequency.setValueAtTime(v, ctx.currentTime);
    } catch { /* ignore */ }
  }

  setAudioVolume(id, vol) {
    const entry = this.pool[id];
    if (!entry) return;
    try {
      entry.sound.setVolume(vol);
    } catch { /* ignore */ }
  }

  // === Same triggers as original, same order ===
  startAmbience() {
    if (this.ambienceStarted) return;
    this.ambienceStarted = true;
    const play = () => {
      this.officeKey = this.playAudio("office", {
        volume: 1,
        loop: true,
        randDetuneScale: 0,
        filter: { type: "lowpass", frequency: 1000 },
      });
      this.playAudio("startup", { volume: 0.4, randDetuneScale: 0 });
    };
    if (this.loaded) play();
    else this.preload().then(play);
  }

  playCcType() {
    // _AUTO_ path: {volume:.1, randDetuneScale:0, pitch:20}
    return this.playAudio("ccType", { volume: 0.1, randDetuneScale: 0, pitch: 20 });
  }

  playKeyboard() {
    // real keydown inComputer path: {volume:.8, position}
    return this.playAudio("keyboardKeydown", { volume: 0.8, position: KEY_POS });
  }

  playMouseDown(position = null) {
    if (position)
      return this.playAudio("mouseDown", { volume: 0.8, position });
    return this.playAudio("mouseDown", { volume: 0.4 });
  }

  playMouseUp(position = null) {
    if (position) return this.playAudio("mouseUp", { volume: 0.8, position });
    return this.playAudio("mouseUp", { volume: 0.4 });
  }

  setMuted(muted) {
    this.muted = !!muted;
    try {
      this.listener.setMasterVolume(this.muted ? 0 : 1);
    } catch {
      // Fallback for three builds without setMasterVolume:
      try {
        this.listener.gain.gain.value = this.muted ? 0 : 1;
      } catch { /* ignore */ }
    }
    return this.muted;
  }

  update() {
    if (!this.officeKey || !this.pool[this.officeKey]) return;
    const p = this.camera.position;
    const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    // Remapped from original map(r,0,10000,100,22000) / map(r,1200,10000,0,.2).
    const base = mapValues(r, 1.2, 12, 100, 22000);
    const o = mapValues(r, 1.5, 10, 0, 0.2);
    const vol = Math.min(Math.max(o, 0.05), 0.1);
    this.setAudioFilterFrequency(this.officeKey, base - 3000);
    this.setAudioVolume(this.officeKey, vol);
  }
}
