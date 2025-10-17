# ADR-0001: フレームワーク選定（Vite + React + TypeScript + react-three-fiber）

ステータス

- Accepted — 2025-10-17

文脈

- リアルタイム通信（Ably）と 3D 表現（VRM/Three.js）を長期運用する。
- 既存はバニラESM中心。UI・状態・3D・ネットワークの複雑度が上がり保守コストが増加。

決定

- Vite + React 18 + TypeScript をアプリ基盤とする。
- Three.js は react-three-fiber（以下 R3F）+ Drei を採用。
- 2D は Three のオルソ/スプライトに統一。Pixi は採用しない。

理由

- エコシステムの成熟（ドキュメント/知見/採用事例）。
- R3F による Three の宣言的記述とコンポーネント分解。
- Vite の高速ビルド/分割・HMR、TS による契約の型安全化。

代替案の評価

- Svelte + Threlte: 軽量で直感的。事例/周辺が R3F に劣る。
- Solid + solid-three/fiber: 高速・軽量。実戦知見と周辺の厚みが限定的。
- Vue + TroisJS: 3D 周辺の厚みが相対的に弱い。
- 継続してバニラESM: 短期は可能だが長期運用と人員合流に不利。

影響/トレードオフ

- 学習/移行コストの発生。ただし保守性/拡張性で回収見込み。
- 初期バンドル増加はコード分割/遅延ロードで吸収可能。

実施計画（段階）

- Phase 1: ドキュメントのみ（本ADR、技術要件、契約）。
- SWITCH: Vite + React + TS + R3F 初期スケルトン導入、契約テストを併設。
