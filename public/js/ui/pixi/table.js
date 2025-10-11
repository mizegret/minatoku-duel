// Pixi side-view table drawing utilities
// Exports: mountFullTable({ PIXI, app, layers, spec? })

let tableNode = null;
let mounted = false;

export async function mountFullTable({ PIXI, app, layers, spec = {} }) {
  if (!PIXI || !app || !layers) return null;
  if (mounted && tableNode) return tableNode;

  // Default spec (tweakable from caller)
  const defaults = {
    centerYRate: 0.73, // 天板中心を画面高さの73%に配置
    top: { w: 520, h: 130, radius: 16, texture: null },
    leg: { w: 110, h: 80, color: 0x141b26, bevel: 0x233044, radius: 10 },
    base: { w: 300, h: 22, color: 0x0d141f, radius: 10 },
    shadow: { w: 520, h: 24, alpha: 0.35 }, // 楕円影
  };
  const cfg = merge(defaults, spec);

  // Clean previous if any
  if (tableNode) {
    try { layers.table?.removeChild(tableNode); } catch {}
    try { tableNode.destroy({ children: true }); } catch {}
    tableNode = null;
  }

  tableNode = new PIXI.Container();
  tableNode.interactive = false;
  tableNode.interactiveChildren = false;

  // Shadow (backmost)
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, cfg.shadow.alpha)
        .drawEllipse(0, 0, cfg.shadow.w / 2, cfg.shadow.h / 2)
        .endFill();
  shadow.y = 26; // a bit below the top center
  tableNode.addChild(shadow);

  // Leg with faux bevel
  const leg = new PIXI.Container();
  const legBack = new PIXI.Graphics()
    .beginFill(cfg.leg.bevel)
    .drawRoundedRect(-cfg.leg.w / 2, 6, cfg.leg.w, cfg.leg.h, cfg.leg.radius)
    .endFill();
  const legFront = new PIXI.Graphics()
    .beginFill(cfg.leg.color)
    .drawRoundedRect(-cfg.leg.w / 2 + 3, 6, cfg.leg.w - 6, cfg.leg.h - 4, cfg.leg.radius)
    .endFill();
  leg.addChild(legBack, legFront);
  tableNode.addChild(leg);

  // Base
  const base = new PIXI.Graphics();
  base.beginFill(cfg.base.color)
      .drawRoundedRect(-cfg.base.w / 2, cfg.leg.h + 2, cfg.base.w, cfg.base.h, cfg.base.radius)
      .endFill();
  tableNode.addChild(base);

  // Top: texture or graphics
  let topNode = null;
  if (cfg.top.texture) {
    try {
      const tex = await (PIXI.Assets?.load
        ? PIXI.Assets.load(cfg.top.texture)
        : PIXI.Texture.fromURL(cfg.top.texture));
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(cfg.top.w / tex.width, cfg.top.h / tex.height);
      topNode = sp;
    } catch {
      topNode = null; // fallback to graphics below
    }
  }
  if (!topNode) {
    const g = new PIXI.Graphics()
      .beginFill(0x0a101a, 1)
      .drawRoundedRect(-cfg.top.w / 2, -cfg.top.h / 2, cfg.top.w, cfg.top.h, cfg.top.radius)
      .endFill();
    topNode = g;
  }
  const edge = new PIXI.Graphics()
    .lineStyle(3, 0x1f2c3c, 1)
    .drawRoundedRect(-cfg.top.w / 2, -cfg.top.h / 2, cfg.top.w, cfg.top.h, cfg.top.radius);
  const highlight = new PIXI.Graphics()
    .beginFill(0xffffff, 0.06)
    .drawRoundedRect(-cfg.top.w / 2, -cfg.top.h / 2, cfg.top.w, cfg.top.h * 0.22, cfg.top.radius)
    .endFill();

  tableNode.addChild(topNode, edge, highlight);

  // Attach to layer
  (layers.table || layers.root || app.stage).addChild(tableNode);

  // Initial layout + listeners
  positionFullTable({ app, node: tableNode, cfg });
  const onLayout = () => positionFullTable({ app, node: tableNode, cfg });
  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, { passive: true });

  mounted = true;
  return tableNode;
}

export function positionFullTable({ app, node, cfg }) {
  if (!app || !node) return;
  const w = app.renderer.width;
  const h = app.renderer.height;
  node.x = Math.floor(w / 2);
  node.y = Math.floor(h * cfg.centerYRate);

  // Responsive scale: keep margins on small screens
  const baseSpan = Math.max(cfg.top.w, cfg.shadow.w);
  const target = Math.min(w, h);
  const scale = clamp(0.6, 1, target / (baseSpan + 180));
  node.scale.set(scale, scale);
}

function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
function merge(a, b) { const o = { ...a }; for (const k in b) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v; } return o; }

