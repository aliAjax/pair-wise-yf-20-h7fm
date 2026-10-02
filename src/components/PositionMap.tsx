import type { Conflict, FiringRow, Plan, PositionStat } from "../types";

interface Props {
  plan: Plan;
  stats: PositionStat[];
  rows: FiringRow[];
  conflicts: Conflict[];
  selectedId: string | null;
  onSelect: (batchId: string | null) => void;
}

const KIND_DOT: Record<string, string> = {
  礼花弹: "#dc2626",
  罗马烛光: "#f59e0b",
  扇形架: "#1d4ed8",
  冷焰火: "#0891b2",
};

// 场图坐标范围（与 Position x/y 对应，单位 m）
const X_MAX = 240;
const Y_MAX = 200;

export default function PositionMap({ plan, stats, rows, conflicts, selectedId, onSelect }: Props) {
  const safetyBad = new Set(
    conflicts.filter((c) => c.kind === "safety").map((c) => c.positionId),
  );
  const queuePos = new Map<string, number>();
  conflicts
    .filter((c) => c.kind === "queue")
    .forEach((c) => {
      if (c.positionId) queuePos.set(c.positionId, (queuePos.get(c.positionId) ?? 0) + 1);
    });

  return (
    <div className="map-wrap">
      <svg viewBox="0 0 600 420" className="map-svg">
        {/* 观众席（底边） */}
        <rect x="20" y="392" width="560" height="18" rx="4" className="audience" />
        <text x="300" y="406" textAnchor="middle" className="audience-text">
          观众席（纵深安全距离从这里起算）
        </text>

        {/* 纵深网格 */}
        {[50, 100, 150].map((m) => {
          const y = 392 - (m / Y_MAX) * 340 - 12;
          return (
            <g key={m}>
              <line x1="24" y1={y} x2="576" y2={y} className="grid-line" />
              <text x="30" y={y - 4} className="grid-text">
                {m}m
              </text>
            </g>
          );
        })}

        {/* 点位安全半径圈 */}
        {stats.map((s) => {
          const pos = plan.positions.find((p) => p.id === s.position.id)!;
          const cx = (pos.x / X_MAX) * 552 + 24;
          const cy = 380 - (pos.y / Y_MAX) * 336;
          const r = (s.requiredSafeM / X_MAX) * 552;
          const bad = safetyBad.has(s.position.id);
          if (s.batchCount === 0) return null;
          return (
            <circle
              key={`ring_${s.position.id}`}
              cx={cx}
              cy={cy}
              r={r}
              className={bad ? "safe-ring danger" : "safe-ring"}
            />
          );
        })}

        {/* 点位 */}
        {plan.positions.map((pos) => {
          const stat = stats.find((s) => s.position.id === pos.id)!;
          const cx = (pos.x / X_MAX) * 552 + 24;
          const cy = 380 - (pos.y / Y_MAX) * 336;
          const bad = safetyBad.has(pos.id);
          const q = queuePos.get(pos.id) ?? 0;
          return (
            <g key={pos.id} className={bad ? "pos-node danger" : "pos-node"}>
              <rect x={cx - 15} y={cy - 15} width="30" height="30" rx="6" className="pos-box" />
              <text x={cx} y={cy + 5} textAnchor="middle" className="pos-letter">
                {pos.name.slice(0, 1)}
              </text>
              <text x={cx} y={cy - 24} textAnchor="middle" className="pos-name">
                {pos.name}
              </text>
              <text x={cx} y={cy + 32} textAnchor="middle" className="pos-meta">
                容量 {pos.capacity} 通道
                {q > 0 && <tspan className="map-queue"> · {q} 批排队</tspan>}
              </text>
              <text x={cx} y={cy + 46} textAnchor="middle" className="pos-meta">
                {stat.maxCaliber > 0 ? `最大口径 ${stat.maxCaliber}mm · 安全 ${stat.requiredSafeM}m` : "未安排批次"}
              </text>
              <text x={cx} y={cy + 60} textAnchor="middle" className={stat.audienceGapM < 0 ? "gap-danger" : "gap-ok"}>
                纵深 {pos.y}m {stat.audienceGapM < 0 ? `✕ 差 ${Math.abs(stat.audienceGapM)}m` : `✓ 余 ${stat.audienceGapM}m`}
              </text>
              {stat.angles.length > 0 && (
                <text x={cx} y={cy + 74} textAnchor="middle" className="pos-meta">
                  角度 {stat.angles.map((a) => `${a}°`).join("/")}
                </text>
              )}
            </g>
          );
        })}

        {/* 批次 → 点位连线（按选中高亮） */}
        {rows.map((r) => {
          const cx = (r.position.x / X_MAX) * 552 + 24;
          const cy = 380 - (r.position.y / Y_MAX) * 336;
          const rad = (r.angleDeg * Math.PI) / 180;
          const len = 44 + Math.min(30, r.safeDistanceM / 4);
          const ex = cx + Math.sin(rad) * len;
          const ey = cy - Math.cos(rad) * len;
          const sel = selectedId === r.id;
          return (
            <line
              key={r.id}
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              className={sel ? "angle-line sel" : "angle-line"}
              stroke={KIND_DOT[r.product.kind] ?? "#64748b"}
              onClick={() => onSelect(sel ? null : r.id)}
            >
              <title>{`${r.product.name} ${formatRowTime(r.fireTimeMs)} · 角 ${r.angleDeg}°`}</title>
            </line>
          );
        })}
      </svg>

      <div className="map-legend">
        {Object.entries(KIND_DOT).map(([k, c]) => (
          <span key={k}>
            <i style={{ background: c }} />
            {k}
          </span>
        ))}
        <span>
          <i className="legend-ring" /> 安全距离半径
        </span>
        <span className="px-hint">
          点击批次连线可选中；场地 {X_MAX}m × {Y_MAX}m，圆点半径=该点位最大型号安全距离
        </span>
      </div>
    </div>
  );
}

function formatRowTime(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
