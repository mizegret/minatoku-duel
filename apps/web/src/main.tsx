import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

const el = document.getElementById('root');
if (!el) {
  throw new Error('#root not found');
}
const root = createRoot(el);
root.render(<App />);
