export type Cause =
  | "worker_activity"
  | "external_inflow"
  | "hvac_fault"
  | "equipment_fault"
  | "sensor_fault";
export type NodeId = "node-a" | "node-b";
export type Metric =
  "temp" | "humid" | "pm1" | "pm25" | "pm10" | "tvoc" | "eco2" | "co2" | "dp";
export type Reading = {
  node: NodeId;
  boot: number;
  seq: number;
  ts: number;
  recv_ts: number;
  motion: 0 | 1;
} & Record<Metric, number | null>;
export type Incident = {
  id: string;
  cause: Cause;
  node: NodeId;
  ts: number;
  confidence: number;
  score: number;
  evidence: string[];
  action: string;
};
export type Report = {
  status: "미확인" | "확인 중" | "조치 완료";
  note: string;
};
export interface SensorSource {
  read(cause: Cause, elapsed: number): Promise<Reading[]>;
}
