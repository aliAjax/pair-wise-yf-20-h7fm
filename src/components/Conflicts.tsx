import type { DerivedPlan } from "../engine";

export default function Conflicts({ derived }: { derived: DerivedPlan }) {
  const errors = derived.conflicts.filter((c) => c.level === "error");
  const warns = derived.conflicts.filter((c) => c.level === "warn");

  return (
    <div className="panel conflicts-panel">
      <div className="heading">
        <div>
          <p>冲突与校验</p>
          <h2>排队 · 口径 · 安全距离</h2>
        </div>
        <span className="conflict-count">
          {errors.length > 0 && <em className="err">{errors.length} 错误</em>}
          {warns.length > 0 && <em className="wrn">{warns.length} 排队</em>}
          {errors.length === 0 && warns.length === 0 && <em className="ok">全部正常</em>}
        </span>
      </div>
      {derived.conflicts.length === 0 ? (
        <p className="empty">未发现冲突，各点位容量、口径、安全距离均满足。</p>
      ) : (
        <ul className="conflict-list">
          {derived.conflicts.map((c) => (
            <li key={c.id} className={c.level}>
              <span className="level-tag">{c.level === "error" ? "错误" : "排队"}</span>
              {c.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
