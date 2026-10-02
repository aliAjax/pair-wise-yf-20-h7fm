import type {
  Batch,
  Conflict,
  FiringRow,
  MusicMarker,
  Plan,
  Position,
  PositionStat,
  Product,
  QueuedBatch,
  Segment,
} from "./types";

/* ---------- 时间工具 ---------- */

export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d+):)?(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (!m) return null;
  const min = Number(m[1] ?? 0);
  const sec = Number(m[2]);
  const fracText = m[3] ?? "0";
  const frac = Number(fracText.padEnd(3, "0").slice(0, 3));
  if (sec >= 60) return null;
  return min * 60_000 + sec * 1000 + frac;
}

export function formatTime(ms: number): string {
  const v = Math.max(0, Math.round(ms));
  const min = Math.floor(v / 60_000);
  const sec = Math.floor((v % 60_000) / 1000);
  const frac = v % 1000;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
}

export function signedOffset(ms: number): string {
  const sign = ms >= 0 ? "+" : "-";
  return `${sign}${formatTime(Math.abs(ms)).slice(3)}`;
}

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

/* ---------- 型号与点位 ---------- */

export const PRODUCTS: Product[] = [
  { id: "p_fan30", name: "30mm扇形架", kind: "扇形架", caliberMm: 30, angleDeg: 15, durationMs: 9000, safeDistanceM: 25 },
  { id: "p_shell75", name: "75mm礼花弹", kind: "礼花弹", caliberMm: 75, angleDeg: 0, durationMs: 6000, safeDistanceM: 80 },
  { id: "p_cold", name: "冷焰火", kind: "冷焰火", caliberMm: 8, angleDeg: 0, durationMs: 12000, safeDistanceM: 5 },
  { id: "p_roman", name: "20mm罗马烛光", kind: "罗马烛光", caliberMm: 20, angleDeg: 10, durationMs: 8000, safeDistanceM: 20 },
];

export const POSITIONS: Position[] = [
  { id: "pos_a", name: "A点·近景台", x: 120, y: 40, capacity: 2, note: "舞台前沿" },
  { id: "pos_b", name: "B点·中场", x: 70, y: 110, capacity: 3 },
  { id: "pos_c", name: "C点·后场", x: 160, y: 150, capacity: 2 },
];

/* ---------- 初始方案 ---------- */

export function createInitialPlan(): Plan {
  const markers: MusicMarker[] = [
    { id: "mk_intro", timeMs: 12_500, label: "Intro 起拍" },
    { id: "mk_chorus", timeMs: 68_200, label: "Chorus A 重音" },
    { id: "mk_finale", timeMs: 222_000, label: "Finale 收尾" },
  ];
  const segments: Segment[] = [
    { id: "seg_intro", markerId: "mk_intro", title: "Intro", durationMs: 24_000 },
    { id: "seg_chorus", markerId: "mk_chorus", title: "Chorus A", durationMs: 60_000 },
    { id: "seg_finale", markerId: "mk_finale", title: "Finale", durationMs: 18_000 },
  ];
  const batches: Batch[] = [
    { id: "b1", markerId: "mk_intro", positionId: "pos_b", productId: "p_fan30", offsetMs: 0, angleOverride: null },
    // A 点容量 2，第三个批次排队 9.0s（扇形架占用 9s）
    { id: "b2", markerId: "mk_finale", positionId: "pos_a", productId: "p_cold", offsetMs: 0, angleOverride: null, note: "近景区待确认" },
    { id: "b3", markerId: "mk_finale", positionId: "pos_a", productId: "p_cold", offsetMs: 0, angleOverride: null },
    { id: "b4", markerId: "mk_finale", positionId: "pos_a", productId: "p_fan30", offsetMs: 0, angleOverride: null },
    { id: "b5", markerId: "mk_chorus", positionId: "pos_c", productId: "p_shell75", offsetMs: 200, angleOverride: null },
    { id: "b6", markerId: "mk_chorus", positionId: "pos_b", productId: "p_roman", offsetMs: 0, angleOverride: 12 },
  ];
  return { products: PRODUCTS, positions: POSITIONS, markers, segments, batches, version: 1 };
}

/* ---------- 重算引擎 ---------- */

const byId = <T extends { id: string }>(list: T[]) => {
  const m = new Map<string, T>();
  list.forEach((x) => m.set(x.id, x));
  return m;
};

/**
 * 点位通道排队：同一时点并发批次超出容量时，按通道最早空闲时间贪心分配，
 * 后续批次顺延到先前段的点火+占用时长结束之后。
 */
export function computeQueue(plan: Plan): Map<string, QueuedBatch> {
  const markers = byId(plan.markers);
  const products = byId(plan.products);
  const result = new Map<string, QueuedBatch>();

  const groups = new Map<string, Batch[]>();
  plan.batches.forEach((b) => {
    const g = groups.get(b.positionId) ?? [];
    g.push(b);
    groups.set(b.positionId, g);
  });

  groups.forEach((batches, positionId) => {
    const channels = plan.positions.find((p) => p.id === positionId)?.capacity ?? 1;
    // 按期望点火时间排序，稳定顺序
    const ordered = batches
      .map((b) => ({ b, want: (markers.get(b.markerId)?.timeMs ?? 0) + b.offsetMs }))
      .sort((a, z) => a.want - z.want || a.b.id.localeCompare(z.b.id));

    const freeAt = new Array<number>(channels).fill(-Infinity);
    ordered.forEach(({ b, want }) => {
      const occupy = products.get(b.productId)?.durationMs ?? 0;
      let ch = 0;
      for (let i = 1; i < channels; i += 1) {
        if (freeAt[i] < freeAt[ch]) ch = i;
      }
      const fireTime = Math.max(want, freeAt[ch]);
      const queueDelayMs = fireTime - want;
      const waitFor: string[] = [];
      if (queueDelayMs > 0) {
        ordered.forEach((other) => {
          if (other.b.id === b.id) return;
          const otherWant = other.want;
          const otherEnd = otherWant + (products.get(other.b.productId)?.durationMs ?? 0);
          if (otherWant < fireTime && otherEnd > want + 0.5) waitFor.push(other.b.id);
        });
      }
      freeAt[ch] = fireTime + occupy;
      result.set(b.id, { batch: b, queueDelayMs, fireTimeMs: fireTime, waitFor });
    });
  });

  return result;
}

export function computeRows(plan: Plan, queue: Map<string, QueuedBatch>): FiringRow[] {
  const markers = byId(plan.markers);
  const products = byId(plan.products);
  const positions = byId(plan.positions);
  const segByMarker = new Map<string, Segment>();
  plan.segments.forEach((s) => {
    if (!segByMarker.has(s.markerId)) segByMarker.set(s.markerId, s);
  });

  return plan.batches
    .map((b) => {
      const q = queue.get(b.id);
      const product = products.get(b.productId);
      const position = positions.get(b.positionId);
      if (!q || !product || !position) return null;
      return {
        ...q,
        id: b.id,
        markerId: b.markerId,
        positionId: b.positionId,
        segmentTitle: segByMarker.get(b.markerId)?.title ?? markers.get(b.markerId)?.label ?? "未命名段落",
        position,
        product,
        angleDeg: b.angleOverride ?? product.angleDeg,
        safeDistanceM: product.safeDistanceM,
      };
    })
    .filter((x): x is FiringRow => x !== null)
    .sort((a, z) => a.fireTimeMs - z.fireTimeMs || a.id.localeCompare(z.id));
}

export function computePositionStats(plan: Plan, rows: FiringRow[]): PositionStat[] {
  return plan.positions.map((position) => {
    const rs = rows.filter((r) => r.positionId === position.id);
    const maxCaliber = rs.reduce((m, r) => Math.max(m, r.product.caliberMm), 0);
    const requiredSafeM = rs.reduce((m, r) => Math.max(m, r.safeDistanceM), 0);
    const angles = Array.from(new Set(rs.map((r) => r.angleDeg))).sort((a, z) => a - z);
    return {
      position,
      maxCaliber,
      requiredSafeM,
      audienceGapM: position.y - requiredSafeM,
      angles,
      batchCount: rs.length,
    };
  });
}

/**
 * 冲突检测：
 *  - queue  点位容量不足，批次排队
 *  - safety 点位距观众纵深 < 该点最大要求安全距离
 *  - overlap 同一点位通道未释放时再次点火（排队已覆盖，此处提示跨型号叠加）
 */
export function computeConflicts(plan: Plan, queue: Map<string, QueuedBatch>, rows: FiringRow[]): Conflict[] {
  const products = byId(plan.products);
  const conflicts: Conflict[] = [];

  queue.forEach((q) => {
    if (q.queueDelayMs <= 0) return;
    const product = products.get(q.batch.productId);
    conflicts.push({
      id: `q_${q.batch.id}`,
      kind: "queue",
      level: "warn",
      markerId: q.batch.markerId,
      positionId: q.batch.positionId,
      batchIds: [q.batch.id, ...q.waitFor],
      message: `${q.batch.positionId} 点位容量不足：${product?.name ?? "批次"} 排队 ${(q.queueDelayMs / 1000).toFixed(1)}s（通道被先点火批次占用）`,
    });
  });

  computePositionStats(plan, rows).forEach((stat) => {
    if (stat.batchCount === 0) return;
    if (stat.audienceGapM < 0) {
      conflicts.push({
        id: `s_${stat.position.id}`,
        kind: "safety",
        level: "danger",
        positionId: stat.position.id,
        batchIds: rows.filter((r) => r.positionId === stat.position.id).map((r) => r.id),
        message: `${stat.position.name} 纵深 ${stat.position.y}m < 最大要求安全距离 ${stat.requiredSafeM}m（最大口径 ${stat.maxCaliber}mm），差 ${Math.abs(stat.audienceGapM)}m`,
      });
    }
  });

  // 同一点位、时间窗口交叠且口径不同的批次叠加提示
  const byPos = new Map<string, FiringRow[]>();
  rows.forEach((r) => {
    const g = byPos.get(r.positionId) ?? [];
    g.push(r);
    byPos.set(r.positionId, g);
  });
  byPos.forEach((rs, positionId) => {
    for (let i = 0; i < rs.length; i += 1) {
      for (let j = i + 1; j < rs.length; j += 1) {
        const a = rs[i];
        const z = rs[j];
        if (a.fireTimeMs + a.product.durationMs <= z.fireTimeMs) continue;
        if (a.product.caliberMm === z.product.caliberMm) continue;
        conflicts.push({
          id: `o_${a.id}_${z.id}`,
          kind: "overlap",
          level: "warn",
          positionId,
          batchIds: [a.id, z.id],
          message: `${a.position.name}：${a.product.name} 与 ${z.product.name} 点火窗口交叠，口径不同请确认上空区域`,
        });
      }
    }
  });

  return conflicts.sort((a, z) => {
    if (a.level !== z.level) return a.level === "danger" ? -1 : 1;
    return a.id.localeCompare(z.id);
  });
}

/* ---------- 方案总览数字 ---------- */

export function planDuration(plan: Plan, rows: FiringRow[]): number {
  const lastFire = rows.reduce((m, r) => Math.max(m, r.fireTimeMs + r.product.durationMs), 0);
  const lastSegment = plan.segments.reduce((m, s) => {
    const marker = plan.markers.find((mk) => mk.id === s.markerId);
    return Math.max(m, (marker?.timeMs ?? 0) + s.durationMs);
  }, 0);
  return Math.max(lastFire, lastSegment, 240_000);
}

export function markerBatches(plan: Plan): Map<string, Batch[]> {
  const m = new Map<string, Batch[]>();
  plan.batches.forEach((b) => {
    const g = m.get(b.markerId) ?? [];
    g.push(b);
    m.set(b.markerId, g);
  });
  return m;
}
