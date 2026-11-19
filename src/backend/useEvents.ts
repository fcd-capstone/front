import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type AnalysisEvent,
  type HandlingStatus,
} from "../data/api";
export function useEvents(
  id: string | undefined,
  generation: number | undefined,
  enabled: boolean,
  selectedId: string | null,
) {
  const client = useQueryClient();
  const key = ["backend", "events", id, generation];
  const events = useQuery({
    queryKey: key,
    enabled: enabled && !!id,
    queryFn: async ({ signal }) =>
      (await api.events(id!, signal)).filter(
        (event) => event.session_id === id && event.generation === generation,
      ),
    refetchInterval: 1000,
    retry: 1,
  });
  const detailKey = ["backend", "event", id, generation, selectedId];
  const report = useMutation({
    mutationFn: async (body: {
      event: AnalysisEvent;
      handling_status: HandlingStatus;
      note: string;
    }) => {
      if (body.event.session_id !== id || body.event.generation !== generation)
        throw new Error("현재 재생의 이벤트를 다시 선택하세요.");
      await client.cancelQueries({ queryKey: detailKey });
      return api.report(id!, body.event.id, {
        handling_status: body.handling_status,
        note: body.note,
        expected_version: body.event.version,
      });
    },
    onSuccess: async (event) => {
      // Keep late mutation results in their original session/generation cache only.
      client.setQueryData(
        ["backend", "event", event.session_id, event.generation, event.id],
        event,
      );
      await client.invalidateQueries({
        queryKey: ["backend", "events", event.session_id, event.generation],
      });
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409)
        await client.invalidateQueries({ queryKey: detailKey });
    },
  });
  const detail = useQuery({
    queryKey: detailKey,
    enabled: enabled && !!id && !!selectedId && !report.isPending,
    queryFn: async ({ signal }) => {
      const event = await api.event(id!, selectedId!, signal);
      if (event.session_id !== id || event.generation !== generation)
        throw new Error(
          "이전 재생 세대의 이벤트입니다. 목록에서 다시 선택하세요.",
        );
      return event;
    },
    refetchInterval: 2000,
    retry: false,
  });
  return { events, detail, report };
}
