import type { Plan } from "../types";
import type { DerivedPlan } from "../engine";
import { fmtTime } from "../engine";

interface Props {
  plan: Plan;
  derived: DerivedPlan;
  selectedPositionId: string | null;
  onSelectPosition: (id: string | null) => void;
}

export default function PositionCalc({ derived, selectedPositionId, onSelectPosition }: Props) {
  return (
    <div className="panel calc-panel">
      <div className="heading">
        <div>
          <p>点位火力计算</p>
          <h2>按点位算口径 · 角度 · 安全距离 · 容量排队</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="calc-table">
          <thead>
            <tr>
              <th>点位</th>
              <th>波次/容量</th>
              <th>口径(mm)</th>
              <th>角度(°)</th>
              <th>安全距离(m)</th>
              <th>排队</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {derived.positionStats.map((st) => {
              const p = st.position;
              const active = selectedPositionId === p.id;
              const capRatio = st.load / p.capacity;
              return (
                <tr
                  key={p.id}
                  className={active ? "active" : ""}
                  onClick={() => onSelectPosition(active ? null : p.id)}
                >
                  <td>
                    <b>{p.name}</b>
                    <p className="sub">
                      上限 {p.maxCaliber}mm · {p.angleMin}-{p.angleMax}° · 半径 {p.safetyRadius}m
                    </p>
                  </td>
                  <td>
                    <span className={capRatio > 1 ? "num bad" : capRatio >= 0.75 ? "num warn" : "num ok"}>
                      {st.load}/{p.capacity}
                    </span>
                  </td>
                  <td>
                    {st.rows.length > 0 ? (
                      <span className={st.caliberMismatch ? "num bad" : "num ok"}>
                        {Math.max(...st.rows.map((r) => r.caliber))}
                        {st.caliberMismatch ? " ✕" : " ✓"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {st.rows.length > 0 ? (
                      <span className={st.angleClamped ? "num warn" : "num ok"}>
                        {Math.min(...st.rows.map((r) => r.angle))}~{Math.max(...st.rows.map((r) => r.angle))}
                        {st.angleClamped ? " 钳制" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {st.rows.length > 0 ? (
                      <span className={st.safetyMismatch ? "num bad" : "num ok"}>
                        {Math.max(...st.rows.map((r) => r.safetyDistance))}
                        {st.safetyMismatch ? " ✕" : " ✓"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {st.queued > 0 ? (
                      <span className="num bad">
                        {st.queued} 批次
                        <span className="sub">
                          {st.rows
                            .filter((r) => r.queued)
                            .map((r) => `${r.model.name}@${fmtTime(r.time)}`)
                            .join("、")}
                        </span>
                      </span>
                    ) : (
                      <span className="num ok">无</span>
                    )}
                  </td>
                  <td>
                    {st.overCapacity || st.caliberMismatch || st.safetyMismatch ? (
                      <span className="badge bad">需调整</span>
                    ) : st.angleClamped ? (
                      <span className="badge warn">角度钳制</span>
                    ) : (
                      <span className="badge ok">正常</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
