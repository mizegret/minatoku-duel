// Minimal VRM0 viewer (three r152 + three-vrm v2)
// - No pose/animation. Just load and render.
// - Appends a transparent canvas over #canvas-center.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as VRM from '@pixiv/three-vrm';
// MToon / VRM0 compat plugins are loaded lazily inside loadAvatar()

let root, renderer, scene, camera, currentVRM, clock;

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

export async function loadAvatar(url) {
  if (!url || !/\.vrm(\?.*)?$/i.test(url)) return false;
  const loader = new GLTFLoader();
  // Stable pipeline for VRM0 (plugins optional; load lazily so import failures don't break init)
  try {
    const [{ VRMMaterialsV0CompatPlugin }, { MToonMaterialLoaderPlugin }] = await Promise.all([
      import('@pixiv/three-vrm-materials-v0compat'),
      import('@pixiv/three-vrm-materials-mtoon'),
    ]);
    loader.register((p) => new VRMMaterialsV0CompatPlugin(p));
    loader.register((p) => new MToonMaterialLoaderPlugin(p));
  } catch {}
  loader.register((p) => new VRM.VRMLoaderPlugin(p));

  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const vrm = gltf.userData.vrm;
      VRM.VRMUtils.rotateVRM0(vrm);
      VRM.VRMUtils.removeUnnecessaryJoints(vrm.scene);

      if (currentVRM) { try { scene.remove(currentVRM.scene); } catch {} }
      currentVRM = vrm;
      scene.add(vrm.scene);
      fitToView();
      resolve(true);
    }, undefined, (e) => reject(e));
  });
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
  renderer.render(scene, camera);
}
