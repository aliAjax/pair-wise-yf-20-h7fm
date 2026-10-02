// 燃放脚本编排台 —— 数据模型
// 音乐时间点是唯一时间源：批次锚定在时间点上，时间点移动后所有绑定批次与后续火力整体重算。
// 人工偏移（offsetMs）与手动角度挂在批次上，重算时原样保留。

export interface Product {
  id: string;
  name: string;
  kind: string; // 礼花弹 / 罗马烛光 / 扇形架 / 冷焰火
  caliberMm: number; // 口径
  angleDeg: number; // 默认发射角度（度，0=垂直）
  durationMs: number; // 占用点位的时长
  safeDistanceM: number; // 要求安全距离
}

export interface Position {
  id: string;
  name: string;
  x: number; // 平面图坐标（m），x 横向
  y: number; // 距观众席纵深（m），y 越小离观众越近
  capacity: number; // 同时可点火的通道数
  note?: string;
}

export interface MusicMarker {
  id: string;
  timeMs: number; // 音乐时间点（唯一时间源）
  label: string;
}

export interface Segment {
  id: string;
  markerId: string; // 段落起始于某个音乐时间点
  title: string;
  durationMs: number; // 段落时长（用于时间轴底色）
}

export interface Batch {
  id: string;
  markerId: string; // 绑定的音乐时间点
  positionId: string;
  productId: string;
  /** 人工点火偏移：相对音乐时间点，重算时保留 */
  offsetMs: number;
  /** 手动指定的发射角度；null 表示跟随型号默认值，重算时保留 */
  angleOverride: number | null;
  note?: string;
}

export interface QueuedBatch {
  batch: Batch;
  /** 通道占用排队导致的额外延迟（ms） */
  queueDelayMs: number;
  /** 实际点火时间 = 音乐时间点 + 人工偏移 + 排队延迟 */
  fireTimeMs: number;
  /** 排在它前面的批次（同一时点同一通道） */
  waitFor: string[];
}

export interface PositionStat {
  position: Position;
  maxCaliber: number;
  requiredSafeM: number;
  audienceGapM: number; // y - 要求安全距离，<0 即安全冲突
  angles: number[];
  batchCount: number;
}

export type ConflictKind = "queue" | "safety" | "overlap";

export interface Conflict {
  id: string;
  kind: ConflictKind;
  level: "warn" | "danger";
  message: string;
  batchIds: string[];
  positionId?: string;
  markerId?: string;
}

export interface FiringRow extends QueuedBatch {
  id: string;
  markerId: string;
  positionId: string;
  segmentTitle: string;
  position: Position;
  product: Product;
  angleDeg: number;
  safeDistanceM: number;
}

export interface Plan {
  products: Product[];
  positions: Position[];
  markers: MusicMarker[];
  segments: Segment[];
  batches: Batch[];
  version: number;
}

export interface Snapshot {
  plan: Plan;
  version: number;
  savedAt: string;
}

export interface PendingItem {
  id: string;
  createdAt: number;
  snapshot: Snapshot;
  reason: string;
}

export interface SaveState {
  status: "idle" | "writing" | "error";
  message: string;
}
