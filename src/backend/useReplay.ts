import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type Control,
  type Session,
  type Snapshot,
  type SeriesSensor,
} from "../data/api";
interface Frame {
  session: Session;
  snapshot: Snapshot;
}
type Operation =
  | { kind: "create"; dataset: string }
  | { kind: "control"; id: string; control: Control };
const frameKey = (id: string | undefined, generation: number | undefined) =>
  ["backend", "frame", id, generation] as const;
export function useReplay(sensor: SeriesSensor) {
  const client = useQueryClient();
  const [binding, setBinding] = useState<Session | null>(null);
  const [stream, setStream] = useState<{
    key: string;
    state: "connected" | "recovering" | "invalid";
  } | null>(null);
  const health = useQuery({
    queryKey: ["backend", "health"],
    queryFn: ({ signal }) => api.health(signal),
    retry: 1,
    refetchInterval: 10000,
  });
  const datasets = useQuery({
    queryKey: ["backend", "datasets"],
    queryFn: ({ signal }) => api.datasets(signal),
    retry: 1,
  });
  const operation = useMutation({
    mutationFn: async (op: Operation): Promise<Frame> => {
      await client.cancelQueries({ queryKey: ["backend", "frame"] });
      await client.cancelQueries({ queryKey: ["backend", "series"] });
      await client.cancelQueries({ queryKey: ["backend", "events"] });
      await client.cancelQueries({ queryKey: ["backend", "event"] });
      const session =
        op.kind === "create"
          ? await api.create(op.dataset)
          : await api.control(op.id, op.control);
      const snapshot = await api.snapshot(session.id);
      if (snapshot.generation !== session.generation)
        throw new Error("재생 세션이 변경되었습니다. 다시 시도하세요.");
      return { session, snapshot };
    },
    onSuccess: (frame) => {
      client.setQueryData(
        frameKey(frame.session.id, frame.session.generation),
        frame,
      );
      setBinding(frame.session);
    },
  });
  const id = binding?.id;
  const generation = binding?.generation;
  const frame = useQuery({
    queryKey: frameKey(id, generation),
    enabled: Boolean(id) && !operation.isPending,
    queryFn: async ({ signal }): Promise<Frame> => {
      const [session, snapshot] = await Promise.all([
        api.session(id!, signal),
        api.snapshot(id!, signal),
      ]);
      if (
        session.generation !== snapshot.generation ||
        snapshot.generation !== generation
      )
        throw new Error(
          "재생 세션 정보가 일치하지 않습니다. 새 세션을 만들어 주세요.",
        );
      return { session, snapshot };
    },
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 1,
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 404
        ? false
        : 1000,
  });
  const sessionGone =
    frame.error instanceof ApiError && frame.error.status === 404;
  useEffect(() => {
    if (!id || generation === undefined || operation.isPending || sessionGone)
      return;
    let alive = true;
    const key = `${id}:${generation}`;
    const es = new EventSource(api.streamUrl(id));
    es.onopen = () => {
      if (alive) setStream({ key, state: "connected" });
    };
    es.onerror = () => {
      if (alive) setStream({ key, state: "recovering" });
    };
    es.addEventListener("snapshot.updated", (event) => {
      if (!alive) return;
      try {
        const payload: unknown = JSON.parse(
          (event as MessageEvent<string>).data,
        );
        if (!payload || typeof payload !== "object" || !("data" in payload))
          throw new Error("Invalid envelope");
        const snapshot = payload.data as Snapshot;
        if (
          !snapshot ||
          typeof snapshot.as_of_ts !== "number" ||
          !snapshot.nodes?.["node-a"]?.metrics ||
          !snapshot.nodes?.["node-b"]?.metrics
        )
          throw new Error("Invalid snapshot");
        // Ignore queued messages from a previous seek or a different replay session.
        if (snapshot.session_id !== id || snapshot.generation !== generation)
          return;
        client.setQueryData<Frame>(frameKey(id, generation), (previous) => {
          if (!previous || snapshot.as_of_ts < previous.snapshot.as_of_ts)
            return previous;
          return { ...previous, snapshot };
        });
      } catch {
        setStream({ key, state: "invalid" });
      }
    });
    return () => {
      alive = false;
      es.close();
    };
  }, [client, id, generation, operation.isPending, sessionGone]);
  const session = frame.data?.session;
  const snapshot = frame.data?.snapshot;
  const asOf = snapshot?.as_of_ts;
  const series = useQuery<{ t: number; a: number | null; b: number | null }[]>({
    queryKey: [
      "backend",
      "series",
      id,
      generation,
      sensor,
      asOf === undefined ? undefined : Math.floor(asOf),
    ],
    placeholderData: (previous, query) =>
      query?.queryKey[2] === id &&
      query?.queryKey[3] === generation &&
      query?.queryKey[4] === sensor
        ? previous
        : undefined,
    enabled:
      Boolean(id && session && snapshot) &&
      !operation.isPending &&
      !sessionGone,
    queryFn: async ({ signal }) => {
      const start = Math.max(session!.start_ts, asOf! - 300);
      const bucket = Math.max(1, Math.ceil((asOf! - start) / 500));
      const [a, b] = await Promise.all([
        api.series(id!, "node-a", sensor, start, asOf!, bucket, signal),
        ["co2", "dp"].includes(sensor)
          ? Promise.resolve([])
          : api.series(id!, "node-b", sensor, start, asOf!, bucket, signal),
      ]);
      const merged = new Map<
        number,
        { t: number; a: number | null; b: number | null }
      >();
      for (const [node, points] of [
        ["a", a],
        ["b", b],
      ] as const)
        for (const point of points) {
          const row = merged.get(point.ts) || { t: point.ts, a: null, b: null };
          row[node] = point.quality === "ok" ? point.value : null;
          merged.set(point.ts, row);
        }
      return [...merged.values()].sort((x, y) => x.t - y.t);
    },
    gcTime: 15_000,
    retry: 1,
  });
  const streamState =
    stream?.key === `${id}:${generation}` ? stream.state : "connecting";
  return {
    health,
    datasets,
    session,
    snapshot,
    frame,
    series,
    operation,
    sessionGone,
    streamState,
    create: (dataset: string) =>
      operation.mutateAsync({ kind: "create", dataset }),
    control: (control: Control) =>
      id
        ? operation.mutateAsync({ kind: "control", id, control })
        : Promise.reject(new Error("먼저 세션을 생성하세요.")),
  };
}
