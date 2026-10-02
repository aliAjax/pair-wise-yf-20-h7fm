import type { Plan } from "../types";
import type { DerivedPlan } from "../engine";
import { fmtTime } from "../engine";

interface Props {
  plan: Plan;
  derived: DerivedPlan;
}

export default function ShowPreview({ plan, derived }: Props) {
  const sortedMps = [...plan.musicPoints].sort((a, b) => a.time - b.time);
  const maxSafety = Math.max(...plan.models.map((m) => m.safetyDistance), 0);
  const totalShots = plan.batches.reduce((a, b) => a + b.quantity, 0);

  const stats = [
    { label: "总时长", value: fmtTime(derived.totalDuration) },
    { label: "节目段落", value: String(derived.segmentCount) },
    { label: "点火批次", value: String(derived.batchCount) },
    { label: "总发数", value: String(totalShots) },
    { label: "排队批次", value: String(derived.queuedCount), alert: derived.queuedCount > 0 },
    { label: "最大安全距离", value: `${maxSafety}m` },
  ];

  return (
    <div className="panel preview-panel">
      <div className="heading">
        <div>
          <p>整场节目预览</p>
          <h2>{plan.title}</h2>
        </div>
        <span className="version-badge">方案版本 v{plan.version}</span>
      </div>

      <div className="preview-stats">
        {stats.map((s) => (
          <article key={s.label} className={s.alert ? "alert" : ""}>
            <small>{s.label}</small>
            <strong>{s.value}</strong>
          </article>
        ))}
      </div>

      <div className="segment-list">
        {sortedMps.map((mp, i) => {
          const next = sortedMps[i + 1];
          const segBatches = derived.scheduled.filter((s) => s.musicPoint.id === mp.id);
          return (
            <article key={mp.id} className="segment">
              <header>
                <b className="seg-no">{String(i + 1).padStart(2, "0")}</b>
                <div>
                  <h3>{mp.label}</h3>
                  <p>
                    {fmtTime(mp.time)}
                    {next ? ` → ${fmtTime(next.time)}` : " → 结束"}
                  </p>
                </div>
                <span className="seg-count">{segBatches.length} 批次</span>
              </header>
              {segBatches.length === 0 ? (
                <p className="empty">本段无点火批次</p>
              ) : (
                <ul>
                  {segBatches.map((s) => (
                    <li key={s.batch.id} className={s.queued ? "queued" : ""}>
                      <span className="dot" style={{ background: s.queued ? "#dc2626" : "#1d4ed8" }} />
                      <div>
                        <b>{s.batch.name}</b>
                        <p>
                          {s.position.name} · {s.model.name} ×{s.batch.quantity} · 口径{s.caliber}mm · 角{s.angle}°
                          {s.queued ? ` · 排队至 ${fmtTime(s.time)}` : ` · ${fmtTime(s.time)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
