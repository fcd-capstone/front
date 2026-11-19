import { test, expect } from "@playwright/test";
const base = "http://localhost:8000/api/v1";
const start = Date.UTC(2026, 10, 18, 8, 0) / 1000;

test("v0.4 events, version-conflict recovery, report persistence and labels", async ({
  page,
}) => {
  let generation = 1,
    version = 1,
    status = "new",
    conflict = true,
    decision = "anomaly";
  const reports: {
    id: string;
    handling_status: string;
    note: string;
    reported_at: number;
  }[] = [];
  const writes: Record<string, unknown>[] = [];
  const event = () => ({
    id: "event-1",
    session_id: "real-session",
    generation: 1,
    version,
    node_ids: ["node-a"],
    cause: "equipment_fault",
    decision_status: "anomaly",
    confidence: null,
    confidence_kind: "none",
    method: "rule",
    rule_id: "voc-delta",
    rule_version: "test-unvalidated",
    rule_sha256: "test-hash",
    validation_status: "unvalidated",
    started_ts: start,
    detected_ts: start + 60,
    ended_ts: start + 90,
    lifecycle: "ended",
    end_reason: "recovered",
    handling_status: status,
    priority: {
      score: 50,
      level: "high",
      basis: "configured_unvalidated",
      components: [],
    },
    evidence: [
      {
        sensor: "tvoc",
        node: "node-a",
        feature: "delta",
        observed_value: 125,
        unit: null,
        description: "node-a TVOC delta 조건 충족 (검증 전 설정)",
      },
    ],
    recommended_actions: ["장비 주변을 확인하세요."],
    reports,
    updated_at: start + 90,
  });
  const session = () => ({
    id: "real-session",
    dataset_id: "3",
    mode: "replay",
    state: "paused",
    speed: 1,
    virtual_ts: start + 120,
    start_ts: start,
    end_ts: start + 7200,
    generation,
    analysis_status: "ready",
    analysis_reason: "unvalidated_rules",
  });
  await page.route(`${base}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const send = (data: unknown, code = 200) =>
      route.fulfill({ status: code, json: { data } });
    if (path === "/health")
      return send({
        status: "ok",
        version: "0.4.0",
        capabilities: {
          live: false,
          replay: true,
          analysis: true,
          labels: true,
        },
      });
    if (path === "/datasets")
      return send([
        {
          id: "3",
          name: "experiment.csv",
          kind: "experiment",
          start_ts: start,
          end_ts: start + 7200,
        },
      ]);
    if (path === "/datasets/3/labels")
      return send([
        {
          run: 2,
          cause: "worker_activity",
          start_ts: start,
          end_ts: start + 60,
          source: "pilot",
          note: "작업자 활동 재현",
          end_note: "오염",
          target_node: "node-b",
          intensity: "low",
          excluded_reason: "pilot_timing_or_motion",
          mask_pm: false,
          mask_a_motion: false,
        },
        {
          run: 48,
          cause: "equipment_fault",
          start_ts: start + 100,
          end_ts: start + 160,
          source: "day1",
          note: "장비 동작",
          end_note: "",
          target_node: "node-a",
          intensity: "mid",
          excluded_reason: null,
          mask_pm: true,
          mask_a_motion: false,
        },
        {
          run: 79,
          cause: "normal",
          start_ts: start + 200,
          end_ts: start + 260,
          source: "day2",
          note: "정상 실험",
          end_note: "",
          target_node: null,
          intensity: null,
          excluded_reason: null,
          mask_pm: false,
          mask_a_motion: true,
        },
        {
          run: 80,
          cause: "hvac_fault",
          start_ts: start + 300,
          end_ts: start + 360,
          source: "day2",
          note: "취소",
          end_note: "CANCEL",
          target_node: null,
          intensity: null,
          excluded_reason: "cancelled",
          mask_pm: false,
          mask_a_motion: false,
        },
      ]);
    if (path === "/sessions" && route.request().method() === "POST")
      return send(session(), 201);
    if (path.endsWith("/snapshot"))
      return send({
        session_id: "real-session",
        generation,
        mode: "replay",
        as_of_ts: start + 120,
        nodes: {
          "node-a": {
            node: "node-a",
            last_sample_ts: null,
            connection: "unknown",
            replay_data_state: "not_started",
            metrics: {},
          },
          "node-b": {
            node: "node-b",
            last_sample_ts: null,
            connection: "unknown",
            replay_data_state: "not_started",
            metrics: {},
          },
        },
        analysis: {
          status: "ready",
          decision_status: decision,
          cause: decision === "anomaly" ? "equipment_fault" : null,
          confidence: null,
          validation_status: "unvalidated",
          method: "rule",
        },
        active_event_count: 0,
      });
    if (path.endsWith("/series")) return send({ points: [] });
    if (path.endsWith("/stream"))
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": heartbeat\n\n",
      });
    if (path.endsWith("/replay")) {
      generation++;
      decision = "no_rule_match";
      return send(session());
    }
    if (path.endsWith("/events"))
      return send(generation === 1 ? [event()] : []);
    if (path.endsWith("/events/event-1")) {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (conflict) {
          conflict = false;
          version = 2;
          status = "acknowledged";
          return route.fulfill({
            status: 409,
            json: { detail: "VERSION_CONFLICT: reload event" },
          });
        }
        expect(body.expected_version).toBe(version);
        status = body.handling_status;
        version++;
        reports.push({
          id: `report-${version}`,
          handling_status: status,
          note: body.note,
          reported_at: start + 150,
        });
      }
      return send(event());
    }
    return send(session());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "새 세션 생성", exact: true }).click();
  await expect(
    page.getByText("장비·공정 이상", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "이벤트 이력", exact: true }).click();
  await page.getByRole("button", { name: "상세 보기", exact: true }).click();
  await expect(page.getByText("신뢰도 미제공", { exact: false })).toBeVisible();
  await expect(page.getByText("이상 종료", { exact: true })).toBeVisible();
  await expect(page.getByText("관측값: 125", { exact: true })).toBeVisible();
  await page
    .getByLabel("조치 메모", { exact: true })
    .fill("현장 확인 중입니다");
  await page
    .getByRole("button", { name: "조치 보고 저장", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "다른 변경과 충돌했습니다",
  );
  await expect(page.getByLabel("조치 메모", { exact: true })).toHaveValue(
    "현장 확인 중입니다",
  );
  await expect(
    page.getByText("현재 처리 상태:", { exact: false }),
  ).toContainText("접수");
  await page
    .getByRole("button", { name: "조치 보고 저장", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "서버에 조치 보고를 저장했습니다.",
  );
  await expect(
    page.getByText("현재 처리 상태:", { exact: false }),
  ).toContainText("확인 중");
  expect(writes[0].expected_version).toBe(1);
  expect(writes[1].expected_version).toBe(2);
  await page.getByLabel("조치 메모", { exact: true }).fill("조치 완료");
  await page
    .getByRole("button", { name: "조치 보고 저장", exact: true })
    .click();
  await expect(
    page.getByText("현재 처리 상태:", { exact: false }),
  ).toContainText("조치 완료");
  await expect(
    page.getByRole("button", { name: "조치 보고 저장", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("현장 확인 중입니다", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({
    path: "artifacts/events-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "처음으로", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "판단 근거 및 조치 보고", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("표시할 이벤트가 없습니다", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await expect(page.getByText("규칙 미충족", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "실험·재생", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "실험 회차 라벨", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("파일럿 시각·모션 오염", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("실험 취소", { exact: true })).toBeVisible();
  await expect(
    page.getByText("PM 제외 (오프라인 평가)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A 모션 제외 (오프라인 평가)", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
