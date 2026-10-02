import type { Batch, Model, MusicPoint, Plan, Position } from "./types";

/** 一个排定后的批次（派生字段全部由 plan 计算得出） */
export interface ScheduledBatch {
  batch: Batch;
  musicPoint: MusicPoint;
  model: Model;
  position: Position;
  /** 绑定音乐点时间 + 人工偏移 */
  desiredTime: number;
  /** 排队顺延之後的实际点火时间 */
  time: number;
  /** 是否因点位容量不足被排队顺延 */
  queued: boolean;
  /** 有效发射角度（已按点位范围钳制） */
  angle: number;
  angleClamped: boolean;
  caliber: number;
  caliberOk: boolean;
  safetyDistance: number;
  safetyOk: boolean;
}

export interface PositionStat {
  position: Position;
  rows: ScheduledBatch[];
  waves: { time: number; rows: ScheduledBatch[] }[];
  load: number;
  queued: number;
  overCapacity: boolean;
  caliberMismatch: boolean;
  angleClamped: boolean;
  safetyMismatch: boolean;
}

export interface Conflict {
  id: string;
  level: "warn" | "error";
  batchId: string;
  positionId: string;
  message: string;
}

export interface DerivedPlan {
  scheduled: ScheduledBatch[];
  positionStats: PositionStat[];
  conflicts: Conflict[];
  totalDuration: number;
  segmentCount: number;
  batchCount: number;
  queuedCount: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** 同时刻判定窗口（秒） */
const SIMUL_EPS = 0.06;

/** 由方案派生全部火力计划（时间、排队、校验） */
export function derive(plan: Plan): DerivedPlan {
  const mpById = new Map(plan.musicPoints.map((m) => [m.id, m]));
  const modelById = new Map(plan.models.map((m) => [m.id, m]));

  // 1. 计算每个批次的期望点火时间（音乐点 + 人工偏移）
  const rows = plan.batches.map((batch) => {
    const musicPoint = mpById.get(batch.musicPointId);
    const model = modelById.get(batch.modelId);
    const position = plan.positions.find((p) => p.id === batch.positionId);
    if (!musicPoint || !model || !position) return null;
    return { batch, musicPoint, model, position, desired: musicPoint.time + batch.offset };
  });

  // 2. 按点位分波调度：容量内同时刻齐射，超出则按 reloadGap 排队顺延
  const scheduled: ScheduledBatch[] = [];
  const positionStats: PositionStat[] = [];

  for (const position of plan.positions) {
    const posRows = rows
      .filter((r): r is NonNullable<typeof r> => r !== null && r.position.id === position.id)
      .sort((a, b) => a.desired - b.desired || a.batch.id.localeCompare(b.batch.id));

    const waves: { time: number; rows: typeof posRows }[] = [];
    for (const r of posRows) {
      // 找到期望时刻附近仍有空位的最近一波
      let candidate: (typeof waves)[number] | undefined;
      for (let i = waves.length - 1; i >= 0; i--) {
        if (waves[i].time <= r.desired + SIMUL_EPS) {
          candidate = waves[i];
          break;
        }
      }
      if (
        candidate &&
        candidate.time >= r.desired - SIMUL_EPS &&
        candidate.rows.length < position.capacity
      ) {
        candidate.rows.push(r);
      } else {
        let t = r.desired;
        if (waves.length > 0) {
          t = Math.max(t, waves[waves.length - 1].time + position.reloadGap);
        }
        waves.push({ time: t, rows: [r] });
      }
    }

    const statRows: ScheduledBatch[] = [];
    for (const w of waves) {
      for (const r of w.rows) {
        const angle = clamp(r.model.angleNominal, position.angleMin, position.angleMax);
        const queued = w.time > r.desired + SIMUL_EPS;
        statRows.push({
          batch: r.batch,
          musicPoint: r.musicPoint,
          model: r.model,
          position,
          desiredTime: r.desired,
          time: w.time,
          queued,
          angle,
          angleClamped: angle !== r.model.angleNominal,
          caliber: r.model.caliber,
          caliberOk: r.model.caliber <= position.maxCaliber,
          safetyDistance: r.model.safetyDistance,
          safetyOk: r.model.safetyDistance <= position.safetyRadius,
        });
      }
    }
    statRows.sort((a, b) => a.time - b.time || a.batch.id.localeCompare(b.batch.id));
    scheduled.push(...statRows);

    const queued = statRows.filter((s) => s.queued).length;
    positionStats.push({
      position,
      rows: statRows,
      waves: waves.map((w) => ({ time: w.time, rows: w.rows.map((r) => statRows.find((s) => s.batch.id === r.batch.id)!) })),
      load: statRows.length,
      queued,
      overCapacity: queued > 0,
      caliberMismatch: statRows.some((s) => !s.caliberOk),
      angleClamped: statRows.some((s) => s.angleClamped),
      safetyMismatch: statRows.some((s) => !s.safetyOk),
    });
  }

  scheduled.sort((a, b) => a.time - b.time || a.batch.id.localeCompare(b.batch.id));

  // 3. 冲突与提示
  const conflicts: Conflict[] = [];
  for (const s of scheduled) {
    if (s.queued) {
      conflicts.push({
        id: `q-${s.batch.id}`,
        level: "warn",
        batchId: s.batch.id,
        positionId: s.position.id,
        message: `${s.position.name} 容量不足，「${s.batch.name}」(${s.model.name}) 排队顺延 ${fmtTime(s.time)}`,
      });
    }
    if (!s.caliberOk) {
      conflicts.push({
        id: `c-${s.batch.id}`,
        level: "error",
        batchId: s.batch.id,
        positionId: s.position.id,
        message: `${s.position.name} 口径超限：${s.model.name} ${s.caliber}mm > 点位上限 ${s.position.maxCaliber}mm`,
      });
    }
    if (!s.safetyOk) {
      conflicts.push({
        id: `s-${s.batch.id}`,
        level: "error",
        batchId: s.batch.id,
        positionId: s.position.id,
        message: `${s.position.name} 安全距离不足：${s.safetyDistance}m > 点位半径 ${s.position.safetyRadius}m`,
      });
    }
  }

  const totalDuration = Math.max(
    plan.musicPoints.reduce((acc, m) => Math.max(acc, m.time), 0),
    scheduled.reduce((acc, s) => Math.max(acc, s.time + s.model.duration), 0),
  );

  return {
    scheduled,
    positionStats,
    conflicts,
    totalDuration,
    segmentCount: plan.musicPoints.length,
    batchCount: plan.batches.length,
    queuedCount: scheduled.filter((s) => s.queued).length,
  };
}

/** 秒 -> mm:ss.mmm */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return "--:--.---";
  const sign = sec < 0 ? "-" : "";
  const v = Math.abs(sec);
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  const ms = Math.round((v - Math.floor(v)) * 1000);
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** 秒 -> 坐标轴标签（整秒显示 mm:ss） */
export function fmtAxis(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
