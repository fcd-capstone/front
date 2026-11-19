import type { Cause } from "../domain/types";
import type { Session, Snapshot, HandlingStatus } from "../data/api";
export const causeNames: Record<Cause | "normal", string> = {
  normal: "정상 (실험 라벨)",
  worker_activity: "작업자 활동",
  external_inflow: "외부 환경 유입",
  hvac_fault: "공조·환기 이상",
  equipment_fault: "장비·공정 이상",
  sensor_fault: "센서 이상",
};
export const handlingNames: Record<HandlingStatus, string> = {
  new: "미확인",
  acknowledged: "접수",
  in_progress: "확인 중",
  resolved: "조치 완료",
};
export const nextStatuses: Record<HandlingStatus, HandlingStatus[]> = {
  new: ["acknowledged", "in_progress", "resolved"],
  acknowledged: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: [],
};
export const endReasons: Record<string, string> = {
  recovered: "센서 조건 회복",
  session_stopped: "재생 중지",
  dataset_ended: "데이터 종료",
  seek_reset: "시점 이동",
};
export function supportsEvents(version?: string) {
  if (!version) return false;
  const [major, minor] = version.split(".").map(Number);
  return major > 0 || (major === 0 && minor >= 3);
}
export function analysisLabel(session?: Session, snapshot?: Snapshot) {
  if (!session)
    return {
      title: "시작 전",
      description: "세션을 생성하면 분석 상태를 확인합니다.",
    };
  if (!snapshot || snapshot.analysis.status === "disabled") {
    const reason: Record<string, string> = {
      format_only: "샘플은 형식 확인용이며 분석하지 않습니다.",
      calibration_only: "보정 데이터는 원인 판별에 사용하지 않습니다.",
      rules_not_configured: "검증된 규칙이 아직 설정되지 않았습니다.",
      analysis_not_implemented: "현재 서버는 원인 판별을 지원하지 않습니다.",
    };
    return {
      title:
        session.analysis_reason === "rules_not_configured"
          ? "규칙 미설정"
          : "분석 비활성",
      description:
        reason[session.analysis_reason] ||
        "현재 세션의 분석이 비활성화되어 있습니다.",
    };
  }
  if (
    snapshot.analysis.status === "warming_up" ||
    snapshot.analysis.decision_status === "warming_up"
  )
    return {
      title: "분석 준비 중",
      description: "규칙에 필요한 관찰 구간을 수집하고 있습니다.",
    };
  if (snapshot.analysis.decision_status === "anomaly")
    return {
      title: snapshot.analysis.cause
        ? causeNames[snapshot.analysis.cause]
        : "복수 원인",
      description: "검증 전 규칙 결과 · 신뢰도 미제공",
    };
  if (snapshot.analysis.decision_status === "no_rule_match")
    return {
      title: "규칙 미충족",
      description: "설정 조건 미충족이며 정상 판정은 아닙니다.",
    };
  return {
    title: "판별 보류",
    description: "근거가 부족하거나 규칙 판정이 불확실합니다.",
  };
}
