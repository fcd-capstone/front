import type {
  Cause,
  Incident,
  Metric,
  Reading,
  SensorSource,
} from "../domain/types";
export const causes: Record<Cause, string> = {
  worker_activity: "작업자 활동",
  external_inflow: "외부 환경 유입",
  hvac_fault: "공조·환기 이상",
  equipment_fault: "장비·공정 이상",
  sensor_fault: "센서 이상",
};
export const metrics: Record<
  Metric,
  { label: string; unit: string; digits: number }
> = {
  temp: { label: "온도", unit: "°C", digits: 1 },
  humid: { label: "습도", unit: "%", digits: 1 },
  pm1: { label: "PM1.0", unit: "µg/m³", digits: 0 },
  pm10: { label: "PM10", unit: "µg/m³", digits: 0 },
  pm25: { label: "PM2.5", unit: "µg/m³", digits: 0 },
  tvoc: { label: "TVOC", unit: "ppb", digits: 0 },
  eco2: { label: "추정 CO₂", unit: "ppm", digits: 0 },
  co2: { label: "실측 CO₂", unit: "ppm", digits: 0 },
  dp: { label: "차압", unit: "Pa", digits: 2 },
};
export const baseTs = Date.UTC(2026, 10, 17, 9, 0, 0) / 1000;
export const duration = 120;
const details: Record<
  Cause,
  Pick<Incident, "evidence" | "action" | "node" | "score" | "confidence">
> = {
  worker_activity: {
    node: "node-a",
    score: 67,
    confidence: 0.91,
    evidence: ["노드 A 모션 신호 감지", "모션과 함께 PM2.5 및 실측 CO₂ 상승"],
    action: "작업 구역과 활동 내용을 확인하세요.",
  },
  external_inflow: {
    node: "node-b",
    score: 86,
    confidence: 0.94,
    evidence: [
      "차압이 2 Pa에서 0 부근으로 감소",
      "노드 B의 PM2.5가 먼저 상승하고 A가 뒤따름",
    ],
    action: "도어 및 개구부의 개방 여부를 확인하세요.",
  },
  hvac_fault: {
    node: "node-a",
    score: 82,
    confidence: 0.89,
    evidence: [
      "차압 저하가 지속됨",
      "두 노드 온·습도와 노드 A 실측 CO₂가 완만하게 상승",
    ],
    action: "급기 팬 작동과 필터 상태를 확인하세요.",
  },
  equipment_fault: {
    node: "node-a",
    score: 78,
    confidence: 0.92,
    evidence: [
      "노드 A에서 TVOC가 국소적으로 상승",
      "모션 신호 없이 온도가 동반 상승",
    ],
    action: "노드 A 주변 장비와 공정을 확인하세요.",
  },
  sensor_fault: {
    node: "node-b",
    score: 60,
    confidence: 0.88,
    evidence: [
      "노드 B의 PM 센서 측정값 결측",
      "같은 노드의 다른 센서값은 안정적",
    ],
    action: "노드 B의 PM 센서 배선과 흡입구를 확인하세요.",
  },
};
export const incidents: Incident[] = (Object.keys(causes) as Cause[]).map(
  (cause, i) => ({
    id: `DEMO-${String(i + 1).padStart(3, "0")}`,
    cause,
    ts: baseTs + 30,
    ...details[cause],
  }),
);
export function reading(
  cause: Cause,
  elapsed: number,
  node: "node-a" | "node-b",
): Reading {
  const a = node === "node-a";
  const wave = Math.sin(elapsed / 9 + (a ? 0 : 0.4));
  const rise = Math.min(1, Math.max(0, (elapsed - 30) / 25));
  const r: Reading = {
    node,
    boot: baseTs - 3600,
    seq: 1500 + elapsed,
    ts: baseTs + elapsed,
    recv_ts: baseTs + elapsed + 0.04,
    temp: 23.4 + wave * 0.15,
    humid: 46 + wave * 0.5,
    pm1: 5,
    pm25: 9 + Math.round(wave),
    pm10: 13,
    tvoc: 28 + Math.round(wave * 3),
    eco2: 480 + Math.round(wave * 6),
    co2: a ? 620 + Math.round(wave * 8) : null,
    dp: a ? 2.1 + wave * 0.08 : null,
    motion: 0,
  };
  if (cause === "external_inflow") {
    r.pm25! += Math.round(
      Math.min(1, Math.max(0, (elapsed - (a ? 40 : 30)) / 15)) * 55,
    );
    if (a) r.dp = 2.1 * (1 - rise);
  }
  if (cause === "worker_activity" && a) {
    r.pm25! += Math.round(rise * 36);
    r.co2! += Math.round(rise * 340);
    r.motion = elapsed >= 30 ? 1 : 0;
  }
  if (cause === "hvac_fault") {
    r.temp! += rise * 2.5;
    r.humid! += rise * 8;
    r.eco2! += Math.round(rise * 300);
    if (a) {
      r.co2! += Math.round(rise * 650);
      r.dp = 2.1 * (1 - rise);
    }
  }
  if (cause === "equipment_fault" && a) {
    r.tvoc! += Math.round(rise * 520);
    r.temp! += rise * 3;
  }
  if (cause === "sensor_fault" && !a && elapsed >= 30) {
    r.pm1 = null;
    r.pm25 = null;
    r.pm10 = null;
  }
  if (r.pm25 !== null) {
    r.pm1 = Math.round(r.pm25 * 0.6);
    r.pm10 = Math.round(r.pm25 * 1.2);
  }
  return r;
}
export const mockSource: SensorSource = {
  async read(cause, elapsed) {
    return [
      reading(cause, elapsed, "node-a"),
      reading(cause, elapsed, "node-b"),
    ];
  },
};
