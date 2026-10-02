import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "../types";
import type { DerivedPlan, ScheduledBatch } from "../engine";
import { fmtAxis, fmtTime } from "../engine";

interface Props {
  plan: Plan;
  derived: DerivedPlan;
  selectedBatchId: string | null;
  onSelectBatch: (id: string | null) => void;
  onMoveMusicPoint: (id: string, time: number) => void;
  onMoveBatchOffset: (id: string, offset: number) => void;
}

const CAT_COLOR: Record<string, string> = {
  礼花弹: "#dc2626",
  罗马烛光: "#f59e0b",
  扇形架: "#1d4ed8",
  冷焰火: "#0d9488",
};

/** 左侧泳道名称槽宽度（px），时间坐标从这里开始 */
const GUTTER = 96;

function useScale(totalDuration: number, zoom: number) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(6);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth - 24;
      const base = w / Math.max(totalDuration, 1);
      setPxPerSec(base * zoom);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalDuration, zoom]);
  return { wrapRef, pxPerSec };
}

export default function Timeline({
  plan,
  derived,
  selectedBatchId,
  onSelectBatch,
  onMoveMusicPoint,
  onMoveBatchOffset,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const { wrapRef, pxPerSec } = useScale(derived.totalDuration, zoom);
  const width = GUTTER + derived.totalDuration * pxPerSec;

  const dragRef = useRef<{
    type: "mp" | "batch";
    id: string;
    startX: number;
    startVal: number;
    base: number;
    moved: boolean;
  } | null>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      if (Math.abs(dx) > 3) d.moved = true;
      if (!d.moved) return;
      const delta = dx / pxPerSec;
      if (d.type === "mp") {
        const t = Math.max(0, Math.round((d.startVal + delta) * 10) / 10);
        onMoveMusicPoint(d.id, t);
      } else {
        const off = Math.round((d.startVal + delta) * 10) / 10;
        onMoveBatchOffset(d.id, Math.max(-d.base, off));
      }
    },
    [pxPerSec, onMoveMusicPoint, onMoveBatchOffset],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
    };
  }, [onPointerMove, endDrag]);

  const startDrag = (type: "mp" | "batch", id: string, startVal: number, base = 0) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { type, id, startX: e.clientX, startVal, base, moved: false };
  };

  const sortedMps = [...plan.musicPoints].sort((a, b) => a.time - b.time);

  // 刻度间隔
  const tickStep = pxPerSec > 20 ? 10 : pxPerSec > 8 ? 20 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= derived.totalDuration; t += tickStep) ticks.push(t);

  return (
    <div className="panel timeline-panel">
      <div className="heading">
        <div>
          <p>时间轴编排</p>
          <h2>按音乐时间点排节目段落与点火批次</h2>
        </div>
        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.max(1, z - 1))} disabled={zoom <= 1}>
            －
          </button>
          <span>{zoom}x</span>
          <button onClick={() => setZoom((z) => Math.min(4, z + 1))} disabled={zoom >= 4}>
            ＋
          </button>
        </div>
      </div>

      <div className="timeline-wrap" ref={wrapRef}>
        <div className="timeline" style={{ width }}>
          {/* 刻度 */}
          <div className="ruler">
            {ticks.map((t) => (
              <span key={t} className="tick" style={{ left: GUTTER + t * pxPerSec }}>
                {fmtAxis(t)}
              </span>
            ))}
          </div>

          {/* 节目段落带 */}
          <div className="bands">
            {sortedMps.map((mp, i) => {
              const next = sortedMps[i + 1];
              const end = next ? next.time : derived.totalDuration;
              const left = GUTTER + mp.time * pxPerSec;
              const w = Math.max(2, (end - mp.time) * pxPerSec);
              return (
                <div
                  key={mp.id}
                  className={`band ${i % 2 ? "odd" : ""}`}
                  style={{ left, width: w }}
                >
                  <span>{mp.label}</span>
                </div>
              );
            })}
          </div>

          {/* 音乐时间点标记 */}
          {sortedMps.map((mp) => (
            <div
              key={mp.id}
              className="mp-flag"
              style={{ left: GUTTER + mp.time * pxPerSec }}
              onPointerDown={startDrag("mp", mp.id, mp.time)}
              title={`${mp.label} · ${fmtTime(mp.time)}（拖拽改时间）`}
            >
              <div className="mp-line" />
              <div className="mp-tag">
                <b>{mp.label}</b>
                <i>{fmtTime(mp.time)}</i>
              </div>
            </div>
          ))}

          {/* 批次泳道（按点位） */}
          <div className="lanes">
            {plan.positions.map((pos) => {
              const rows = derived.scheduled.filter((s) => s.position.id === pos.id);
              return (
                <div className="lane" key={pos.id}>
                  <div className="lane-label">{pos.name}</div>
                  <div className="lane-track">
                    {rows.map((s: ScheduledBatch) => {
                      const color = CAT_COLOR[s.model.category] ?? "#64748b";
                      const left = GUTTER + s.time * pxPerSec;
                      const desiredLeft = GUTTER + s.desiredTime * pxPerSec;
                      const selected = selectedBatchId === s.batch.id;
                      return (
                        <div key={s.batch.id}>
                          {s.queued && (
                            <div
                              className="queue-link"
                              style={{ left: desiredLeft, width: Math.max(2, left - desiredLeft) }}
                            />
                          )}
                          <div
                            className={`batch ${s.queued ? "queued" : ""} ${selected ? "selected" : ""}`}
                            style={{
                              left,
                              borderColor: color,
                              background: s.queued ? "#fff" : color,
                              color: s.queued ? color : "#fff",
                            }}
                            onPointerDown={startDrag("batch", s.batch.id, s.batch.offset, s.musicPoint.time)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!dragRef.current?.moved) onSelectBatch(selected ? null : s.batch.id);
                            }}
                            title={`${s.batch.name} · ${s.model.name} @ ${fmtTime(s.time)}${s.queued ? "（排队顺延）" : ""}`}
                          >
                            {s.queued && <span className="queue-dot">排</span>}
                            {s.batch.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="hint">
        拖拽音乐点旗帜可改时间（绑定批次与后续火力自动重算，人工偏移保留）；拖拽批次方块可改人工偏移。
        <span className="legend">
          <i className="swatch" style={{ background: "#1d4ed8" }} /> 正常
          <i className="swatch queued-swatch" /> 排队顺延
        </span>
      </p>
    </div>
  );
}
