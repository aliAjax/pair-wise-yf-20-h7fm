import { useMemo, useState } from "react";
import "./styles.css";
import Timeline from "./components/Timeline";
import PositionMap from "./components/PositionMap";
import FiringTable from "./components/FiringTable";
import ConflictPanel from "./components/ConflictPanel";
import ShowPreview from "./components/ShowPreview";
import SaveBar from "./components/SaveBar";
import { usePlanStore } from "./storage";
import {
  computeConflicts,
  computePositionStats,
  computeQueue,
  computeRows,
  uid,
} from "./engine";
import type { Conflict } from "./types";

export default function App() {
  const store = usePlanStore();
  const { plan, mutate } = store;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"timeline" | "map" | "preview">("timeline");

  // 单一派生源：时间轴、点位图、整场预览全部读这同一份结果，保证"同一版方案"
  const queue = useMemo(() => computeQueue(plan), [plan]);
  const rows = useMemo(() => computeRows(plan, queue), [plan, queue]);
  const stats = useMemo(() => computePositionStats(plan, rows), [plan, rows]);
  const conflicts = useMemo(() => computeConflicts(plan, queue, rows), [plan, queue, rows]);

  const dangerCount = conflicts.filter((c) => c.level === "danger").length;
  const queueCount = conflicts.filter((c) => c.kind === "queue").length;

  const locate = (c: Conflict) => {
    const first = c.batchIds[0];
    if (first) setSelectedId(first);
    setTab(c.kind === "safety" || c.kind === "queue" ? "map" : "timeline");
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="kicker">hxyfront-62008 · 燃放脚本编排台</p>
          <h1>
            音乐时间点 → 节目段落 → 点火批次
            <span className="version">v{plan.version}</span>
          </h1>
          <p className="sub">
            音乐时间点是唯一时间源：改时间点，绑定批次与后续火力自动重算，人工偏移和手动角度保留；点位容量不够自动排队。
          </p>
        </div>
        <div className="metrics">
          <div>
            <small>音乐时间点</small>
            <b>{plan.markers.length}</b>
          </div>
          <div>
            <small>点火批次</small>
            <b>{plan.batches.length}</b>
          </div>
          <div className={queueCount ? "warn" : ""}>
            <small>排队批次</small>
            <b>{queueCount}</b>
          </div>
          <div className={dangerCount ? "danger" : ""}>
            <small>安全冲突</small>
            <b>{dangerCount}</b>
          </div>
        </div>
      </header>

      <SaveBar
        save={store.save}
        pending={store.pending}
        forceFail={store.forceFail}
        version={plan.version}
        onCommit={store.commit}
        onFlush={store.flush}
        onDiscard={store.discardPending}
        onRestore={store.restorePending}
        onToggleForceFail={store.toggleForceFail}
      />

      <section className="panel conflict-panel">
        <h2>冲突时间提示</h2>
        <ConflictPanel conflicts={conflicts} onLocate={locate} />
      </section>

      <nav className="tabs">
        <button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>
          时间轴编排
        </button>
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
          燃放点位平面图
        </button>
        <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
          整场节目预览
        </button>
        <span className="tab-sync">三视图同读 v{plan.version}，修改任一处即时同步</span>
      </nav>

      {tab === "timeline" && (
        <section className="panel">
          <h2>时间轴编排</h2>
          <Timeline
            plan={plan}
            rows={rows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMoveMarker={(markerId, timeMs) =>
              mutate((d) => {
                const m = d.markers.find((x) => x.id === markerId);
                if (m) m.timeMs = Math.max(0, timeMs);
              })
            }
            onRenameMarker={(markerId, label) =>
              mutate((d) => {
                const m = d.markers.find((x) => x.id === markerId);
                if (m) m.label = label;
              })
            }
            onBatchOffset={(batchId, offsetMs) =>
              mutate((d) => {
                const b = d.batches.find((x) => x.id === batchId);
                if (b) b.offsetMs = offsetMs;
              })
            }
          />
        </section>
      )}

      {tab === "map" && (
        <section className="panel">
          <h2>燃放点位平面图</h2>
          <PositionMap
            plan={plan}
            stats={stats}
            rows={rows}
            conflicts={conflicts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>
      )}

      {tab === "preview" && (
        <section className="panel">
          <ShowPreview plan={plan} rows={rows} stats={stats} version={plan.version} />
        </section>
      )}

      <section className="panel">
        <h2>点火批次明细</h2>
        <FiringTable
          plan={plan}
          rows={rows}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={({ markerId, positionId, productId }) =>
            mutate((d) => {
              d.batches.push({
                id: uid("b"),
                markerId,
                positionId,
                productId,
                offsetMs: 0,
                angleOverride: null,
              });
            })
          }
          onRemove={(batchId) =>
            mutate((d) => {
              d.batches = d.batches.filter((b) => b.id !== batchId);
            })
          }
          onOffset={(batchId, offsetMs) =>
            mutate((d) => {
              const b = d.batches.find((x) => x.id === batchId);
              if (b) b.offsetMs = offsetMs;
            })
          }
          onAngle={(batchId, angle) =>
            mutate((d) => {
              const b = d.batches.find((x) => x.id === batchId);
              if (b) b.angleOverride = angle;
            })
          }
        />
      </section>

      <section className="panel model-panel">
        <h2>点位容量 / 型号口径速查</h2>
        <div className="model-grid">
          <div>
            <h3>点位</h3>
            <table className="mini-table">
              <thead>
                <tr><th>点位</th><th>纵深</th><th>容量</th><th>本版最大口径</th><th>要求安全</th></tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.position.id} className={s.audienceGapM < 0 ? "row-danger" : ""}>
                    <td>{s.position.name}</td>
                    <td className="mono">{s.position.y}m</td>
                    <td className="mono">{s.position.capacity} 通道</td>
                    <td className="mono">{s.maxCaliber ? `${s.maxCaliber}mm` : "—"}</td>
                    <td className="mono">{s.requiredSafeM ? `${s.requiredSafeM}m` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3>型号清单</h3>
            <table className="mini-table">
              <thead>
                <tr><th>型号</th><th>口径</th><th>默认角</th><th>占用</th><th>安全距离</th></tr>
              </thead>
              <tbody>
                {plan.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="mono">{p.caliberMm}mm</td>
                    <td className="mono">{p.angleDeg}°</td>
                    <td className="mono">{(p.durationMs / 1000).toFixed(1)}s</td>
                    <td className="mono">{p.safeDistanceM}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
