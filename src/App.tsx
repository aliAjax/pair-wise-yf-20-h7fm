import { useCallback, useMemo, useState } from "react";
import { usePlan } from "./usePlan";
import { nextId } from "./engine";
import type { Batch } from "./types";
import Timeline from "./components/Timeline";
import PositionMap from "./components/PositionMap";
import ShowPreview from "./components/ShowPreview";
import Outbox from "./components/Outbox";
import Inspector from "./components/Inspector";
import PositionCalc from "./components/PositionCalc";
import ModelCatalog from "./components/ModelCatalog";
import Conflicts from "./components/Conflicts";

export default function App() {
  const {
    plan,
    commit,
    derived,
    outbox,
    simulateFailure,
    setSimulateFailure,
    lastWrittenVersion,
    saveState,
    dirty,
    writeToDisk,
    retryJob,
  } = usePlan();

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  const selected = useMemo(
    () => derived.scheduled.find((s) => s.batch.id === selectedBatchId) ?? null,
    [derived.scheduled, selectedBatchId],
  );

  const moveMusicPoint = useCallback(
    (id: string, time: number) =>
      commit((p) => ({
        ...p,
        musicPoints: p.musicPoints.map((m) => (m.id === id ? { ...m, time } : m)),
      })),
    [commit],
  );

  const moveBatchOffset = useCallback(
    (id: string, offset: number) =>
      commit((p) => ({
        ...p,
        batches: p.batches.map((b) => (b.id === id ? { ...b, offset } : b)),
      })),
    [commit],
  );

  const updateBatch = useCallback(
    (id: string, patch: Partial<Batch>) =>
      commit((p) => ({
        ...p,
        batches: p.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),
    [commit],
  );

  const deleteBatch = useCallback(
    (id: string) => {
      commit((p) => ({ ...p, batches: p.batches.filter((b) => b.id !== id) }));
      setSelectedBatchId(null);
    },
    [commit],
  );

  const addBatch = useCallback(() => {
    const id = nextId("b");
    commit((p) => ({
      ...p,
      batches: [
        ...p.batches,
        {
          id,
          name: "新批次",
          musicPointId: p.musicPoints[0]?.id ?? "",
          offset: 0,
          positionId: p.positions[0]?.id ?? "",
          modelId: p.models[0]?.id ?? "",
          quantity: 1,
        },
      ],
    }));
    setSelectedBatchId(id);
  }, [commit]);

  const addMusicPoint = useCallback(() => {
    commit((p) => {
      const last = p.musicPoints.reduce((a, m) => Math.max(a, m.time), 0);
      return {
        ...p,
        musicPoints: [...p.musicPoints, { id: nextId("mp"), label: "新段落", time: Math.round((last + 10) * 10) / 10 }],
      };
    });
  }, [commit]);

  return (
    <main className="app console">
      <header className="topbar">
        <div className="topbar-title">
          <p>燃放脚本编排台</p>
          <h1>{plan.title}</h1>
        </div>
        <div className="topbar-actions">
          <span className={`version-badge ${dirty ? "dirty" : "clean"}`}>方案版本 v{plan.version}</span>
          <span className={`save-state ${saveState}`}>
            {saveState === "saving" && "写盘中…"}
            {saveState === "saved" && `已写入 v${lastWrittenVersion}`}
            {saveState === "error" && "写盘失败 · 待补写"}
            {saveState === "idle" && (dirty ? "有未写入变更" : "已写入")}
          </span>
          <label className="fail-toggle">
            <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
            模拟写盘失败
          </label>
          <button className="primary" onClick={writeToDisk} disabled={saveState === "saving"}>
            写盘
          </button>
        </div>
      </header>

      <ShowPreview plan={plan} derived={derived} />

      <div className="grid grid-main">
        <Timeline
          plan={plan}
          derived={derived}
          selectedBatchId={selectedBatchId}
          onSelectBatch={setSelectedBatchId}
          onMoveMusicPoint={moveMusicPoint}
          onMoveBatchOffset={moveBatchOffset}
        />
        <Inspector
          plan={plan}
          selected={selected}
          onUpdateBatch={updateBatch}
          onDeleteBatch={deleteBatch}
          onAddBatch={addBatch}
          onAddMusicPoint={addMusicPoint}
        />
      </div>

      <div className="grid grid-mid">
        <PositionMap
          plan={plan}
          derived={derived}
          selectedPositionId={selectedPositionId}
          onSelectPosition={setSelectedPositionId}
        />
        <Outbox
          outbox={outbox}
          simulateFailure={simulateFailure}
          onToggleFailure={setSimulateFailure}
          onRetry={retryJob}
          lastWrittenVersion={lastWrittenVersion}
          currentVersion={plan.version}
          saveState={saveState}
        />
      </div>

      <PositionCalc
        plan={plan}
        derived={derived}
        selectedPositionId={selectedPositionId}
        onSelectPosition={setSelectedPositionId}
      />

      <div className="grid grid-low">
        <Conflicts derived={derived} />
        <ModelCatalog plan={plan} />
      </div>

      <footer className="footnote">
        时间轴、点位图与整场预览均由同一版方案（v{plan.version}）派生；音乐时间点变更会重算绑定批次与后续火力，人工偏移保留。
      </footer>
    </main>
  );
}
