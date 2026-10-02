import type { Plan } from "../types";
import type { DerivedPlan } from "../engine";

interface Props {
  plan: Plan;
  derived: DerivedPlan;
  onSelectPosition: (id: string | null) => void;
  selectedPositionId: string | null;
}

export default function PositionMap({
  plan,
  derived,
  selectedPositionId,
  onSelectPosition,
}: Props) {
  const maxRadius = Math.max(...plan.positions.map((p) => p.safetyRadius), 1);
  return (
    <div className="panel map-panel">
      <div className="heading">
        <div>
          <p>燃放点位平面图</p>
          <h2>点位容量 · 安全半径 · 排队</h2>
        </div>
      </div>
      <div className="map-wrap">
        <svg viewBox="0 0 100 100" className="map" role="img">
          <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
          {/* 场地网格 */}
          {[20, 40, 60, 80].map((g) => (
            <g key={g} stroke="#e2e8f0" strokeWidth="0.3">
              <line x1={g} y1="0" x2={g} y2="100" />
              <line x1="0" y1={g} x2="100" y2={g} />
            </g>
          ))}
          {derived.positionStats.map((st) => {
            const p = st.position;
            const r = (p.safetyRadius / maxRadius) * 30;
            const ratio = st.load / p.capacity;
            const ring = st.overCapacity ? "#dc2626" : ratio >= 0.75 ? "#f59e0b" : "#1d4ed8";
            const active = selectedPositionId === p.id;
            return (
              <g
                key={p.id}
                transform={`translate(${p.x},${p.y})`}
                className="map-point"
                onClick={() => onSelectPosition(active ? null : p.id)}
              >
                <circle r={r} fill={ring} fillOpacity="0.07" stroke={ring} strokeWidth="0.4" strokeDasharray="1.2 1" />
                <circle r="3.2" fill={ring} stroke="#fff" strokeWidth="0.6" />
                <text y="1.2" textAnchor="middle" fontSize="2.6" fill="#fff" fontWeight="700">
                  {st.load}
                </text>
                <text y="-5" textAnchor="middle" fontSize="3" fill="#172033" fontWeight="700">
                  {p.name}
                </text>
                <text y="7.5" textAnchor="middle" fontSize="2.4" fill="#64748b">
                  {st.load}/{p.capacity}
                  {st.queued > 0 ? ` · 排${st.queued}` : ""}
                </text>
                {active && <circle r={r + 1.5} fill="none" stroke="#172033" strokeWidth="0.5" />}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="hint">
        圆大小表示安全半径（相对值），颜色：<i className="swatch" style={{ background: "#1d4ed8" }} /> 正常
        <i className="swatch" style={{ background: "#f59e0b" }} /> 接近容量
        <i className="swatch" style={{ background: "#dc2626" }} /> 已排队。点击点位可在容量表中定位。
      </p>
    </div>
  );
}
