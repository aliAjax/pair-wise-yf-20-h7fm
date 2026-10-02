import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Plan, WriteJob } from "./types";
import { seedPlan } from "./seed";
import { derive, nextId } from "./engine";

const PLAN_KEY = "fireworks-plan-v1";
const WRITTEN_KEY = "fireworks-written-v1";

function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) return JSON.parse(raw) as Plan;
  } catch {
    /* ignore */
  }
  return seedPlan;
}

function loadWrittenVersion(): number {
  try {
    const raw = localStorage.getItem(WRITTEN_KEY);
    if (raw) return Number(raw) || 0;
  } catch {
    /* ignore */
  }
  return 0;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function usePlan() {
  const [plan, setPlan] = useState<Plan>(loadPlan);
  const [outbox, setOutbox] = useState<WriteJob[]>([]);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [lastWrittenVersion, setLastWrittenVersion] = useState<number>(loadWrittenVersion);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const failureRef = useRef(simulateFailure);
  failureRef.current = simulateFailure;

  /** 提交一次方案变更：版本号 +1，所有视图共用同一版 */
  const commit = useCallback((updater: (p: Plan) => Plan) => {
    setPlan((prev) => {
      const next = updater(prev);
      next.version = prev.version + 1;
      return next;
    });
  }, []);

  /** 写盘：成功则落盘并标记已写入；失败则留在待提交区 */
  const writeVersion = useCallback(async (version: number) => {
    setSaveState("saving");
    setOutbox((ob) =>
      ob.map((j) => (j.version === version && j.status !== "written" ? { ...j, status: "saving" as const } : j)),
    );
    await delay(650);
    if (failureRef.current) {
      setOutbox((ob) => {
        const exists = ob.some((j) => j.version === version);
        const job: WriteJob = {
          id: nextId("job"),
          version,
          status: "failed",
          attempts: (ob.find((j) => j.version === version)?.attempts ?? 0) + 1,
          error: "网络异常：写盘失败，已留在待提交区",
          createdAt: Date.now(),
        };
        return exists
          ? ob.map((j) => (j.version === version ? { ...job, attempts: j.attempts + 1 } : j))
          : [...ob, job];
      });
      setSaveState("error");
      return false;
    }
    // 写盘成功
    setPlan((current) => {
      try {
        localStorage.setItem(PLAN_KEY, JSON.stringify(current));
        localStorage.setItem(WRITTEN_KEY, String(version));
      } catch {
        /* ignore */
      }
      return current;
    });
    setLastWrittenVersion(version);
    setOutbox((ob) => ob.filter((j) => j.version !== version));
    setSaveState("saved");
    return true;
  }, []);

  /** 触发写盘（把当前版本加入待提交区并写） */
  const writeToDisk = useCallback(() => {
    setOutbox((ob) => {
      if (ob.some((j) => j.version === plan.version && j.status !== "written")) return ob;
      return [
        ...ob,
        { id: nextId("job"), version: plan.version, status: "pending" as const, attempts: 0, createdAt: Date.now() },
      ];
    });
    void writeVersion(plan.version);
  }, [plan.version, writeVersion]);

  /** 待提交区补写（单个） */
  const retryJob = useCallback(
    (version: number) => {
      void writeVersion(version);
    },
    [writeVersion],
  );

  /** 恢复：失败开关关闭后，自动补写待提交区全部失败/挂起任务 */
  useEffect(() => {
    if (simulateFailure) return;
    const pending = outbox.filter((j) => j.status === "failed" || j.status === "pending");
    if (pending.length === 0) return;
    const timers = pending.map((j) => setTimeout(() => void writeVersion(j.version), 200));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulateFailure]);

  const derived = useMemo(() => derive(plan), [plan]);
  const dirty = plan.version !== lastWrittenVersion;

  return {
    plan,
    setPlan,
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
  };
}
