import type { WriteJob } from "../types";
import { fmtTime } from "../engine";

interface Props {
  outbox: WriteJob[];
  simulateFailure: boolean;
  onToggleFailure: (v: boolean) => void;
  onRetry: (version: number) => void;
  lastWrittenVersion: number;
  currentVersion: number;
  saveState: "idle" | "saving" | "saved" | "error";
}

export default function Outbox({
  outbox,
  simulateFailure,
  onToggleFailure,
  onRetry,
  lastWrittenVersion,
  currentVersion,
  saveState,
}: Props) {
  const failed = outbox.filter((j) => j.status === "failed");
  const pending = outbox.filter((j) => j.status === "pending" || j.status === "saving");

  return (
    <div className="panel outbox-panel">
      <div className="heading">
        <div>
          <p>写盘与待提交区</p>
          <h2>写盘失败先留这里，恢复后补写</h2>
        </div>
        <label className="fail-toggle">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => onToggleFailure(e.target.checked)}
          />
          模拟写盘失败
        </label>
      </div>

      <div className="save-status">
        <span className={`status-dot ${saveState}`} />
        {saveState === "saving" && "正在写盘…"}
        {saveState === "saved" && `已写入磁盘（v${lastWrittenVersion}）`}
        {saveState === "error" && "写盘失败，任务已留在待提交区"}
        {saveState === "idle" &&
          (currentVersion === lastWrittenVersion
            ? `已写入 v${lastWrittenVersion}，无未保存变更`
            : `当前 v${currentVersion} 未写入（最后写入 v${lastWrittenVersion}）`)}
      </div>

      {outbox.length === 0 ? (
        <p className="empty">待提交区为空。每次「写盘」会把当前方案版本加入队列。</p>
      ) : (
        <ul className="outbox-list">
          {outbox.map((j) => (
            <li key={j.id} className={`job ${j.status}`}>
              <div>
                <b>方案版本 v{j.version}</b>
                <p>
                  {j.status === "pending" && "等待写盘"}
                  {j.status === "saving" && "正在写盘…"}
                  {j.status === "failed" && `${j.error}（第 ${j.attempts} 次）`}
                  {j.status === "written" && "已写入"}
                </p>
              </div>
              {j.status === "failed" && (
                <button className="primary" onClick={() => onRetry(j.version)}>
                  补写
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {failed.length > 0 && !simulateFailure && (
        <p className="recover-note">检测到网络恢复，待提交区任务将自动补写。</p>
      )}
      {pending.length > 0 && <p className="recover-note">有 {pending.length} 个任务正在排队写盘。</p>}
    </div>
  );
}
