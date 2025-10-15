// Motion helpers for VRM overlay (three.js)
// - Small utilities to keep avatar.js lean and make future moves configurable.

export function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function shortestArcDelta(a, b) {
  let d = (b - a + Math.PI) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return d - Math.PI;
}

// Creates a tween that walks the avatar from off-screen to the center.
// opts: { durationSec=5, margin=0.15, rightward=true, faceTravel=true, finalFacing='camera' }
export function createWalkInTween({ obj, camera, opts = {} }) {
  const durationSec = Number.isFinite(opts.durationSec) ? Math.max(0.1, opts.durationSec) : 5;
  const margin = Number.isFinite(opts.margin) ? Math.max(0, opts.margin) : 0.15;
  const rightward = opts.rightward !== false; // default true (left -> center)
  const faceTravel = opts.faceTravel !== false; // default true
  const finalFacing = typeof opts.finalFacing === 'string' ? opts.finalFacing : 'camera';

  const halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
  const halfW = halfH * (camera.aspect || 1.6);
  const startX = (rightward ? -1 : 1) * (halfW + margin);
  const endX = 0;

  const originalYaw = obj.rotation.y;
  // With VRM forward = -Z, to face +X we yaw -90deg; to face -X we yaw +90deg
  const yawTravel = faceTravel ? (rightward ? -Math.PI / 2 : Math.PI / 2) : originalYaw;

  try {
    obj.position.x = startX;
    obj.visible = true;
  } catch {}

  const t0 = performance.now();
  const d = durationSec * 1000;

  return {
    update: (now) => {
      const t = Math.min(1, (now - t0) / d);
      const x = startX + (endX - startX) * t;
      obj.position.x = x;
      if (faceTravel) {
        const rt = Math.min(1, t / 0.2);
        obj.rotation.y = originalYaw + shortestArcDelta(originalYaw, yawTravel) * smoothstep(rt);
      }
      return t < 1;
    },
    done: () => {
      if (finalFacing === 'camera') {
        const backStart = performance.now();
        const backDur = 240;
        const startYaw = obj.rotation.y;
        const backTarget = 0; // face -Z
        return {
          update: (now) => {
            const tt = Math.min(1, (now - backStart) / backDur);
            obj.rotation.y = startYaw + shortestArcDelta(startYaw, backTarget) * smoothstep(tt);
            return tt < 1;
          },
        };
      }
      return null;
    },
  };
}

