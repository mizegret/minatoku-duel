import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';

function Grid() {
  return <gridHelper args={[20, 20, '#aaa', '#ddd']} position={[0, 0, 0]} />;
}

function Player({ position = [0, 0, 0] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#0a7" />
    </mesh>
  );
}

export default function Scene({ pos }) {
  const scale = 0.05;
  const p = [pos.x * scale, pos.y * scale, 0];
  return (
    <Canvas camera={{ position: [0, 6, 6], fov: 60 }} style={{ width: '100%', height: 420, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} />
      <Suspense fallback={null}>
        <Grid />
        <Player position={p} />
      </Suspense>
    </Canvas>
  );
}
