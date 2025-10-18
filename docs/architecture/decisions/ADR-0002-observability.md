# ADR-0002: 観測性（計測点の標準化）

ステータス

- Accepted — 2025-10-18

決定

- `performance.mark/measure` を用いた計測点の名称を先に確定し、Switch以降に段階導入する。
- 送信収集は当面行わず、ローカル計測から始める。

根拠

- 3D/通信/UI の相互作用でデグレ検知が困難。名寄せされた計測点が必要。

影響

- 初期導入の微コスト。長期では回帰検知とパフォーマンス予算管理が容易。

参照

- `docs/observability/performance-marks.md`
