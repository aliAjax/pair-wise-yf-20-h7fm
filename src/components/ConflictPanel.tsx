import type { Conflict } from "../types";

export default function ConflictPanel({
  conflicts,
  onLocate,
}: {
  conflicts: Conflict[];
  onLocate: (c: Conflict) => void;
}) {
  return (
    <div className="conflicts">
      {conflicts.length === 0 && <div className="all-clear">✓ 当前版本没有冲突，点位容量与安全距离均满足</div>}
      {conflicts.map((c) => (
        <button key={c.id} className={`conflict ${c.level}`} onClick={() => onLocate(c)}>
          <span className="conflict-kind">
            {c.kind === "queue" ? "容量排队" : c.kind === "safety" ? "安全距离" : "窗口交叠"}
          </span>
          <span className="conflict-msg">{c.message}</span>
          <span className="conflict-go">定位 →</span>
        </button>
      ))}
    </div>
  );
}
