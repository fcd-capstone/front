import { test, expect } from "@playwright/test";
const origin = "http://localhost:8000/api/v1";
const start = 1794556800;
const labels = [
  "temp",
  "humid",
  "pm1",
  "pm25",
  "pm10",
  "tvoc",
  "eco2",
  "co2",
  "dp",
  "motion",
];

test("API replay controls, quality states, stale SSE exclusion and safe failures", async ({
  page,
}) => {
  let generation = 1,
    virtual = start,
    state = "paused",
    speed = 1,
    started = false,
    gone = false;
  const requested: string[] = [];
  const session = () => ({
    id: "session-1",
    dataset_id: "1",
    mode: "replay",
    state,
    speed,
    virtual_ts: virtual,
    start_ts: start,
    end_ts: start + 3600,
    generation,
    analysis_status: "disabled",
    analysis_reason: "analysis_not_implemented",
  });
  const snapshot = () => ({
    session_id: "session-1",
    generation,
    mode: "replay",
    as_of_ts: virtual,
    nodes: Object.fromEntries(
      ["node-a", "node-b"].map((node) => [
        node,
        {
          node,
          last_sample_ts: started ? virtual : null,
          connection: "unknown",
          replay_data_state: started ? "normal" : "not_started",
          metrics: Object.fromEntries(
            labels.map((sensor) => {
              const quality =
                node === "node-b" && sensor === "humid"
                  ? "disabled"
                  : node === "node-b" && ["co2", "dp"].includes(sensor)
                    ? "not_installed"
                    : !started
                      ? "missing"
                      : sensor === "co2"
                        ? "saturated"
                        : sensor === "temp"
                          ? "stale"
                          : sensor === "tvoc"
                            ? "warmup"
                            : "ok";
              return [
                sensor,
                {
                  value: ["missing", "disabled", "not_installed"].includes(
                    quality,
                  )
                    ? null
                    : sensor === "co2"
                      ? 5000
                      : 24.5,
                  unit: sensor === "co2" ? "ppm" : "",
                  quality,
                  last_valid_ts: quality === "ok" ? virtual : null,
                },
              ];
            }),
          ),
        },
      ]),
    ),
    analysis: { status: "disabled", decision_status: "disabled" },
    active_event_count: 0,
  });
  await page.addInitScript(() => {
    class TestEventSource extends EventTarget {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public url: string) {
        super();
        (window as unknown as { streams: TestEventSource[] }).streams.push(
          this,
        );
        setTimeout(() => this.onopen?.(), 10);
      }
      close() {}
    }
    (window as unknown as { streams: TestEventSource[] }).streams = [];
    window.EventSource = TestEventSource as unknown as typeof EventSource;
  });
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", "");
    requested.push(request.url());
    const send = async (data: unknown, status = 200) =>
      route.fulfill({ status, json: { data } });
    if (path === "/health")
      return send({
        status: "ok",
        version: "0.2.0",
        capabilities: {
          live: false,
          replay: true,
          analysis: false,
          labels: false,
        },
      });
    if (path === "/datasets")
      return send([
        {
          id: "1",
          name: "sample.csv",
          kind: "sample",
          start_ts: start,
          end_ts: start + 3600,
        },
      ]);
    if (path === "/sessions" && request.method() === "POST") {
      generation = 1;
      gone = false;
      started = false;
      virtual = start;
      state = "paused";
      return send(session(), 201);
    }
    if (gone)
      return route.fulfill({
        status: 404,
        json: { detail: "Session not found (server restart clears sessions)" },
      });
    if (path.endsWith("/replay")) {
      const command = request.postDataJSON();
      if (command.action === "seek") {
        generation++;
        virtual = command.ts;
        state = "paused";
        started = false;
      }
      if (command.action === "play") {
        state = "running";
        started = true;
        virtual += 1;
      }
      if (command.action === "pause") state = "paused";
      if (command.action === "stop") state = "stopped";
      if (command.action === "set_speed") speed = command.speed;
      return send(session());
    }
    if (path.endsWith("/snapshot")) return send(snapshot());
    if (path.endsWith("/series"))
      return send({
        points: [
          {
            ts: virtual,
            value: started ? 24.5 : null,
            quality: started ? "ok" : "missing",
            count: started ? 1 : 0,
          },
        ],
      });
    return send(session());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "작업환경 관제", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "새 세션 생성", exact: true }).click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(page.getByText("측정 상한", { exact: true })).toHaveCount(1);
  await expect(page.getByText("예열 중", { exact: true })).toHaveCount(2);
  await expect(page.getByText("갱신 지연", { exact: true })).toHaveCount(2);
  await expect(page.getByText("미설치", { exact: true })).toHaveCount(2);
  await expect(page.getByText("사용 안 함", { exact: true })).toHaveCount(1);
  await page.getByLabel("재생 배속").selectOption("4");
  await expect(page.getByLabel("재생 배속")).toHaveValue("4");
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .fill("1801");
  await page
    .getByRole("button", { name: "해당 시점으로 이동", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "재생 시점", exact: true }),
  ).toHaveValue("1801");
  await expect(
    page.getByText("표시할 유효 데이터가 없습니다", { exact: true }),
  ).toBeVisible();
  const old = snapshot();
  old.generation = 1;
  old.as_of_ts = start + 3000;
  await page.evaluate((payload) => {
    const win = window as unknown as { streams: EventTarget[] };
    for (const stream of win.streams)
      stream.dispatchEvent(
        new MessageEvent("snapshot.updated", {
          data: JSON.stringify({ data: payload }),
        }),
      );
  }, old);
  await expect(
    page.getByRole("slider", { name: "재생 시점", exact: true }),
  ).toHaveValue("1801");
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.getByLabel("그래프 센서").selectOption("co2");
  await expect
    .poll(
      () =>
        requested.filter(
          (u) => u.includes("/series?") && u.includes("sensor=co2"),
        ).length,
    )
    .toBeGreaterThan(0);
  expect(
    requested.some(
      (u) =>
        u.includes("/series?") &&
        u.includes("node=node-b") &&
        u.includes("sensor=co2"),
    ),
  ).toBe(false);
  expect(
    requested.some((u) => u.includes("/series?") && u.includes("sensor=humid")),
  ).toBe(false);
  await page.getByRole("button", { name: "이벤트 이력", exact: true }).click();
  await expect(
    page.getByText("현재 원인 판별 결과가 제공되지 않습니다", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("조치 메모")).toHaveCount(0);
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await page.evaluate(() => {
    const win = window as unknown as { streams: { onerror: () => void }[] };
    win.streams.at(-1)?.onerror();
  });
  await expect(page.getByText(/SSE 복구 중/)).toBeVisible();
  gone = true;
  await expect(page.getByRole("alert")).toContainText(
    "재생 세션이 만료되었습니다",
  );
  await expect(
    page.getByRole("button", { name: "일시정지", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "새 세션 생성", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("backend outage has an actionable error and does not silently show mock data", async ({
  page,
}) => {
  await page.route(`${origin}/**`, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "백엔드에 연결할 수 없습니다",
  );
  await expect(
    page.getByRole("button", { name: "새 세션 생성", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("DEMO-002", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "가상 시나리오 데모 열기 →" }),
  ).toBeVisible();
});
