import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Check,
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
  Waves,
} from "lucide-react";
import {
  baseTs,
  causes,
  duration,
  incidents,
  metrics,
  mockSource,
  reading,
} from "./data/mock";
import type { Cause, Metric, Report } from "./domain/types";
import styles from "./App.module.css";

const SensorChart = lazy(() => import("./SensorChart"));
const reportKey = "fcd-demo-reports-v1";
function readReports(): Record<string, Report> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(reportKey) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([, v]) =>
          v &&
          ["미확인", "확인 중", "조치 완료"].includes(v.status) &&
          typeof v.note === "string",
      ),
    );
  } catch {
    return {};
  }
}
const formatTime = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
const elapsedText = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
function App() {
  const [page, setPage] = useState("대시보드");
  const [cause, setCause] = useState<Cause>("external_inflow");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [metric, setMetric] = useState<Metric>("pm25");
  const [reports, setReports] = useState(readReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("전체");
  const [storageError, setStorageError] = useState(false);
  const isPlaying = playing && position < duration;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(
      () => setPosition((p) => Math.min(duration, p + 1)),
      1000 / speed,
    );
    return () => window.clearInterval(timer);
  }, [isPlaying, speed]);
  const { data, isError, isPending } = useQuery({
    queryKey: ["readings", cause, position],
    queryFn: () => mockSource.read(cause, position),
    gcTime: 60_000,
  });
  const active =
    position >= 30 ? incidents.find((i) => i.cause === cause)! : null;
  const selected = incidents.find((i) => i.id === selectedId) || active;
  const currentReport = selected
    ? reports[selected.id] || { status: "미확인", note: "" }
    : null;
  const chart = useMemo(
    () =>
      Array.from({ length: position + 1 }, (_, t) => ({
        t,
        a: reading(cause, t, "node-a")[metric],
        b: reading(cause, t, "node-b")[metric],
      })),
    [cause, position, metric],
  );
  function chooseScenario(value: Cause) {
    setCause(value);
    setPosition(0);
    setPlaying(false);
    setSelectedId(null);
  }
  function updateReport(next: Partial<Report>) {
    if (!selected) return;
    const updated = {
      ...reports,
      [selected.id]: {
        ...(reports[selected.id] || { status: "미확인", note: "" }),
        ...next,
      },
    };
    setReports(updated);
    try {
      localStorage.setItem(reportKey, JSON.stringify(updated));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  const visibleEvents = incidents.filter(
    (i) => filter === "전체" || (reports[i.id]?.status || "미확인") === filter,
  );
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <a
          className={styles.brand}
          href="#"
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
          <span className={styles.greenDot} />
          <div>
            챔버 실험 환경<small>CAPSTONE PROJECT · 2026</small>
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
              onClick={() => {
                setPage(label);
                setSelectedId(null);
              }}
            >
              <Icon size={18} />
              {label}
              {page === label && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <a href="/" className={styles.demoReturn}>
          실제 CSV 재생으로 전환 →
        </a>
        <div className={styles.sidebarBottom}>
          <ShieldCheck size={19} />
          <div>
            FCD 관제 시스템<small>프론트엔드 프로토타입 v0.1</small>
          </div>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            워크스페이스 <ChevronRight size={13} /> <strong>{page}</strong>
          </div>
          <div className={styles.topRight}>
            <span className={styles.demoBadge}>
              <FlaskConical size={13} /> 가상 시나리오
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
                {page === "대시보드"
                  ? "두 노드의 변화를 비교하고, 이상 원인과 대응 순서를 확인하세요."
                  : page === "이벤트 이력"
                    ? "가상 이벤트의 판단 근거와 조치 내역을 확인하세요."
                    : "원인별 가상 데이터를 재생하고 관제 화면의 반응을 확인하세요."}
              </p>
            </div>
            <div className={styles.timeBox}>
              <Clock3 size={15} />
              <div>
                {formatTime(baseTs + position)}
                <small>2026.11.17 · KST · 재생 시각</small>
              </div>
            </div>
          </div>
          <div className={styles.notice}>
            <CircleHelp size={16} />
            <span>
              가상 데이터로 동작하는 시연 화면입니다. 판별
              결과·신뢰도·우선순위는 예시이며 실제 실험 결과가 아닙니다.
            </span>
          </div>
          <section className={styles.replayBar} aria-label="재생 제어">
            <div className={styles.replayLabel}>
              <Radio size={17} />
              <strong>시나리오 재생</strong>
            </div>
            <label className={styles.srOnly} htmlFor="scenario">
              시나리오 선택
            </label>
            <select
              id="scenario"
              value={cause}
              onChange={(e) => chooseScenario(e.target.value as Cause)}
            >
              {Object.entries(causes).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className={styles.playButton}
              onClick={() => {
                if (position >= duration) setPosition(0);
                setPlaying(!isPlaying);
              }}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}{" "}
              {isPlaying ? "일시정지" : "재생"}
            </button>
            <button
              className={styles.iconButton}
              aria-label="처음으로"
              onClick={() => {
                setPosition(0);
                setPlaying(false);
                setSelectedId(null);
              }}
            >
              <RotateCcw size={16} />
            </button>
            <select
              aria-label="재생 배속"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
            <input
              aria-label="재생 시점"
              type="range"
              min={0}
              max={duration}
              value={position}
              onChange={(e) => {
                setPosition(Number(e.target.value));
                setSelectedId(null);
              }}
            />
            <span className={styles.progressTime}>
              {elapsedText(position)} <span>/ 02:00</span>
            </span>
          </section>
          {page === "대시보드" && (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>
                    데이터 수신 노드 <Radio size={16} />
                  </span>
                  <strong>
                    2 <small>/ 2</small>
                  </strong>
                  <p>
                    <i className={styles.greenDot} /> 가상 노드 재생 준비
                  </p>
                </div>
                <div className={styles.summaryCard}>
                  <span>
                    현재 이상 이벤트 <Bell size={16} />
                  </span>
                  <strong className={active ? styles.amberText : ""}>
                    {active ? 1 : 0}
                    <small>건</small>
                  </strong>
                  <p>{active ? causes[cause] : "관찰 구간 · 이벤트 없음"}</p>
                </div>
                <div className={styles.summaryCard}>
                  <span>
                    대응 우선순위 <Activity size={16} />
                  </span>
                  <strong>
                    {active ? active.score : "—"}
                    <small>{active ? "/ 100" : "대기"}</small>
                  </strong>
                  <p>가상 점수 · 백엔드 계산값 연동 예정</p>
                </div>
                <div className={styles.summaryCard}>
                  <span>
                    재생 상태 <Clock3 size={16} />
                  </span>
                  <strong className={styles.statusValue}>
                    {position === duration
                      ? "재생 완료"
                      : isPlaying
                        ? "재생 중"
                        : "일시정지"}
                  </strong>
                  <p>1초 측정 주기 · {speed}배속</p>
                </div>
              </div>
              <div className={styles.dashboardGrid}>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <h2>
                        센서 변화 추이 <span>NODE COMPARISON</span>
                      </h2>
                      <p>동일 시간축에서 노드 A·B의 반응을 비교합니다.</p>
                    </div>
                    <select
                      aria-label="그래프 센서"
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as Metric)}
                    >
                      {Object.entries(metrics).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.chartUnit}>{metrics[metric].unit}</div>
                  <div className={styles.chart}>
                    <Suspense fallback={<div>그래프를 불러오는 중입니다.</div>}>
                      <SensorChart chart={chart} position={position} />
                    </Suspense>
                  </div>
                  <div className={styles.chartFooter}>
                    <span>
                      <i className={styles.amberDot} /> 00:30 이후 원인 시나리오
                      시작
                    </span>
                    <span>결측 구간은 선으로 연결하지 않습니다.</span>
                  </div>
                </section>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <h2>대응 우선순위</h2>
                    <span className={styles.count}>{active ? 1 : 0}</span>
                  </div>
                  {active ? (
                    <button
                      className={styles.alertCard}
                      onClick={() => setSelectedId(active.id)}
                    >
                      <div className={styles.alertTop}>
                        <span className={styles.severity}>
                          {active.score >= 80 ? "높음" : "주의"}
                        </span>
                        <span>{active.id}</span>
                      </div>
                      <h3>
                        {causes[active.cause]}
                        <ArrowUpRight size={18} />
                      </h3>
                      <p>
                        {active.node.toUpperCase()} · {formatTime(active.ts)}
                      </p>
                      <div className={styles.scoreRow}>
                        <span>대응 점수</span>
                        <strong>
                          {active.score}
                          <small> / 100</small>
                        </strong>
                      </div>
                      <div className={styles.scoreTrack}>
                        <i style={{ width: `${active.score}%` }} />
                      </div>
                      <div className={styles.alertBottom}>
                        판단 근거 확인 <ChevronRight size={14} />
                      </div>
                    </button>
                  ) : (
                    <div className={styles.empty}>
                      <ShieldCheck size={32} />
                      <strong>현재 이벤트가 없습니다</strong>
                      <p>
                        재생을 시작하면 30초 이후
                        <br />
                        선택한 이상 상황이 나타납니다.
                      </p>
                    </div>
                  )}
                  <div className={styles.priorityNote}>
                    우선순위는 가상 예시 점수입니다.
                    <br />
                    실제 가중치와 위험등급은 백엔드와 확정합니다.
                  </div>
                </section>
              </div>
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <h2>
                    노드별 센서 현황 <span>LIVE READINGS</span>
                  </h2>
                  <span className={styles.muted}>
                    측정 시각 {formatTime(baseTs + position)}
                  </span>
                </div>
                {isError ? (
                  <p role="alert">데이터를 불러오지 못했습니다.</p>
                ) : isPending ? (
                  <p>측정값을 불러오는 중입니다.</p>
                ) : (
                  <div className={styles.nodeGrid}>
                    {data?.map((r) => (
                      <div className={styles.node} key={r.node}>
                        <div className={styles.nodeHeading}>
                          <div>
                            <i
                              className={
                                r.node === "node-a"
                                  ? styles.greenDot
                                  : styles.blueDot
                              }
                            />
                            <strong>
                              {r.node === "node-a" ? "노드 A" : "노드 B"}
                            </strong>
                            <span>
                              {r.node === "node-a" ? "기준 노드" : "도어 쪽"}
                            </span>
                          </div>
                          <span className={styles.nodeStatus}>가상 수신</span>
                        </div>
                        <div className={styles.readings}>
                          {(Object.keys(metrics) as Metric[]).map((k) => (
                            <div key={k}>
                              <span>{metrics[k].label}</span>
                              <strong>
                                {r[k] === null
                                  ? "—"
                                  : r[k].toFixed(metrics[k].digits)}{" "}
                                <small>
                                  {r[k] === null
                                    ? r.node === "node-b" &&
                                      (k === "co2" || k === "dp")
                                      ? "미설치"
                                      : "결측"
                                    : metrics[k].unit}
                                </small>
                              </strong>
                            </div>
                          ))}
                          <div>
                            <span>모션</span>
                            <strong className={styles.motion}>
                              {r.motion ? "감지" : "미감지"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {page === "이벤트 이력" && (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>
                    이벤트 목록 <span>DEMO EVENTS</span>
                  </h2>
                  <p>
                    모든 시나리오의 예시 이벤트입니다. 현재 재생의 발생 목록과는
                    구분됩니다.
                  </p>
                </div>
                <select
                  aria-label="처리 상태 필터"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["전체", "미확인", "확인 중", "조치 완료"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>이벤트</th>
                      <th>추정 원인</th>
                      <th>노드</th>
                      <th>발생 시각</th>
                      <th>대응 점수</th>
                      <th>처리 상태</th>
                      <th>상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEvents.map((i) => (
                      <tr key={i.id}>
                        <td>{i.id}</td>
                        <td>{causes[i.cause]}</td>
                        <td>{i.node}</td>
                        <td>{formatTime(i.ts)}</td>
                        <td className={styles.amberText}>{i.score}</td>
                        <td>
                          <span className={styles.stateBadge}>
                            {reports[i.id]?.status || "미확인"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={styles.textButton}
                            onClick={() => setSelectedId(i.id)}
                          >
                            상세 보기 <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleEvents.length && (
                  <div className={styles.empty}>
                    조건에 맞는 이벤트가 없습니다.
                  </div>
                )}
              </div>
            </section>
          )}
          {page === "실험·재생" && (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>원인별 실험 시나리오</h2>
                  <p>
                    시나리오를 선택한 후 상단 재생 버튼으로 시작하세요. 전체
                    길이는 2분입니다.
                  </p>
                </div>
              </div>
              <div className={styles.scenarios}>
                {incidents.map((i) => (
                  <button
                    className={`${styles.scenario} ${cause === i.cause ? styles.scenarioSelected : ""}`}
                    key={i.cause}
                    onClick={() => chooseScenario(i.cause)}
                  >
                    <div>
                      <FlaskConical size={20} />
                      {cause === i.cause && <Check size={16} />}
                    </div>
                    <h3>{causes[i.cause]}</h3>
                    <p>{i.evidence.join(" · ")}</p>
                    <span>00:00 관찰 → 00:30 이상 시작 → 02:00 종료</span>
                  </button>
                ))}
              </div>
              <div className={styles.experimentNote}>
                <CircleHelp size={18} />
                <div>
                  <strong>실험 라벨·CSV 연동 예정</strong>
                  <p>
                    현재는 원인별 가상 신호를 재생합니다. 실제
                    회차(run)·시작/종료 라벨과 모델 평가 결과는 실험 CSV 및
                    백엔드 API가 준비된 뒤 연동합니다.
                  </p>
                </div>
              </div>
            </section>
          )}
          {selected && (
            <section className={styles.panel} aria-label="이벤트 상세">
              <div className={styles.panelHeading}>
                <div>
                  <h2>
                    판단 근거 및 조치 보고 <span>{selected.id}</span>
                  </h2>
                  <p>
                    {causes[selected.cause]} · {selected.node} · 예시 신뢰도{" "}
                    {Math.round(selected.confidence * 100)}%
                  </p>
                </div>
                <span className={styles.demoBadge}>이 브라우저에만 저장</span>
              </div>
              <div className={styles.detailGrid}>
                <div>
                  <h3 className={styles.detailTitle}>판단 근거</h3>
                  {selected.evidence.map((v) => (
                    <div className={styles.evidence} key={v}>
                      <Check size={15} />
                      {v}
                    </div>
                  ))}
                  <div className={styles.action}>
                    <strong>권장 확인 사항</strong>
                    <p>{selected.action}</p>
                  </div>
                </div>
                <div className={styles.report}>
                  <label htmlFor="report-status">처리 상태</label>
                  <select
                    id="report-status"
                    value={currentReport!.status}
                    onChange={(e) =>
                      updateReport({
                        status: e.target.value as Report["status"],
                      })
                    }
                  >
                    {["미확인", "확인 중", "조치 완료"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <label htmlFor="report-note">조치 메모</label>
                  <textarea
                    id="report-note"
                    placeholder="확인 내용과 조치 사항을 기록하세요."
                    value={currentReport!.note}
                    onChange={(e) => updateReport({ note: e.target.value })}
                  />
                  <span className={styles.muted}>
                    {storageError
                      ? "브라우저 저장에 실패했습니다. 현재 화면에서만 유지됩니다."
                      : "입력 내용은 이 브라우저에 자동 저장됩니다. 서버에는 전송되지 않습니다."}
                  </span>
                </div>
              </div>
            </section>
          )}
          <footer className={styles.footer}>
            <span>FCD · 다중 센서 기반 작업환경 관제</span>
            <span>MOCK DATA / LOCAL DEMO</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
export default App;
