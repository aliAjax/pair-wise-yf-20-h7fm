import { useState } from "react";
import type { FiringRow, Plan } from "../types";
import { formatTime } from "../engine";

interface Props {
  plan: Plan;
  rows: FiringRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (patch: { markerId: string; positionId: string; productId: string }) => void;
  onAngle: (batchId: string, angle: number | null) => void;
  onRemove: (batchId: string) => void;
  onOffset: (batchId: string, offsetMs: number) => void;
}

export default function FiringTable({
  plan,
  rows,
  selectedId,
  onSelect,
  onAdd,
  onAngle,
  onRemove,
  onOffset,
}: Props) {
  const [markerId, setMarkerId] = useState(plan.markers[0]?.id ?? "");
  const [positionId, setPositionId] = useState(plan.positions[0]?.id ?? "");
  const [productId, setProductId] = useState(plan.products[0]?.id ?? "");

  return (
    <div className="firing-table">
      <div className="add-row">
        <select value={markerId} onChange={(e) => setMarkerId(e.target.value)}>
          {plan.markers.map((m) => (
            <option key={m.id} value={m.id}>
              {formatTime(m.timeMs)} · {m.label}
            </option>
          ))}
        </select>
        <select value={positionId} onChange={(e) => setPositionId(e.target.value)}>
          {plan.positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（容量 {p.capacity}）
            </option>
          ))}
        </select>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {plan.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.caliberMm}mm / {p.safeDistanceM}m）
            </option>
          ))}
        </select>
        <button
          className="primary"
          onClick={() => onAdd({ markerId, positionId, productId })}
        >
          绑定到此时间点
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>实际点火</th>
              <th>音乐时间点</th>
              <th>人工偏移</th>
              <th>排队</th>
              <th>段落</th>
              <th>点位 · 型号</th>
              <th>口径</th>
              <th>角度</th>
              <th>安全距离</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={selectedId === r.id ? "sel" : ""}
                onClick={() => onSelect(selectedId === r.id ? null : r.id)}
              >
                <td className="mono">{formatTime(r.fireTimeMs)}</td>
                <td className="mono dim">
                  {formatTime(r.fireTimeMs - r.queueDelayMs - r.batch.offsetMs)}
                </td>
                <td>
                  <input
                    type="number"
                    className="offset-input"
                    value={r.batch.offsetMs}
                    step={50}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onOffset(r.id, Number(e.target.value) || 0)}
                    title="人工偏移 ms，音乐时间点移动后保留"
                  />
                </td>
                <td>
                  {r.queueDelayMs > 0 ? (
                    <span className="tag-warn">+{(r.queueDelayMs / 1000).toFixed(1)}s</span>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
                <td>{r.segmentTitle}</td>
                <td>
                  <b>{r.position.name}</b>
                  <br />
                  <span className="dim">{r.product.name}</span>
                </td>
                <td className="mono">{r.product.caliberMm}mm</td>
                <td>
                  <input
                    type="number"
                    className="angle-input"
                    value={r.batch.angleOverride ?? r.product.angleDeg}
                    min={-45}
                    max={45}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      onAngle(r.id, Number.isFinite(v) && v !== r.product.angleDeg ? v : null);
                    }}
                    title="留默认值即跟随型号；人工值在重算时保留"
                  />
                  °
                  {r.batch.angleOverride !== null && <span className="tag-man">人工</span>}
                </td>
                <td className="mono">{r.safeDistanceM}m</td>
                <td>
                  <button
                    className="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(r.id);
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  还没有批次，先在上方绑定一个音乐时间点
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="table-hint">
        新增批次立即占用点位通道；同一时点超出容量的批次自动排队，表中标出点位与型号。人工角度输入型号默认值即恢复跟随。
      </p>
    </div>
  );
}
