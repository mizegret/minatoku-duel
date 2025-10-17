# VRM / VRMA 取扱いガイド v0.1（準備）

目的

- VRM アバターと VRMA モーションを一貫して扱うための方針と最小仕様。

前提

- Three.js + react-three-fiber（R3F）。
- ローダ: `GLTFLoader` + VRM 拡張対応（`VRMC_vrm`, `VRMC_materials_mtoon`）。
- VRMA は VRM Animation（`.vrma`）。アニメーション→Humanoid にレタゲ。

基本方針

- 形式: VRM 1.0 を優先（0.x は互換措置）。
- 読み込み: 3D アセットは遅延ロード。`meshopt`/`ktx2` は将来導入。
- 実体: `Avatar`（VRM インスタンス）と `Motion`（VRMA）を分離。

最小インタフェース（擬似型）

```ts
type AvatarHandle = {
  vrm: any; // VRM instance
  scene: THREE.Object3D;
  ready: Promise<void>;
  dispose(): void;
};

type MotionHandle = {
  clip: THREE.AnimationClip;
  play(loop?: boolean): void;
  stop(): void;
  dispose(): void;
};
```

ロード/再生の流れ（設計）

1. `loadAvatar(url)` → `AvatarHandle`
2. `loadMotion(url)` → `MotionHandle`
3. `bindMotion(avatar, motion)` → Humanoid にレタゲ → `play()`
4. `dispose()` は Three リソース解放を徹底

運用

- アセットは CDN 配信（ハッシュ名、長期キャッシュ）。
- 許容サイズ目安: 単体 VRM ≤ 20MB、VRMA ≤ 5MB（将来最適化）。
- 著作権/ライセンス情報を `assets/README.md` に明記（同梱しない場合はURL）。
