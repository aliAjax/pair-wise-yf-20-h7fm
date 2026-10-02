import type { PendingItem, SaveState } from "../types";

interface Props {
  save: SaveState;
  pending: PendingItem[];
  forceFail: boolean;
  version: number;
  onCommit: () => void;
  onFlush: () => void;
  onDiscard: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleForceFail: () => void;
}

export default function SaveBar({
  save,
  pending,
  forceFail,
  version,
  onCommit,
  onFlush,
  onDiscard,
  onRestore,
  onToggleForceFail,
}: Props) {
  return (
    <div className="savebar">
      <div className={`save-status ${save.status}`}>
        <span className={`dot ${save.status}`} />
        {save.message || "尚未提交"}
        <em className="dim">（当前编辑 v{version}）</em>
      </div>

      <div className="save-actions">
        <button className="primary" onClick={onCommit} disabled={save.status === "writing"}>
          提交写盘
        </button>
        <button onClick={onFlush} disabled={pending.length === 0 || save.status === "writing"}>
          立即补写{pending.length > 0 ? `（${pending.length}）` : ""}
        </button>
        <label className="fail-switch">
          <input type="checkbox" checked={forceFail} onChange={onToggleForceFail} />
          模拟写盘故障（演示待提交区）
        </label>
      </div>

      {pending.length > 0 && (
        <div className="outbox">
          <h4>待提交区 · {pending.length} 份方案等待补写</h4>
          <p className="dim">
            写盘失败的版本先保存在本地，不会丢失；关闭故障或点击"立即补写"后按顺序续传，页面刷新也会自动恢复。
          </p>
          {pending.map((item) => (
            <div key={item.id} className="outbox-item">
              <div>
                <b>v{item.snapshot.version}</b>
                <span className="dim">
                  {" "}
                  {new Date(item.createdAt).toLocaleTimeString()} · {item.snapshot.plan.batches.length} 批次
                </span>
                <p>{item.reason}</p>
              </div>
              <div className="outbox-btns">
                <button onClick={() => onRestore(item.id)}>载入此版</button>
                <button className="ghost danger-text" onClick={() => onDiscard(item.id)}>
                  丢弃
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
