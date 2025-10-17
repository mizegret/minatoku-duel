import React from 'react';

export default function App() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 320px',
        minHeight: '100vh',
        gap: '16px',
        padding: '16px',
      }}
    >
      <aside style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>Left: Info</aside>
      <main style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        Center: Scene (R3F later)
      </main>
      <aside style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>Right: Log</aside>
    </div>
  );
}
