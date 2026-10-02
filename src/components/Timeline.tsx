import { useMemo, useState } from "react";
import type { Batch, FiringRow, Plan } from "../types";
import { formatTime, markerBatches, planDuration } from "../engine";

interface Props {
  plan: Plan;
  rows: FiringRow[];
  onMoveMarker: (markerId: string, timeMs: number) => void;
  onRenameMarker: (markerId: string, label: string) => void;
  onBatchOffset: (batchId: string, offsetMs: number) => void;
  onSelect: (batchId: string | null) => void;
  selectedId: string | null;
}

const KIND_COLORS: Record<string, string> = {
  礼花弹: "#dc2626",
  罗马烛光: "#f59e0b",
  扇形架: "#1d4ed8",
  冷焰火: "#0891b2",
};

export default function Timeline({
  plan,
  rows,
  onMoveMarker,
  onRenameMarker,
  onBatchOffset,
  onSelect,
  selectedId,
}: Props) {
  const total = useMemo(() => planDuration(plan, rows), [plan, rows]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const groups = useMemo(() => markerBatches(plan), [plan]);

  const pct = (ms: number) => `${(ms / total) * 100}%`;

  const commitTime = (markerId: string) => {
    const m = draft.match(/^(?:(\d+):)?(\d{1,2})(?:[.:](\d{1,3}))?$/);
    if (m) {
      const fracText = m[3] ?? "0";
      const frac = Number(fracText.padEnd(3, "0").slice(0, 3));
      const ms = Number(m[1] ?? 0) * 60_000 + Number(m[2]) * 1000 + frac;
      onMoveMarker(markerId, ms);
    }
    setEditing(null);
  };

  const lanes = useMemo(() => {
    // 简单泳道分配，避免同点批次条重叠
    const laneEnd: number[] = [];
    const laneOf = new Map<string, number>();
    rows.forEach((r) => {
      const end = r.fireTimeMs + r.product.durationMs;
      let lane = laneEnd.findIndex((free) => free <= r.fireTimeMs);
      if (lane < 0) {
        lane = laneEnd.length;
        laneEnd.push(0);
      }
      laneEnd[lane] = end;
      laneOf.set(r.batch.id, lane);
    });
    return { laneOf, count: Math.max(1, laneEnd.length) };
  }, [rows]);

  return (
    <div className="timeline">
      <div className="ruler">
        {Array.from({ length: Math.floor(total / 30_000) + 1 }).map((_, i) => (
          <span key={i} style={{ left: pct(i * 30_000) }}>
            {formatTime(i * 30_000).slice(0, 5)}
          </span>
        ))}
      </div>

      <div className="tl-segments">
        {plan.segments.map((seg) => {
          const marker = plan.markers.find((m) => m.id === seg.markerId);
          if (!marker) return null;
          return (
            <div
              key={seg.id}
              className="tl-segment"
              style={{ left: pct(marker.timeMs), width: pct(seg.durationMs) }}
              title={`${seg.title} ${formatTime(marker.timeMs)} 起 · ${(seg.durationMs / 1000).toFixed(0)}s`}
            >
              {seg.title}
            </div>
          );
        })}
      </div>

      <div className="tl-lanes" style={{ height: 26 + lanes.count * 26 }}>
        {rows.map((r) => {
          const lane = lanes.laneOf.get(r.batch.id) ?? 0;
          const color = KIND_COLORS[r.product.kind] ?? "#64748b";
          const queued = r.queueDelayMs > 0;
          return (
            <button
              key={r.id}
              className={`tl-batch ${selectedId === r.id ? "sel" : ""}`}
              style={{
                left: pct(r.fireTimeMs),
                width: pct(r.product.durationMs),
                top: 26 + lane * 26,
                borderColor: color,
                background: queued ? "#fef3c7" : `${color}22`,
              }}
              title={`${r.product.name} @ ${r.position.name}\n点火 ${formatTime(r.fireTimeMs)}${
                r.queueDelayMs > 0 ? `（排队 +${(r.queueDelayMs / 1000).toFixed(1)}s）` : ""
              }${r.batch.offsetMs !== 0 ? `\n人工偏移 ${r.batch.offsetMs}ms` : ""}`}
              onClick={() => onSelect(selectedId === r.id ? null : r.id)}
            >
              <i style={{ background: color }} />
              {queued && <b className="queue-flag">排队</b>}
            </button>
          );
        })}

        {plan.markers.map((mk) => {
          const here = groups.get(mk.id) ?? [];
          return (
            <div key={mk.id} className="tl-marker" style={{ left: pct(mk.timeMs) }}>
              <span className="tl-marker-line" />
              {editing === mk.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitTime(mk.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTime(mk.id);
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <button
                  className="tl-marker-tag"
                  onClick={() => {
                    setEditing(mk.id);
                    setDraft(formatTime(mk.timeMs));
                  }}
                  title="点击修改音乐时间点，绑定批次与后续火力自动重算"
                >
                  <b>{formatTime(mk.timeMs)}</b>
                  <em>{mk.label}</em>
                  {here.length > 0 && <small>{here.length} 批次</small>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <MarkerTable plan={plan} onMoveMarker={onMoveMarker} onRenameMarker={onRenameMarker} groups={groups} />

      {selectedId && (
        <OffsetEditor
          row={rows.find((r) => r.id === selectedId)}
          onOffset={onBatchOffset}
          onClose={() => onSelect(null)}
        />
      )}
    </div>
  );
}

function MarkerTable({
  plan,
  onMoveMarker,
  onRenameMarker,
  groups,
}: {
  plan: Plan;
  onMoveMarker: (markerId: string, ms: number) => void;
  onRenameMarker: (markerId: string, label: string) => void;
  groups: Map<string, Batch[]>;
}) {
  return (
    <div className="marker-table">
      {plan.markers.map((mk) => (
        <div key={mk.id} className="marker-row">
          <input
            className="marker-time"
            value={formatTime(mk.timeMs)}
            onChange={(e) => {
              const m = e.target.value.match(/^(?:(\d+):)?(\d{1,2})(?:[.:](\d{1,3}))?$/);
              if (!m) return;
              if (Number(m[2]) >= 60) return;
              const fracText = m[3] ?? "0";
              const frac = Number(fracText.padEnd(3, "0").slice(0, 3));
              onMoveMarker(mk.id, Number(m[1] ?? 0) * 60_000 + Number(m[2]) * 1000 + frac);
            }}
          />
          <input value={mk.label} onChange={(e) => onRenameMarker(mk.id, e.target.value)} />
          <span className="marker-count">{(groups.get(mk.id) ?? []).length} 个绑定批次</span>
          <input
            type="range"
            min={0}
            max={260_000}
            step={100}
            value={mk.timeMs}
            onChange={(e) => onMoveMarker(mk.id, Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  );
}

function OffsetEditor({
  row,
  onOffset,
  onClose,
}: {
  row: FiringRow | undefined;
  onOffset: (batchId: string, offsetMs: number) => void;
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <div className="offset-editor">
      <div>
        <b>{row.product.name}</b> · {row.position.name} · 期望 {formatTime(row.fireTimeMs - row.queueDelayMs)}
        ，实际点火 <b>{formatTime(row.fireTimeMs)}</b>
        {row.queueDelayMs > 0 && <span className="tag-warn">排队 +{(row.queueDelayMs / 1000).toFixed(1)}s</span>}
      </div>
      <label>
        人工偏移（重算保留）
        <input
          type="range"
          min={-3000}
          max={3000}
          step={50}
          value={row.batch.offsetMs}
          onChange={(e) => onOffset(row.id, Number(e.target.value))}
        />
        <span className={row.batch.offsetMs >= 0 ? "off-plus" : "off-minus"}>
          {row.batch.offsetMs >= 0 ? "+" : ""}
          {(row.batch.offsetMs / 1000).toFixed(2)}s
        </span>
      </label>
      <button onClick={onClose}>完成</button>
    </div>
  );
}
