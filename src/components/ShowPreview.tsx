import type { FiringRow, Plan, PositionStat } from "../types";
import { formatTime, planDuration } from "../engine";

interface Props {
  plan: Plan;
  rows: FiringRow[];
  stats: PositionStat[];
  version: number;
}

/**
 * 整场预览：与时间轴、点位图读同一份 rows/stats（同一版方案），
 * 版本号一致即可确认三处显示没有分叉。
 */
export default function ShowPreview({ plan, rows, stats, version }: Props) {
  const total = planDuration(plan, rows);
  const bySegment = plan.segments
    .map((seg) => {
      const marker = plan.markers.find((m) => m.id === seg.markerId);
      const list = rows.filter((r) => r.batch.markerId === seg.markerId);
      return { seg, marker, list };
    })
    .filter((x) => x.marker);

  return (
    <div className="preview">
      <div className="preview-head">
        <div>
          <span className="version-badge">方案版本 v{version}</span>
          <h3>整场节目预览</h3>
        </div>
        <ul className="preview-stats">
          <li>
            <b>{plan.markers.length}</b> 音乐时间点
          </li>
          <li>
            <b>{rows.length}</b> 点火批次
          </li>
          <li>
            <b>{stats.filter((s) => s.batchCount > 0).length}</b> 在用点位
          </li>
          <li>
            <b>{formatTime(total)}</b> 总时长
          </li>
        </ul>
      </div>

      <ol className="preview-segments">
        {bySegment.map(({ seg, marker, list }) => (
          <li key={seg.id} className="preview-segment">
            <div className="ps-time">
              <b>{formatTime(marker!.timeMs)}</b>
              <span>{seg.title}</span>
              <em className="dim">{(seg.durationMs / 1000).toFixed(0)}s 段落</em>
            </div>
            <div className="ps-cues">
              {list.length === 0 && <span className="dim">本段落未绑定批次</span>}
              {list.map((r) => (
                <span key={r.id} className={`cue ${r.queueDelayMs > 0 ? "queued" : ""}`}>
                  <b>{formatTime(r.fireTimeMs)}</b>
                  {r.position.name} · {r.product.name} · {r.product.caliberMm}mm · {r.angleDeg}° · 安全
                  {r.safeDistanceM}m
                  {r.queueDelayMs > 0 && <i>排队 +{(r.queueDelayMs / 1000).toFixed(1)}s</i>}
                  {r.batch.offsetMs !== 0 && <i className="manual">人工偏移 {(r.batch.offsetMs / 1000).toFixed(2)}s</i>}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="preview-positions">
        {stats.map((s) => (
          <div key={s.position.id} className={`pv-pos ${s.audienceGapM < 0 ? "danger" : ""}`}>
            <b>{s.position.name}</b>
            <span>
              {s.batchCount} 批 · 最大 {s.maxCaliber || "—"}mm · 角 {s.angles.map((a) => `${a}°`).join("/") || "—"}
            </span>
            <span>
              要求安全 {s.requiredSafeM || 0}m / 纵深 {s.position.y}m
              <em className={s.audienceGapM < 0 ? "gap-danger" : "gap-ok"}>
                {s.audienceGapM < 0 ? ` 不足 ${Math.abs(s.audienceGapM)}m` : ` 余 ${s.audienceGapM}m`}
              </em>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
