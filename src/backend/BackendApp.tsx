import { lazy, Suspense, useState } from "react";
import {
  Activity,
  Bell,
  ChevronRight,
  CircleHelp,
  Clock3,
  FlaskConical,
  History,
  LayoutDashboard,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Square,
  Waves,
} from "lucide-react";
import { apiBase, type SeriesSensor, type Quality } from "../data/api";
import { metrics } from "../domain/sensors";
import type { Metric, NodeId } from "../domain/types";
import { useReplay } from "./useReplay";
import styles from "../App.module.css";
const SensorChart = lazy(() => import("../SensorChart"));
const stateNames = {
  paused: "일시정지",
  running: "재생 중",
  stopped: "중지됨",
  completed: "재생 완료",
};
const qualityNames: Record<Quality, string> = {
  ok: "정상 수신",
  missing: "미수신 / 결측",
  disabled: "사용 안 함",
  not_installed: "미설치",
  saturated: "측정 상한",
  warmup: "예열 중",
  stale: "갱신 지연",
};
const dataState = {
  not_started: "미시작",
  gap: "데이터 공백",
  normal: "재생 데이터 수신",
};
const kindNames: Record<string, string> = {
  sample: "형식 확인용",
  calibration: "보정용",
  experiment: "실험용",
};
const time = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
const date = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
function elapsedText(n: number) {
  const value = Math.max(0, Math.floor(n));
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor((value % 3600) / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export default function BackendApp() {
  const [page, setPage] = useState("대시보드");
  const [datasetId, setDatasetId] = useState("");
  const [sensor, setSensor] = useState<SeriesSensor>("pm25");
  const [seek, setSeek] = useState<number | null>(null);
  const replay = useReplay(sensor);
  const { session, snapshot, operation, sessionGone } = replay;
  const busy = operation.isPending;
  const datasets = replay.datasets.data || [];
  const selectedDataset =
    datasets.find((d) => d.id === datasetId) || datasets[0];
  const currentDataset = datasets.find((d) => d.id === session?.dataset_id);
  const validSnapshot = !sessionGone && !busy ? snapshot : undefined;
  const duration = session ? Math.max(0, session.end_ts - session.start_ts) : 0;
  const elapsed = session
    ? Math.min(
        duration,
        Math.max(
          0,
          (snapshot?.as_of_ts ?? session.virtual_ts) - session.start_ts,
        ),
      )
    : 0;
  const position = seek ?? Math.floor(elapsed);
  const selectedTs =
    session && !sessionGone
      ? seek === null
        ? (snapshot?.as_of_ts ?? session.virtual_ts)
        : session.start_ts + seek
      : null;
  const endTs = session && !sessionGone ? session.end_ts : null;
  const error =
    operation.error ||
    replay.frame.error ||
    replay.series.error ||
    replay.datasets.error ||
    replay.health.error;
  const terminal =
    session?.state === "completed" || session?.state === "stopped";
  const controlDisabled = !session || sessionGone || busy;
  const labels = { ...metrics, motion: { label: "모션", unit: "", digits: 0 } };
  const seriesSensors = (Object.keys(labels) as (Metric | "motion")[]).filter(
    (k): k is SeriesSensor => k !== "humid",
  );
  const nodeCount = validSnapshot
    ? Object.values(validSnapshot.nodes).filter(
        (n) => n.last_sample_ts !== null,
      ).length
    : 0;
  async function create() {
    if (!selectedDataset) return;
    setSeek(null);
    try {
      await replay.create(selectedDataset.id);
    } catch {
      /* mutation error is displayed */
    }
  }
  async function control(action: Parameters<typeof replay.control>[0]) {
    setSeek(null);
    try {
      await replay.control(action);
    } catch {
      /* mutation error is displayed */
    }
  }
  async function play() {
    if (!session) return;
    setSeek(null);
    try {
      if (terminal)
        await replay.control({ action: "seek", ts: session.start_ts });
      await replay.control({
        action: session.state === "running" ? "pause" : "play",
      });
    } catch {
      /* mutation error is displayed */
    }
  }
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <a
          className={styles.brand}
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setPage("대시보드");
          }}
        >
          <span className={styles.brandIcon}>
            <Waves size={23} />
          </span>
          <span>
            FCD<span className={styles.brandSub}>ENVIRONMENT INTELLIGENCE</span>
          </span>
        </a>
        <div className={styles.workspace}>
          <span className={styles.blueDot} />
          <div>
            실측 CSV 재생<small>HISTORICAL DATA · REPLAY</small>
          </div>
        </div>
        <div className={styles.navLabel}>WORKSPACE</div>
        <nav>
          {[
            { label: "대시보드", icon: LayoutDashboard },
            { label: "이벤트 이력", icon: History },
            { label: "실험·재생", icon: FlaskConical },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={page === label ? styles.navActive : ""}
              onClick={() => setPage(label)}
            >
              <Icon size={18} />
              {label}
              {page === label && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <a href="/?mode=demo" className={styles.demoReturn}>
          가상 시나리오 데모 열기 →
        </a>
        <div className={styles.sidebarBottom}>
          <ShieldCheck size={19} />
          <div>
            FCD 관제 시스템<small>CSV 연동 v0.2 · 라이브 미지원</small>
          </div>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            워크스페이스 <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className={styles.topRight}>
            <span className={styles.demoBadge}>
              <History size={13} /> 실측 CSV · 과거 데이터
            </span>
            <span className={styles.avatar}>F</span>
          </div>
        </header>
        <div className={styles.content}>
          <div className={styles.heading}>
            <div>
              <div className={styles.eyebrow}>ENVIRONMENT CONTROL CENTER</div>
              <h1>
                {page === "대시보드"
                  ? "작업환경 관제"
                  : page === "이벤트 이력"
                    ? "이벤트 이력"
                    : "실험 및 데이터 재생"}
              </h1>
              <p>
                실제 측정 파일을 서버 시계로 재생하고, 두 노드의 센서 변화를
                확인하세요.
              </p>
            </div>
            <div className={styles.timeBox}>
              <Clock3 size={15} />
              <div>
                {session && !sessionGone
                  ? time(snapshot?.as_of_ts ?? session.virtual_ts)
                  : "—"}
                <small>
                  {session && !sessionGone
                    ? `${date(session.virtual_ts)} · KST`
                    : "데이터셋을 선택하세요"}
                </small>
              </div>
            </div>
          </div>
          <div className={styles.notice}>
            <CircleHelp size={16} />
            <span>
              과거 측정 CSV 재생 화면입니다. 라이브 연결·원인 판별·우선순위·조치
              보고는 현재 백엔드에서 지원하지 않습니다. 이벤트가 없다는 것은
              정상 판정이 아닙니다.
            </span>
          </div>
          {error && (
            <div role="alert" className={styles.apiError}>
              <div>
                <strong>
                  {sessionGone
                    ? "재생 세션이 만료되었습니다. 새 세션을 생성하세요."
                    : "백엔드 연동을 확인해 주세요."}
                </strong>
                <p>{errorText(error)}</p>
                <small>{apiBase}</small>
              </div>
              <button
                onClick={() => {
                  operation.reset();
                  void replay.health.refetch();
                  void replay.datasets.refetch();
                  if (session && !sessionGone) void replay.frame.refetch();
                }}
              >
                다시 확인
              </button>
            </div>
          )}
          <section className={styles.replayBar} aria-label="재생 제어">
            <div className={styles.replayLabel}>
              <Radio size={17} />
              <strong>CSV 재생</strong>
            </div>
            <label className={styles.srOnly} htmlFor="dataset">
              데이터셋 선택
            </label>
            <select
              id="dataset"
              className={styles.datasetSelect}
              value={selectedDataset?.id || ""}
              disabled={busy || !datasets.length}
              onChange={(e) => setDatasetId(e.target.value)}
            >
              {!datasets.length && (
                <option value="">
                  {replay.datasets.isPending
                    ? "목록 불러오는 중"
                    : "데이터셋 없음"}
                </option>
              )}
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {kindNames[d.kind] || d.kind}
                </option>
              ))}
            </select>
            <button
              className={styles.textButton}
              disabled={
                !selectedDataset ||
                busy ||
                replay.health.data?.capabilities.replay === false
              }
              onClick={() => void create()}
            >
              새 세션 생성
            </button>
            <button
              className={styles.playButton}
              disabled={controlDisabled}
              onClick={() => void play()}
            >
              {session?.state === "running" ? (
                <Pause size={15} />
              ) : (
                <Play size={15} />
              )}{" "}
              {session?.state === "running"
                ? "일시정지"
                : terminal
                  ? "다시 재생"
                  : "재생"}
            </button>
            <button
              className={styles.iconButton}
              aria-label="처음으로"
              disabled={controlDisabled}
              onClick={() =>
                void control({ action: "seek", ts: session!.start_ts })
              }
            >
              <RotateCcw size={16} />
            </button>
            <button
              className={styles.iconButton}
              aria-label="재생 중지"
              disabled={controlDisabled || session?.state === "stopped"}
              onClick={() => void control({ action: "stop" })}
            >
              <Square size={14} />
            </button>
            <select
              aria-label="재생 배속"
              value={session?.speed || 1}
              disabled={controlDisabled || terminal}
              onChange={(e) =>
                void control({
                  action: "set_speed",
                  speed: Number(e.target.value),
                })
              }
            >
              {[0.5, 1, 2, 4, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
            <div className={styles.seekRow}>
              <input
                aria-label="재생 시점"
                type="range"
                min={0}
                max={Math.floor(duration)}
                value={Math.min(position, Math.floor(duration))}
                disabled={controlDisabled}
                onChange={(e) => setSeek(Number(e.target.value))}
              />
              <div
                className={styles.measurementTimes}
                aria-label="CSV 측정 시각"
                role="group"
              >
                <div
                  className={styles.measurementStamp}
                  aria-label="선택한 측정 시각"
                  role="group"
                >
                  <span>
                    {selectedTs === null ? "선택 시각" : date(selectedTs)} · KST
                  </span>
                  <strong>
                    {selectedTs === null ? "—" : time(selectedTs)}
                  </strong>
                </div>
                <span
                  className={styles.measurementSeparator}
                  aria-hidden="true"
                >
                  /
                </span>
                <div
                  className={styles.measurementStamp}
                  aria-label="CSV 마지막 측정 시각"
                  role="group"
                >
                  <span>
                    {endTs === null ? "마지막 측정" : date(endTs)} · KST
                  </span>
                  <strong>{endTs === null ? "—" : time(endTs)}</strong>
                </div>
              </div>
              <button
                className={styles.seekButton}
                disabled={controlDisabled || seek === null}
                onClick={() =>
                  void control({
                    action: "seek",
                    ts: session!.start_ts + position,
                  })
                }
              >
                해당 시점으로 이동
              </button>
            </div>
          </section>
          <div className={styles.sessionMeta}>
            <span>
              {session
                ? `현재 세션: ${currentDataset?.name || session.dataset_id}`
                : "파일 선택 후 새 세션을 생성하세요."}
            </span>
            <span>
              {busy
                ? "서버 처리 중"
                : sessionGone
                  ? "세션 만료"
                  : session
                    ? stateNames[session.state]
                    : "세션 미생성"}
              {session && !sessionGone
                ? ` · ${replay.streamState === "connected" ? "SSE 연결" : replay.streamState === "invalid" ? "SSE 응답 오류 · 폴링 사용" : replay.streamState === "recovering" ? "SSE 복구 중 · 폴링 사용" : "SSE 연결 중"} · 1초 폴링 병행`
                : ""}
            </span>
          </div>
          {page === "대시보드" && (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>
                    재생 수신 노드 <Radio size={16} />
                  </span>
                  <strong>
                    {nodeCount}
                    <small>/ 2</small>
                  </strong>
                  <p>CSV 데이터 상태 · 실제 연결 상태 아님</p>
                </div>
                <div className={styles.summaryCard}>
                  <span>
                    이상 원인 판별 <Activity size={16} />
                  </span>
                  <strong className={styles.statusValue}>미지원</strong>
                  <p>분석 엔진 연동 대기</p>
                </div>
                <div className={styles.summaryCard}>
                  <span>
                    대응 우선순위 <Bell size={16} />
                  </span>
                  <strong>
                    —<small>산출 대기</small>
                  </strong>
                  <p>점수·신뢰도를 임의 생성하지 않습니다.</p>
                </div>
                <div className={styles.summaryCard}>
                  <span>
                    재생 상태 <Clock3 size={16} />
                  </span>
                  <strong className={styles.statusValue}>
                    {sessionGone
                      ? "세션 만료"
                      : session
                        ? stateNames[session.state]
                        : "시작 전"}
                  </strong>
                  <p>
                    {session
                      ? `${session.speed}배속 · 서버 기준 시계`
                      : "새 세션 생성 후 재생하세요."}
                  </p>
                </div>
              </div>
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>
                      센서 변화 추이 <span>MEASURED DATA</span>
                    </h2>
                    <p>
                      최근 5분 · 습도는 A 현재값 카드 전용 ·
                      미설치·예열·포화·결측 구간 제외
                    </p>
                  </div>
                  <select
                    aria-label="그래프 센서"
                    value={sensor}
                    onChange={(e) => setSensor(e.target.value as SeriesSensor)}
                  >
                    {seriesSensors.map((k) => (
                      <option key={k} value={k}>
                        {labels[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.chartUnit}>{labels[sensor].unit}</div>
                <div className={styles.chart}>
                  {!session || sessionGone ? (
                    <div className={styles.empty}>
                      <Radio size={28} />
                      <strong>재생할 데이터가 없습니다</strong>
                      <p>새 세션을 생성한 후 재생을 시작하세요.</p>
                    </div>
                  ) : busy || replay.series.isPending ? (
                    <div className={styles.empty}>
                      시계열을 불러오는 중입니다.
                    </div>
                  ) : replay.series.isError ? (
                    <div className={styles.empty}>
                      시계열 조회에 실패했습니다.
                      <button onClick={() => void replay.series.refetch()}>
                        다시 조회
                      </button>
                    </div>
                  ) : !replay.series.data?.some(
                      (p) => p.a !== null || p.b !== null,
                    ) ? (
                    <div className={styles.empty}>
                      <strong>표시할 유효 데이터가 없습니다</strong>
                      <p>
                        시점 이동 직후에는 재생을 눌러 주세요.
                        <br />
                        예열·포화·결측 구간은 그래프에 표시하지 않습니다.
                      </p>
                    </div>
                  ) : (
                    <Suspense
                      fallback={
                        <div className={styles.empty}>
                          그래프를 불러오는 중입니다.
                        </div>
                      }
                    >
                      <SensorChart
                        chart={replay.series.data}
                        position={elapsed}
                        timeDomain={[
                          Math.max(
                            session.start_ts,
                            (snapshot?.as_of_ts ?? session.virtual_ts) - 300,
                          ),
                          snapshot?.as_of_ts ?? session.virtual_ts,
                        ]}
                        timestampMode
                      />
                    </Suspense>
                  )}
                </div>
                <div className={styles.chartFooter}>
                  <span>노드 B는 서버의 v2 보정값을 사용합니다.</span>
                  <span>차압 영점·부호 보정은 확정 전입니다.</span>
                </div>
              </section>
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>
                      노드별 센서 현황 <span>REPLAY SNAPSHOT</span>
                    </h2>
                    <p>
                      수치와 품질 상태를 함께 확인하세요. 사용 안 함·미설치
                      센서는 값으로 표시하지 않습니다.
                    </p>
                  </div>
                </div>
                <div className={styles.nodeGrid}>
                  {(["node-a", "node-b"] as NodeId[]).map((node) => {
                    const current = validSnapshot?.nodes[node];
                    return (
                      <div
                        className={styles.node}
                        key={node}
                        data-testid={`backend-${node}`}
                      >
                        <div className={styles.nodeHeading}>
                          <div>
                            <i
                              className={
                                node === "node-a"
                                  ? styles.greenDot
                                  : styles.blueDot
                              }
                            />
                            <strong>
                              {node === "node-a" ? "노드 A" : "노드 B"}
                            </strong>
                            <span>
                              {node === "node-a" ? "기준 노드" : "도어 쪽"}
                            </span>
                          </div>
                          <span>
                            {current
                              ? dataState[current.replay_data_state]
                              : "미시작"}
                          </span>
                        </div>
                        <div className={styles.readings}>
                          {(Object.keys(labels) as (Metric | "motion")[]).map(
                            (k) => {
                              const metric = current?.metrics[k];
                              const quality =
                                metric?.quality ||
                                (node === "node-b" && k === "humid"
                                  ? "disabled"
                                  : node === "node-b" &&
                                      ["co2", "dp"].includes(k)
                                    ? "not_installed"
                                    : "missing");
                              const value = metric?.value;
                              const show =
                                value !== null &&
                                value !== undefined &&
                                !["disabled", "not_installed"].includes(
                                  quality,
                                );
                              return (
                                <div
                                  key={k}
                                  className={styles.sensorReading}
                                  data-testid={`${node}-${k}`}
                                >
                                  <span>
                                    {labels[k].label}
                                    {k === "humid" && node === "node-a"
                                      ? " · 표시 전용"
                                      : ""}
                                  </span>
                                  <strong>
                                    {show
                                      ? k === "motion"
                                        ? value
                                          ? "감지"
                                          : "미감지"
                                        : value.toLocaleString("ko-KR", {
                                            minimumFractionDigits:
                                              labels[k].digits,
                                            maximumFractionDigits:
                                              labels[k].digits,
                                          })
                                      : "—"}{" "}
                                    <small>
                                      {show
                                        ? metric?.unit || labels[k].unit
                                        : ""}
                                    </small>
                                  </strong>
                                  <small
                                    className={
                                      ["saturated", "warmup", "stale"].includes(
                                        quality,
                                      )
                                        ? styles.qualityCaution
                                        : styles.qualityMuted
                                    }
                                  >
                                    {qualityNames[quality] || quality}
                                  </small>
                                </div>
                              );
                            },
                          )}
                        </div>
                        <div className={styles.nodeTimestamp}>
                          마지막 측정:{" "}
                          {current?.last_sample_ts
                            ? `${date(current.last_sample_ts)} ${time(current.last_sample_ts)}`
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
          {page === "이벤트 이력" && (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <h2>이상 이벤트 및 조치 보고</h2>
                <span className={styles.demoBadge}>백엔드 미지원</span>
              </div>
              <div className={styles.empty}>
                <ShieldCheck size={32} />
                <strong>현재 원인 판별 결과가 제공되지 않습니다</strong>
                <p>
                  이벤트 API의 빈 목록은 정상 상태를 의미하지 않습니다.
                  <br />
                  판별·우선순위·보고 API가 준비되면 이 화면에 연결합니다.
                </p>
                <a className={styles.demoLink} href="/?mode=demo">
                  가상 데모에서 UI 확인하기 →
                </a>
              </div>
            </section>
          )}
          {page === "실험·재생" && (
            <>
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>측정 데이터셋</h2>
                    <p>
                      선택한 파일은 새 세션 생성 후 적용됩니다. 데이터셋 선택
                      자체는 현재 재생을 변경하지 않습니다.
                    </p>
                  </div>
                </div>
                <div className={styles.datasetGrid}>
                  {datasets.map((d) => (
                    <button
                      key={d.id}
                      disabled={busy}
                      className={`${styles.scenario} ${selectedDataset?.id === d.id ? styles.scenarioSelected : ""}`}
                      onClick={() => setDatasetId(d.id)}
                    >
                      <div>
                        <FlaskConical size={20} />
                        <span>{kindNames[d.kind] || d.kind}</span>
                      </div>
                      <h3>{d.name}</h3>
                      <p>
                        {date(d.start_ts)} {time(d.start_ts)} KST
                        <br />
                        {elapsedText(d.end_ts - d.start_ts)} 분량
                      </p>
                      <span>
                        {d.kind === "sample"
                          ? "형식 확인용 · 정상 기준값/학습용 아님"
                          : d.kind === "calibration"
                            ? "첫 30분은 예열 구간으로 그래프 집계에서 제외"
                            : "실험 측정 파일"}
                      </span>
                    </button>
                  ))}
                </div>
                {!datasets.length && (
                  <div className={styles.empty}>
                    사용 가능한 데이터셋이 없습니다.
                  </div>
                )}
              </section>
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <h2>실험 라벨 및 연동 상태</h2>
                </div>
                <div className={styles.integrationInfo}>
                  <p>실험 회차·시작/종료 라벨 API는 아직 제공되지 않습니다.</p>
                  <p>
                    시점 이동은 세션을 일시정지하고 이전 그래프를 비웁니다. 이동
                    후 재생을 누르면 해당 시점부터 수신합니다.
                  </p>
                  <p>
                    세션은 서버 메모리에 보관됩니다. 백엔드를 재시작했다면 새
                    세션을 만들어 주세요.
                  </p>
                  <p>
                    API: <code>{apiBase}</code> · 버전{" "}
                    {replay.health.data?.version || "확인 중"}
                  </p>
                </div>
              </section>
            </>
          )}
          <footer className={styles.footer}>
            <span>FCD · 다중 센서 기반 작업환경 관제</span>
            <span>MEASURED CSV / REPLAY ONLY</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
