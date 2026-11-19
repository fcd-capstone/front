import { useState } from "react";
import { ChevronRight, Check, ShieldCheck } from "lucide-react";
import { ApiError, type AnalysisEvent, type HandlingStatus } from "../data/api";
import {
  causeNames,
  endReasons,
  handlingNames,
  nextStatuses,
} from "./analysis";
import { useEvents } from "./useEvents";
import styles from "../App.module.css";
export type EventModel = ReturnType<typeof useEvents>;
const stamp = (ts: number) =>
  new Date(ts * 1000).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  }) + " KST";
export default function EventPanel({
  model,
  enabled,
  reason,
  busy,
  onSelect,
  selectedId,
  compact = false,
}: {
  model: EventModel;
  enabled: boolean;
  reason: string;
  busy: boolean;
  onSelect: (id: string) => void;
  selectedId: string | null;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("전체");
  const events = (model.events.data || []).filter(
    (e) =>
      (!compact || e.lifecycle === "active") &&
      (compact || filter === "전체" || e.handling_status === filter),
  );
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{compact ? "대응 이벤트" : "이상 이벤트 및 조치 보고"}</h2>
          <p>
            이상 종료와 조치 완료는 별개입니다. 현재 재생 세대의 이벤트만
            표시합니다.
          </p>
        </div>
        {!compact && (
          <select
            aria-label="이벤트 처리 상태 필터"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="전체">전체</option>
            {Object.entries(handlingNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>
      {!enabled ? (
        <div className={styles.empty}>
          <ShieldCheck size={28} />
          <strong>현재 세션의 분석이 비활성화되어 있습니다</strong>
          <p>
            {reason}
            <br />
            이벤트가 없다는 것은 정상 판정이 아닙니다.
          </p>
        </div>
      ) : busy || model.events.isPending ? (
        <div className={styles.empty}>이벤트를 불러오는 중입니다.</div>
      ) : model.events.isError ? (
        <div className={styles.empty} role="alert">
          이벤트 조회에 실패했습니다.
          <button onClick={() => void model.events.refetch()}>다시 조회</button>
        </div>
      ) : !events.length ? (
        <div className={styles.empty}>
          <strong>표시할 이벤트가 없습니다</strong>
          <p>
            규칙 준비 상태·관찰 구간을 확인하세요. 정상 판정을 의미하지
            않습니다.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>추정 원인</th>
                  <th>발생 시각 (KST)</th>
                  <th>이상 상태</th>
                  <th>설정 점수</th>
                  <th>처리 상태</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {causeNames[e.cause] || e.cause}
                      <small className={styles.eventNodes}>
                        {e.node_ids.join(", ")}
                      </small>
                    </td>
                    <td>{stamp(e.started_ts)}</td>
                    <td>
                      {e.lifecycle === "active" ? "이상 지속" : "이상 종료"}
                    </td>
                    <td className={styles.amberText}>
                      {e.priority.score}
                      <small className={styles.eventNodes}>검증 전 설정</small>
                    </td>
                    <td>
                      <span className={styles.stateBadge}>
                        {handlingNames[e.handling_status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.textButton}
                        disabled={model.report.isPending}
                        onClick={() => onSelect(e.id)}
                      >
                        상세 보기 <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.eventDisclaimer}>
            점수는 규칙 작성자가 설정한 고정값입니다. 가중치 기반 위험도·검증
            정확도·확률을 뜻하지 않습니다.
          </p>
        </>
      )}
      {enabled &&
        selectedId &&
        !busy &&
        (model.detail.isPending ? (
          <div className={styles.empty}>상세 조회 중입니다.</div>
        ) : model.detail.isError ? (
          <div className={styles.integrationInfo} role="alert">
            {model.detail.error instanceof ApiError &&
            model.detail.error.status === 404
              ? "현재 재생 세대에 없는 이벤트입니다. 목록에서 다시 선택하세요."
              : "이벤트 상세를 불러오지 못했습니다."}
          </div>
        ) : (
          model.detail.data && (
            <EventDetail
              key={model.detail.data.id}
              event={model.detail.data}
              model={model}
            />
          )
        ))}
    </section>
  );
}
function EventDetail({
  event,
  model,
}: {
  event: AnalysisEvent;
  model: EventModel;
}) {
  const [status, setStatus] = useState<HandlingStatus>("in_progress");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const allowed = nextStatuses[event.handling_status] || [];
  const target = allowed.includes(status) ? status : allowed[0];
  const reportBusy = model.report.isPending;
  async function submit() {
    setSaved(false);
    if (!target) return;
    try {
      await model.report.mutateAsync({ event, handling_status: target, note });
      setNote("");
      setSaved(true);
    } catch {
      /* Render the mutation error; retain draft for retry. */
    }
  }
  return (
    <div className={styles.eventDetail}>
      <div className={styles.panelHeading}>
        <div>
          <h2>판단 근거 및 조치 보고</h2>
          <p>
            {causeNames[event.cause]} · {event.node_ids.join(", ")} ·{" "}
            {event.lifecycle === "active"
              ? "이상 지속"
              : `이상 종료 · ${endReasons[event.end_reason || ""] || event.end_reason}`}
          </p>
        </div>
        <span className={styles.demoBadge}>서버 저장 · v{event.version}</span>
      </div>
      <div className={styles.detailGrid}>
        <div>
          <h3 className={styles.detailTitle}>규칙 기반 결과 · 검증 전</h3>
          <p className={styles.muted}>
            신뢰도 {event.confidence === null ? "미제공" : event.confidence} ·
            규칙 {event.rule_version} / {event.rule_id}
          </p>
          {event.evidence.map((e, i) => (
            <div className={styles.evidence} key={i}>
              <Check size={15} />
              <span>
                {e.description}
                <small className={styles.eventNodes}>
                  관측값: {e.observed_value ?? "—"}
                  {e.unit ? ` ${e.unit}` : ""}
                </small>
              </span>
            </div>
          ))}
          <div className={styles.action}>
            <strong>권장 확인 사항</strong>
            {event.recommended_actions.length ? (
              event.recommended_actions.map((action, i) => (
                <p key={i}>{action}</p>
              ))
            ) : (
              <p>제공된 권장 조치가 없습니다.</p>
            )}
          </div>
          <p className={styles.eventDisclaimer}>
            발생: {stamp(event.started_ts)}
            {event.ended_ts !== null && <> · 종료: {stamp(event.ended_ts)}</>}
          </p>
        </div>
        <div className={styles.report}>
          <p>
            현재 처리 상태:{" "}
            <strong>{handlingNames[event.handling_status]}</strong>
          </p>
          {allowed.length ? (
            <>
              <label htmlFor="handling-status">변경할 처리 상태</label>
              <select
                id="handling-status"
                value={target}
                disabled={reportBusy}
                onChange={(e) => {
                  setStatus(e.target.value as HandlingStatus);
                  setSaved(false);
                }}
              >
                {allowed.map((v) => (
                  <option key={v} value={v}>
                    {handlingNames[v]}
                  </option>
                ))}
              </select>
              <label htmlFor="handling-note">조치 메모</label>
              <textarea
                id="handling-note"
                maxLength={2000}
                disabled={reportBusy}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setSaved(false);
                }}
                placeholder="상태 변경과 함께 저장할 조치 사항"
              />
              <span className={styles.muted}>
                {note.length}/2000자 · 상태 변경과 함께 저장됩니다.
              </span>
              <button
                className={styles.saveReport}
                disabled={reportBusy || !target}
                onClick={() => void submit()}
              >
                {reportBusy ? "저장 중…" : "조치 보고 저장"}
              </button>
            </>
          ) : (
            <p className={styles.muted}>
              조치가 완료되었습니다. 현재 API는 완료 상태 수정·메모 단독 수정을
              지원하지 않습니다.
            </p>
          )}
          {model.report.isError && (
            <p role="alert" className={styles.reportError}>
              {model.report.error instanceof ApiError &&
              model.report.error.status === 409
                ? "다른 변경과 충돌했습니다. 최신 이벤트를 다시 불러왔습니다. 상태를 확인하고 다시 저장하세요."
                : model.report.error.message}
            </p>
          )}
          {saved && (
            <p role="status" className={styles.reportSuccess}>
              서버에 조치 보고를 저장했습니다.
            </p>
          )}
          <h3 className={styles.detailTitle}>처리 이력</h3>
          {event.reports.length ? (
            event.reports.map((r) => (
              <div className={styles.reportHistory} key={r.id}>
                <strong>{handlingNames[r.handling_status]}</strong>
                <small>{stamp(r.reported_at)}</small>
                <p>{r.note || "메모 없음"}</p>
              </div>
            ))
          ) : (
            <p className={styles.muted}>아직 처리 보고가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
