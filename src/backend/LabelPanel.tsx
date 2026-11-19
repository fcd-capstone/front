import { useQuery } from "@tanstack/react-query";
import { api } from "../data/api";
import { causeNames } from "./analysis";
import styles from "../App.module.css";
const stamp = (ts: number) =>
  new Date(ts * 1000).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  }) + " KST";
const exclusions: Record<string, string> = {
  cancelled: "실험 취소",
  pilot_timing_or_motion: "파일럿 시각·모션 오염",
};
export default function LabelPanel({
  datasetId,
  enabled,
  experiment,
}: {
  datasetId?: string;
  enabled: boolean;
  experiment: boolean;
}) {
  const query = useQuery({
    queryKey: ["backend", "labels", datasetId],
    enabled: enabled && experiment && !!datasetId,
    queryFn: ({ signal }) => api.labels(datasetId!, signal),
    retry: 1,
  });
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>실험 회차 라벨</h2>
          <p>선택한 데이터셋의 현장 기록입니다. 자동 판별 결과와 구분합니다.</p>
        </div>
      </div>
      {!enabled ? (
        <div className={styles.integrationInfo}>
          현재 서버는 실험 라벨 API를 지원하지 않습니다.
        </div>
      ) : !experiment ? (
        <div className={styles.integrationInfo}>
          실험용 데이터셋을 선택하면 회차 라벨을 조회합니다.
        </div>
      ) : query.isPending ? (
        <div className={styles.empty}>라벨을 불러오는 중입니다.</div>
      ) : query.isError ? (
        <div className={styles.integrationInfo} role="alert">
          실험 라벨 조회에 실패했습니다.
          <button onClick={() => void query.refetch()}>다시 조회</button>
        </div>
      ) : !query.data?.length ? (
        <div className={styles.empty}>
          이 데이터셋에 연결된 회차 라벨이 없습니다.
        </div>
      ) : (
        <>
          <div className={styles.integrationInfo}>
            회차 {query.data.length}개 · 평가 제외{" "}
            {query.data.filter((r) => r.excluded_reason).length}개. 센서 제외
            표시는 오프라인 평가에만 적용되며 현재 재생값을 변경하지 않습니다.
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>회차 / 출처</th>
                  <th>실험 원인</th>
                  <th>시작 / 종료 (KST)</th>
                  <th>평가 제외·센서 마스크</th>
                  <th>대상 / 강도</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((r) => (
                  <tr key={`${r.source}-${r.run}`}>
                    <td>
                      #{r.run}
                      <small className={styles.eventNodes}>{r.source}</small>
                    </td>
                    <td>{causeNames[r.cause] || r.cause}</td>
                    <td>
                      {stamp(r.start_ts)}
                      <small className={styles.eventNodes}>
                        {stamp(r.end_ts)}
                      </small>
                    </td>
                    <td>
                      {r.excluded_reason
                        ? exclusions[r.excluded_reason] || r.excluded_reason
                        : "회차 제외 없음"}
                      {r.mask_pm && (
                        <small className={styles.eventNodes}>
                          PM 제외 (오프라인 평가)
                        </small>
                      )}
                      {r.mask_a_motion && (
                        <small className={styles.eventNodes}>
                          A 모션 제외 (오프라인 평가)
                        </small>
                      )}
                    </td>
                    <td>
                      {r.target_node || "—"} / {r.intensity || "—"}
                    </td>
                    <td className={styles.labelNote}>
                      {r.note || "—"}
                      {r.end_note && (
                        <small className={styles.eventNodes}>
                          {r.end_note}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
