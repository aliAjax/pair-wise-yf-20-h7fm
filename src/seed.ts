import type { Plan } from "./types";

// 初始方案：音乐时间点 + 节目段落 + 点火批次 + 点位 + 型号
// 刻意在 A 区 Intro 段安排 2+4 个批次同时刻点火（容量 3），用于演示容量排队。
export const seedPlan: Plan = {
  version: 1,
  title: "燃放脚本 · 示例场",
  musicPoints: [
    { id: "mp-intro", label: "Intro", time: 0 },
    { id: "mp-verse", label: "Verse", time: 30 },
    { id: "mp-chorus", label: "Chorus A", time: 68.2 },
    { id: "mp-bridge", label: "Bridge", time: 150 },
    { id: "mp-finale", label: "Finale", time: 222 },
    { id: "mp-end", label: "End", time: 240 },
  ],
  models: [
    { id: "m-fan30", name: "30mm 扇形架", category: "扇形架", caliber: 30, angleNominal: 45, safetyDistance: 35, duration: 25 },
    { id: "m-candle", name: "罗马烛光", category: "罗马烛光", caliber: 30, angleNominal: 50, safetyDistance: 35, duration: 20 },
    { id: "m-shell50", name: "50mm 礼花弹", category: "礼花弹", caliber: 50, angleNominal: 75, safetyDistance: 60, duration: 18 },
    { id: "m-shell75", name: "75mm 礼花弹", category: "礼花弹", caliber: 75, angleNominal: 80, safetyDistance: 90, duration: 12 },
    { id: "m-shell100", name: "100mm 礼花弹", category: "礼花弹", caliber: 100, angleNominal: 85, safetyDistance: 120, duration: 10 },
    { id: "m-cold", name: "冷焰火", category: "冷焰火", caliber: 20, angleNominal: 90, safetyDistance: 20, duration: 30 },
  ],
  positions: [
    { id: "p-a", name: "A 区主发射位", x: 22, y: 68, capacity: 3, reloadGap: 0.8, maxCaliber: 100, angleMin: 45, angleMax: 90, safetyRadius: 120 },
    { id: "p-b", name: "B 区副发射位", x: 52, y: 80, capacity: 2, reloadGap: 0.8, maxCaliber: 75, angleMin: 50, angleMax: 90, safetyRadius: 90 },
    { id: "p-c", name: "近景区点位", x: 80, y: 58, capacity: 2, reloadGap: 1.0, maxCaliber: 50, angleMin: 70, angleMax: 90, safetyRadius: 50 },
    { id: "p-d", name: "水面发射位", x: 16, y: 28, capacity: 4, reloadGap: 0.6, maxCaliber: 100, angleMin: 30, angleMax: 80, safetyRadius: 120 },
  ],
  batches: [
    { id: "b-01", name: "Intro 扇形开场", musicPointId: "mp-intro", offset: 0, positionId: "p-a", modelId: "m-fan30", quantity: 2 },
    { id: "b-02", name: "Intro 冷焰铺底", musicPointId: "mp-intro", offset: 0, positionId: "p-a", modelId: "m-cold", quantity: 4 },
    { id: "b-11", name: "Intro 礼花叠加", musicPointId: "mp-intro", offset: 0, positionId: "p-a", modelId: "m-shell50", quantity: 1 },
    { id: "b-12", name: "Intro 冷焰齐发", musicPointId: "mp-intro", offset: 0, positionId: "p-a", modelId: "m-cold", quantity: 2 },
    { id: "b-03", name: "Verse 烛光", musicPointId: "mp-verse", offset: 0, positionId: "p-b", modelId: "m-candle", quantity: 2 },
    { id: "b-04", name: "Chorus 礼花", musicPointId: "mp-chorus", offset: 0, positionId: "p-a", modelId: "m-shell75", quantity: 1 },
    { id: "b-05", name: "Chorus 副点", musicPointId: "mp-chorus", offset: 0, positionId: "p-b", modelId: "m-shell50", quantity: 2 },
    { id: "b-13", name: "Chorus 双发", musicPointId: "mp-chorus", offset: 0, positionId: "p-b", modelId: "m-candle", quantity: 1 },
    { id: "b-14", name: "Chorus 补点", musicPointId: "mp-chorus", offset: 0, positionId: "p-b", modelId: "m-shell50", quantity: 1 },
    { id: "b-06", name: "Bridge 近景冷焰", musicPointId: "mp-bridge", offset: 0, positionId: "p-c", modelId: "m-cold", quantity: 4 },
    { id: "b-15", name: "Bridge 近景违规弹", musicPointId: "mp-bridge", offset: 0, positionId: "p-c", modelId: "m-shell75", quantity: 1 },
    { id: "b-07", name: "Finale 主弹", musicPointId: "mp-finale", offset: 0, positionId: "p-a", modelId: "m-shell100", quantity: 1 },
    { id: "b-08", name: "Finale 副弹", musicPointId: "mp-finale", offset: 0, positionId: "p-b", modelId: "m-shell75", quantity: 2 },
    { id: "b-09", name: "Finale 水面", musicPointId: "mp-finale", offset: 0, positionId: "p-d", modelId: "m-shell75", quantity: 2 },
    { id: "b-10", name: "End 收束", musicPointId: "mp-end", offset: 0, positionId: "p-d", modelId: "m-fan30", quantity: 2 },
  ],
};
