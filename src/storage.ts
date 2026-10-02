import { useCallback, useEffect, useRef, useState } from "react";
import type { PendingItem, Plan, SaveState, Snapshot } from "./types";
import { createInitialPlan } from "./engine";

/**
 * 写盘层：服务端用 localStorage 模拟，但写入是"不稳定"的。
 * 任何一次提交失败，快照都不会丢——先落进本地待提交区（outbox），
 * 页面恢复（刷新/重开）时自动继续补写，直到成功为止。
 */

const PLAN_KEY = "firing.plan.v1";
const OUTBOX_KEY = "firing.outbox.v1";
const FORCE_FAIL_KEY = "firing.forceFail.v1";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadPlan(): Plan {
  const saved = readJSON<Plan | null>(PLAN_KEY, null);
  if (saved && saved.markers && saved.batches) return saved;
  return createInitialPlan();
}

function loadOutbox(): PendingItem[] {
  return readJSON<PendingItem[]>(OUTBOX_KEY, []);
}

export function getForceFail(): boolean {
  return readJSON<boolean>(FORCE_FAIL_KEY, false);
}

/** 演示开关：打开后所有写盘请求失败，用来观察待提交区与恢复补写 */
export function setForceFail(on: boolean) {
  try {
    localStorage.setItem(FORCE_FAIL_KEY, JSON.stringify(on));
  } catch {
    /* ignore */
  }
}

/** 模拟一次不稳定的网络写盘，带延时 */
function remoteWrite(snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const latency = 280 + Math.random() * 420;
    setTimeout(() => {
      if (getForceFail() || Math.random() < 0.12) {
        reject(new Error("写盘失败：网络抖动或服务端暂不可用"));
        return;
      }
      try {
        localStorage.setItem(PLAN_KEY, JSON.stringify(snapshot.plan));
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error("本地存储不可用"));
      }
    }, latency);
  });
}

function persistOutbox(items: PendingItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function usePlanStore() {
  const [plan, setPlan] = useState<Plan>(loadPlan);
  const [pending, setPending] = useState<PendingItem[]>(loadOutbox);
  const [save, setSave] = useState<SaveState>({ status: "idle", message: "" });
  const [forceFail, setForceFailState] = useState<boolean>(getForceFail);
  const flushing = useRef(false);

  const mutate = useCallback((fn: (draft: Plan) => void) => {
    setPlan((prev) => {
      const draft: Plan = structuredClone(prev);
      fn(draft);
      draft.version += 1;
      return draft;
    });
  }, []);

  const pushOutbox = useCallback((item: PendingItem) => {
    setPending((prev) => {
      // 同一对象只保留最新版本（旧版本会被新版本覆盖提交）
      const next = [...prev.filter((x) => x.id !== item.id), item];
      persistOutbox(next);
      return next;
    });
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSave({ status: "writing", message: "正在写盘…" });
    try {
      let items = pending.length ? pending : readJSON<PendingItem[]>(OUTBOX_KEY, []);
      while (items.length) {
        const head = items[0];
        await remoteWrite(head.snapshot);
        items = items.slice(1);
        persistOutbox(items);
        setPending(items);
      }
      setSave({ status: "idle", message: "方案已写盘" });
    } catch (e) {
      setSave({
        status: "error",
        message: e instanceof Error ? e.message : "写盘失败",
      });
    } finally {
      flushing.current = false;
    }
  }, [pending]);

  /** 提交当前版本：先尝试写盘，失败就放进待提交区 */
  const commit = useCallback(async () => {
    const snapshot: Snapshot = {
      plan,
      version: plan.version,
      savedAt: new Date().toISOString(),
    };
    setSave({ status: "writing", message: "正在写盘…" });
    try {
      await remoteWrite(snapshot);
      setSave({ status: "idle", message: `v${plan.version} 已写盘` });
    } catch (e) {
      const item: PendingItem = {
        id: `pend_${snapshot.savedAt}_${plan.version}`,
        createdAt: Date.now(),
        snapshot,
        reason: e instanceof Error ? e.message : "写盘失败",
      };
      pushOutbox(item);
      setSave({
        status: "error",
        message: `v${plan.version} 写盘失败，已留在待提交区，恢复后自动补写`,
      });
    }
  }, [plan, pushOutbox]);

  const discardPending = useCallback((id: string) => {
    setPending((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persistOutbox(next);
      return next;
    });
  }, []);

  const restorePending = useCallback((id: string) => {
    const item = pending.find((x) => x.id === id);
    if (!item) return;
    setPlan({ ...structuredClone(item.snapshot.plan), version: item.snapshot.version });
    setSave({ status: "idle", message: `已载入待提交版本 v${item.snapshot.version}（仍需补写）` });
  }, [pending]);

  const toggleForceFail = useCallback(() => {
    setForceFailState((prev) => {
      setForceFail(!prev);
      return !prev;
    });
  }, []);

  // 页面恢复时：有待提交快照就继续补写
  useEffect(() => {
    const queued = loadOutbox();
    if (queued.length) {
      setPending(queued);
      setSave({
        status: "error",
        message: `检测到 ${queued.length} 份未写盘方案，正在继续补写…`,
      });
      // 等首帧渲染后再发起
      const t = setTimeout(() => {
        flush();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [flush]);

  return {
    plan,
    mutate,
    commit,
    flush,
    pending,
    discardPending,
    restorePending,
    save,
    forceFail,
    toggleForceFail,
  };
}
