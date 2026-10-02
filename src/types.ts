// 燃放脚本编排台 —— 核心数据类型

/** 音乐时间点（节目段落边界 /  cue 点） */
export interface MusicPoint {
  id: string;
  /** 段落名称，如 Intro / Chorus A / Finale */
  label: string;
  /** 时间（秒） */
  time: number;
}

/** 烟花型号 */
export interface Model {
  id: string;
  name: string;
  /** 类别：礼花弹 / 罗马烛光 / 扇形架 / 冷焰火 */
  category: string;
  /** 口径 mm */
  caliber: number;
  /** 标称发射角度（度） */
  angleNominal: number;
  /** 安全距离 m（由口径决定） */
  safetyDistance: number;
  /** 持续时间 s */
  duration: number;
}

/** 燃放点位 */
export interface Position {
  id: string;
  name: string;
  /** 平面图坐标（百分比 0-100） */
  x: number;
  y: number;
  /** 同时刻可容纳的批次（波次大小） */
  capacity: number;
  /** 相邻波次最小间隔 s（重装/安全间隔） */
  reloadGap: number;
  /** 允许最大口径 mm */
  maxCaliber: number;
  /** 允许发射角度范围（度） */
  angleMin: number;
  angleMax: number;
  /** 点位安全半径 m */
  safetyRadius: number;
}

/** 点火批次 */
export interface Batch {
  id: string;
  name: string;
  /** 绑定的音乐时间点 id */
  musicPointId: string;
  /** 人工偏移 s（相对音乐点，保留不被自动重算覆盖） */
  offset: number;
  positionId: string;
  modelId: string;
  /** 数量（发） */
  quantity: number;
}

/** 一版完整方案 */
export interface Plan {
  version: number;
  title: string;
  musicPoints: MusicPoint[];
  models: Model[];
  positions: Position[];
  batches: Batch[];
}

/** 写盘任务（待提交区条目） */
export interface WriteJob {
  id: string;
  version: number;
  status: "pending" | "saving" | "written" | "failed";
  attempts: number;
  error?: string;
  createdAt: number;
}
