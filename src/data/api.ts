import type { NodeId, Metric } from "../domain/types";
export type SeriesSensor = Exclude<Metric, "humid"> | "motion";
export type Quality =
  | "ok"
  | "missing"
  | "disabled"
  | "not_installed"
  | "saturated"
  | "warmup"
  | "stale";
export interface Health {
  status: string;
  version: string;
  capabilities: {
    live: boolean;
    replay: boolean;
    analysis: boolean;
    labels: boolean;
  };
}
export interface Dataset {
  id: string;
  name: string;
  kind: string;
  start_ts: number;
  end_ts: number;
}
export interface Session {
  id: string;
  dataset_id: string;
  mode: "replay";
  state: "paused" | "running" | "stopped" | "completed";
  speed: number;
  virtual_ts: number;
  start_ts: number;
  end_ts: number;
  generation: number;
  analysis_status: string;
  analysis_reason: string;
}
export interface SensorValue {
  value: number | null;
  unit: string;
  quality: Quality;
  last_valid_ts: number | null;
}
export interface Snapshot {
  session_id: string;
  generation: number;
  mode: "replay";
  as_of_ts: number;
  nodes: Record<
    NodeId,
    {
      node: NodeId;
      last_sample_ts: number | null;
      connection: string;
      replay_data_state: "not_started" | "gap" | "normal";
      metrics: Record<Metric | "motion", SensorValue>;
    }
  >;
  analysis: { status: string; decision_status: string };
  active_event_count: number;
}
export interface Point {
  ts: number;
  value: number | null;
  quality: Quality;
  count: number;
}
export type Control =
  | { action: "play" | "pause" | "stop" }
  | { action: "seek"; ts: number }
  | { action: "set_speed"; speed: number };
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
export const apiBase = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 15000);
  try {
    const response = await fetch(apiBase + path, {
      method,
      signal: signal
        ? AbortSignal.any([signal, timeout.signal])
        : timeout.signal,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const content: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        content && typeof content === "object" && "detail" in content
          ? content.detail
          : null;
      throw new ApiError(
        response.status,
        `HTTP ${response.status}: ${typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : response.statusText}`,
      );
    }
    if (!content || typeof content !== "object" || !("data" in content))
      throw new Error("API 응답에 data 필드가 없습니다.");
    return content.data as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.signal.aborted)
      throw new Error(
        "API 응답 시간이 초과되었습니다. 백엔드 상태를 확인하세요.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "백엔드에 연결할 수 없습니다. 서버 주소와 실행 상태를 확인하세요.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export const api = {
  health: (signal?: AbortSignal) =>
    request<Health>("/health", "GET", undefined, signal),
  datasets: (signal?: AbortSignal) =>
    request<Dataset[]>("/datasets", "GET", undefined, signal),
  create: (dataset_id: string) =>
    request<Session>("/sessions", "POST", {
      mode: "replay",
      dataset_id,
      speed: 1,
    }),
  session: (id: string, signal?: AbortSignal) =>
    request<Session>(
      `/sessions/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      signal,
    ),
  snapshot: (id: string, signal?: AbortSignal) =>
    request<Snapshot>(
      `/sessions/${encodeURIComponent(id)}/snapshot`,
      "GET",
      undefined,
      signal,
    ),
  control: (id: string, control: Control) =>
    request<Session>(
      `/sessions/${encodeURIComponent(id)}/replay`,
      "PATCH",
      control,
    ),
  series: async (
    id: string,
    node: NodeId,
    sensor: SeriesSensor,
    start: number,
    end: number,
    bucket: number,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({
      node,
      sensor,
      start_ts: String(start),
      end_ts: String(end),
      bucket_seconds: String(bucket),
      max_points: "600",
    });
    return (
      await request<{ points: Point[] }>(
        `/sessions/${encodeURIComponent(id)}/series?${params}`,
        "GET",
        undefined,
        signal,
      )
    ).points;
  },
  streamUrl: (id: string) =>
    `${apiBase}/sessions/${encodeURIComponent(id)}/stream`,
};
