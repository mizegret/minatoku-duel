import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

export default function Avatar({ url = '/assets/vrm/sample.vrm' }: { url?: string }) {
  const group = useRef<THREE.Group>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useThree();

  useEffect(() => {
    let disposed = false;
    async function loadVRM() {
      try {
        const [{ VRM }, { GLTFLoader }]: any = await Promise.all([
          import('@pixiv/three-vrm'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
        ]);
        const loader = new GLTFLoader();
        loader.crossOrigin = 'anonymous';
        loader.load(
          url,
          async (gltf: any) => {
            if (disposed) return;
            const vrm = await VRM.from(gltf);
            if (disposed) return;
            vrm.scene.position.set(0, 0, 0);
            vrm.scene.scale.setScalar(1.0);
            group.current?.add(vrm.scene);
            setLoaded(true);
          },
          undefined,
          (e: unknown) => {
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
    };
  }, [url]);

  if (error || !loaded) {
    return (
      // @ts-expect-error: r3f reconciler accepts plain objects
      <group ref={group}>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#0a7" />
        </mesh>
      </group>
    );
  }
  // @ts-expect-error: r3f reconciler accepts plain objects
  return <group ref={group} />;
}
