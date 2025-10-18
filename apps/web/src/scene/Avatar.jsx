import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

export default function Avatar({ url = '/assets/vrm/sample.vrm' }) {
  const group = useRef();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const { scene } = useThree();

  useEffect(() => {
    let disposed = false;
    async function loadVRM() {
      try {
        const [{ VRM }, { GLTFLoader }] = await Promise.all([
          import('@pixiv/three-vrm'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
        ]);
        const loader = new GLTFLoader();
        loader.crossOrigin = 'anonymous';
        loader.load(
          url,
          async (gltf) => {
            if (disposed) return;
            const vrm = await VRM.from(gltf);
            if (disposed) return;
            // 位置とスケールを少し調整
            vrm.scene.position.set(0, 0, 0);
            vrm.scene.scale.setScalar(1.0);
            group.current?.add(vrm.scene);
            setLoaded(true);
          },
          undefined,
          (e) => {
            console.warn('VRM load failed, fallback to sphere', e);
            setError(e);
          }
        );
      } catch (e) {
        console.warn('VRM modules failed, fallback', e);
        setError(e);
      }
    }
    loadVRM();
    return () => {
      disposed = true;
      // three objects will be GCed with scene; keep minimal
    };
  }, [url, scene]);

  if (error || !loaded) {
    return (
      <group ref={group}>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#0a7" />
        </mesh>
      </group>
    );
  }
  return <group ref={group} />;
}
