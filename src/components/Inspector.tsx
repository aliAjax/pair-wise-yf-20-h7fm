import type { Plan } from "../types";
import type { ScheduledBatch } from "../engine";
import { fmtTime } from "../engine";

interface Props {
  plan: Plan;
  selected: ScheduledBatch | null;
  onUpdateBatch: (id: string, patch: Partial<Plan["batches"][number]>) => void;
  onDeleteBatch: (id: string) => void;
  onAddBatch: () => void;
  onAddMusicPoint: () => void;
}

export default function Inspector({
  plan,
  selected,
  onUpdateBatch,
  onDeleteBatch,
  onAddBatch,
  onAddMusicPoint,
}: Props) {
  return (
    <div className="panel inspector-panel">
      <div className="heading">
        <div>
          <p>编排检查器</p>
          <h2>绑定 · 偏移 · 点位 · 型号</h2>
        </div>
      </div>

      <div className="inspector-actions">
        <button className="primary" onClick={onAddBatch}>
          ＋ 新增点火批次
        </button>
        <button onClick={onAddMusicPoint}>＋ 新增音乐点</button>
      </div>

      {!selected ? (
        <p className="empty">
          点击时间轴或列表中的批次进行编辑。批次绑定音乐时间点后，改音乐点时间会自动重算，人工偏移保留。
        </p>
      ) : (
        <div className="inspector-form">
          <label>
            <span>批次名称</span>
            <input
              value={selected.batch.name}
              onChange={(e) => onUpdateBatch(selected.batch.id, { name: e.target.value })}
            />
          </label>

          <label>
            <span>绑定音乐时间点</span>
            <select
              value={selected.batch.musicPointId}
              onChange={(e) => onUpdateBatch(selected.batch.id, { musicPointId: e.target.value })}
            >
              {plan.musicPoints.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}（{fmtTime(m.time)}）
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>人工偏移（秒，相对音乐点，保留）</span>
            <input
              type="number"
              step="0.1"
              value={selected.batch.offset}
              onChange={(e) => onUpdateBatch(selected.batch.id, { offset: Number(e.target.value) })}
            />
          </label>

          <div className="derived-line">
            实际点火：<b>{fmtTime(selected.time)}</b>
            {selected.queued && <em className="queue-tag">排队顺延（期望 {fmtTime(selected.desiredTime)}）</em>}
          </div>

          <label>
            <span>点位</span>
            <select
              value={selected.batch.positionId}
              onChange={(e) => onUpdateBatch(selected.batch.id, { positionId: e.target.value })}
            >
              {plan.positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（容量 {p.capacity}）
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>型号</span>
            <select
              value={selected.batch.modelId}
              onChange={(e) => onUpdateBatch(selected.batch.id, { modelId: e.target.value })}
            >
              {plan.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.caliber}mm / 安全{m.safetyDistance}m）
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>数量（发）</span>
            <input
              type="number"
              min="1"
              value={selected.batch.quantity}
              onChange={(e) => onUpdateBatch(selected.batch.id, { quantity: Math.max(1, Number(e.target.value)) })}
            />
          </label>

          <div className="derived-tags">
            <span className={selected.caliberOk ? "ok" : "bad"}>口径 {selected.caliber}mm</span>
            <span className={selected.angleClamped ? "warn" : "ok"}>
              角 {selected.angle}°{selected.angleClamped ? "（钳制）" : ""}
            </span>
            <span className={selected.safetyOk ? "ok" : "bad"}>安全 {selected.safetyDistance}m</span>
          </div>

          <button className="danger" onClick={() => onDeleteBatch(selected.batch.id)}>
            删除该批次
          </button>
        </div>
      )}
    </div>
  );
}
