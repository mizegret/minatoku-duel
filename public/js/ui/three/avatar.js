// Minimal VRM viewer (three r152 + three-vrm v3)
// - No pose/animation. Just load and render.
// - Appends a transparent canvas over #canvas-center.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// motion helpers are not needed for in-place playback
// Import VRM at runtime to allow CDN fallback if the primary URL mis-serves MIME/CORS
// MToon / VRM0 compat plugins are loaded lazily inside loadAvatar()

let root, renderer, scene, camera, currentVRM, clock;
// debug flags removed per request
let mixer = null;
let activeAction = null;
let activeClip = null;
// no tweens (in-place only)

function hostEl() {
  const host = document.getElementById('canvas-center') || document.body;
  if (host && getComputedStyle(host).position === 'static') host.style.position = 'relative';
  return host;
}

export async function ensureAvatarLayer() {
  if (renderer) { attach(); resize(); return; }

  // colorspace chunk safeguard (some CDN builds miss these includes)
  try {
    const SC = THREE.ShaderChunk || {};
    if (!SC.colorspace_pars_fragment) THREE.ShaderChunk.colorspace_pars_fragment = '';
    if (!SC.colorspace_fragment) THREE.ShaderChunk.colorspace_fragment = '';
  } catch {}

  // Reuse existing #three-root if present (renderer.js may have created it)
  root = document.getElementById('three-root') || document.createElement('div');
  if (!root.id) root.id = 'three-root';
  Object.assign(root.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '10' });
  if (root.parentElement !== hostEl()) hostEl().appendChild(root);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  root.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.5);
  scene.add(camera);

  // simple light
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  clock = new THREE.Clock();
  
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', resize, { passive: true });
  resize();
  tick();
}

export async function loadAvatar(url, opts = {}) {
  if (!url || !/\.vrm(\?.*)?$/i.test(url)) return false;
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  // Resolve VRM loader from import map or fallback to esm.sh when CDN headers are wrong
  let VRMLoaderPlugin, VRMUtils;
  try {
    ({ VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm'));
  } catch (e) {
    ({ VRMLoaderPlugin, VRMUtils } = await import('https://esm.sh/@pixiv/three-vrm@3?deps=three@0.152.2'));
  }
  loader.register((p) => new VRMLoaderPlugin(p));

  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (vrm?.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
  try { VRMUtils.removeUnnecessaryJoints?.(vrm.scene); } catch {}

  if (currentVRM) { try { scene.remove(currentVRM.scene); } catch {} }
  currentVRM = vrm;
  scene.add(vrm.scene);
  fitToView();
  // reset animation state for new avatar
  try { mixer?.stopAllAction?.(); } catch {}
  mixer = new THREE.AnimationMixer(vrm.scene);
  
  activeAction = null;
  activeClip = null;
  if (opts && opts.visible === false) {
    try { currentVRM.scene.visible = false; } catch {}
  }
  return true;
}

// Load a .vrma file and prepare an AnimationAction on the current VRM.
// Returns true if loaded; false if not supported/failed.
export async function loadVrma(url, opts = {}) {
  if (!currentVRM || !url || !/\.vrma(\?.*)?$/i.test(url)) return false;
  let VRMAnimationLoaderPlugin, createVRMAnimationClip;
  try {
    ({ VRMAnimationLoaderPlugin } = await import('@pixiv/three-vrm'));
  } catch (_) {}
  // In v3 the animation helpers live in a separate entry: @pixiv/three-vrm-animation
  try {
    const mod = await import('@pixiv/three-vrm-animation');
    createVRMAnimationClip = mod.createVRMAnimationClip || mod.createVRMAnimationClipFromVRM;
    if (!VRMAnimationLoaderPlugin && mod.VRMAnimationLoaderPlugin) {
      VRMAnimationLoaderPlugin = mod.VRMAnimationLoaderPlugin;
    }
  } catch (_) {
    const mod = await import('https://esm.sh/@pixiv/three-vrm-animation@3?deps=three@0.152.2');
    createVRMAnimationClip = mod.createVRMAnimationClip || mod.createVRMAnimationClipFromVRM;
    if (!VRMAnimationLoaderPlugin && mod.VRMAnimationLoaderPlugin) {
      VRMAnimationLoaderPlugin = mod.VRMAnimationLoaderPlugin;
    }
  }
  if (!createVRMAnimationClip) return false;

  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  try { if (VRMAnimationLoaderPlugin) loader.register((p) => new VRMAnimationLoaderPlugin(p)); } catch {}
  let vrma;
  try {
    const gltf = await loader.loadAsync(url);
    const list = gltf.userData?.vrmAnimations;
    vrma = Array.isArray(list) ? list[0] : null;
  } catch {
    return false;
  }
  if (!vrma) return false;

  // Convert to a THREE.AnimationClip bound to this VRM
  const clip = createVRMAnimationClip(vrma, currentVRM);
  if (!clip) return false;
  if (!mixer) mixer = new THREE.AnimationMixer(currentVRM.scene);
  try { activeAction?.stop(); } catch {}
  activeClip = clip;
  activeAction = mixer.clipAction(clip);
  try { activeAction.reset(); } catch {}
  if (typeof activeAction.setLoop === 'function') activeAction.setLoop(THREE.LoopRepeat, Infinity);
  activeAction.clampWhenFinished = false;
  activeAction.enabled = true;
  if (Number.isFinite(opts.rate)) { try { activeAction.timeScale = opts.rate; } catch {} }
  try { activeAction.reset(); } catch {}
  activeAction.play();
  
  return true;
}

// Walk from the left edge into the center while playing a VRMA.
// Options: { durationSec=3, margin=0.15 }
// walkToCenter removed (in-place verification mode only)

// Play walking animation without translating the avatar (verification step).
export async function playWalkInPlace(vrmaUrl, opts = {}) {
  if (!currentVRM) return false;
  const ok = await loadVrma(vrmaUrl, { rate: Number.isFinite(opts.rate) ? opts.rate : undefined }).catch(() => false);
  try { currentVRM.scene.visible = true; } catch {}
  return ok;
}

function attach() {
  if (!root) return;
  const host = hostEl();
  if (root.parentElement !== host) host.appendChild(root);
}

function fitToView() {
  if (!currentVRM) return;
  currentVRM.scene.updateMatrixWorld(true);
  // scale avatar to ~1.6 units tall, then frame it
  const box = new THREE.Box3().setFromObject(currentVRM.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(0.001, size.y);
  const target = 1.6;
  const s = target / h;
  currentVRM.scene.scale.setScalar(s);
  currentVRM.scene.position.set(0, 0, 0);
}

function resize() {
  if (!renderer) return;
  attach();
  const r = hostEl().getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width));
  const h = Math.max(1, Math.floor(r.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

function tick() {
  requestAnimationFrame(tick);
  const delta = clock.getDelta();
  if (currentVRM?.update) currentVRM.update(delta);
  try { mixer?.update?.(delta); } catch {}
  renderer.render(scene, camera);
}
