import { test, expect } from "@playwright/test";
const base = "http://localhost:8000/api/v1";
test("real backend CSV replay, server controls, warmup and measured cards", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.FCD_BACKEND_E2E !== "1",
    "Start the backend on port 8000 and set FCD_BACKEND_E2E=1",
  );
  test.setTimeout(45000);
  const failures: string[] = [];
  const pageErrors: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  await page.getByLabel("데이터셋 선택").selectOption("1");
  const created = page.waitForResponse(
    (response) =>
      response.url() === `${base}/sessions` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "새 세션 생성", exact: true }).click();
  const { data: session } = await (await created).json();
  await expect(
    page.getByText("표시할 유효 데이터가 없습니다", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("재생 배속").selectOption("10");
  await expect(page.getByLabel("재생 배속")).toHaveValue("10");
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(
    page.getByText("정상 수신", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/SSE 연결 ·/)).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const frozen = (
    await (await request.get(`${base}/sessions/${session.id}`)).json()
  ).data.virtual_ts;
  const actual = (
    await (await request.get(`${base}/sessions/${session.id}/snapshot`)).json()
  ).data;
  await expect(page.getByTestId("node-a-temp").locator("strong")).toContainText(
    actual.nodes["node-a"].metrics.temp.value.toLocaleString("ko-KR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
  await expect(page.getByTestId("node-b-humid")).toContainText("사용 안 함");
  await expect(page.getByTestId("node-b-co2")).toContainText("미설치");
  await expect(page.getByTestId("node-b-dp")).toContainText("미설치");
  await page.waitForTimeout(1100);
  expect(
    (await (await request.get(`${base}/sessions/${session.id}`)).json()).data
      .virtual_ts,
  ).toBe(frozen);
  await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .fill("100");
  await page
    .getByRole("button", { name: "해당 시점으로 이동", exact: true })
    .click();
  await expect(
    page.getByText("표시할 유효 데이터가 없습니다", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(
    page.getByText("정상 수신", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByText("노드 A · 기준", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/backend-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/backend-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .fill("325");
  await page
    .getByRole("button", { name: "해당 시점으로 이동", exact: true })
    .click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(page.getByText("재생 완료", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다시 재생", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "일시정지", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "재생 중지", exact: true }).click();
  await expect(page.getByText("중지됨", { exact: true })).toBeVisible();
  await page.getByLabel("데이터셋 선택").selectOption("2");
  await page.getByRole("button", { name: "새 세션 생성", exact: true }).click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(
    page.getByText("예열 중", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .fill("1801");
  await page
    .getByRole("button", { name: "해당 시점으로 이동", exact: true })
    .click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(
    page.getByText("정상 수신", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByLabel("그래프 센서").selectOption("co2");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(failures).toEqual([]);
  expect(pageErrors).toEqual([]);
});
