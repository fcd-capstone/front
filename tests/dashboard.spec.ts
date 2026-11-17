import { test, expect } from "@playwright/test";

test("replay, missing sensor distinction and local reports", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "작업환경 관제", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("미설치", { exact: true })).toHaveCount(2);
  await page.getByRole("slider", { name: "재생 시점", exact: true }).fill("55");
  await expect(
    page.getByRole("heading", { name: "외부 환경 유입", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "이벤트 상세" })).toContainText(
    "노드 B의 PM2.5가 먼저 상승",
  );
  await page.getByLabel("처리 상태", { exact: true }).selectOption("확인 중");
  await page.getByLabel("조치 메모").fill("도어 확인 중");
  await page.reload();
  await page.getByRole("button", { name: "이벤트 이력", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "DEMO-002" })
    .getByRole("button", { name: "상세 보기" })
    .click();
  await expect(page.getByLabel("처리 상태", { exact: true })).toHaveValue(
    "확인 중",
  );
  await expect(page.getByLabel("조치 메모")).toHaveValue("도어 확인 중");
  await page.getByLabel("처리 상태 필터").selectOption("조치 완료");
  await expect(page.getByText("조건에 맞는 이벤트가 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await page.getByLabel("시나리오 선택").selectOption("sensor_fault");
  await page.getByRole("slider", { name: "재생 시점", exact: true }).fill("60");
  await expect(page.getByText("결측", { exact: true })).toHaveCount(3);
  await expect(page.getByText("미설치", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "처음으로", exact: true }).click();
  await expect(
    page.getByText("현재 이벤트가 없습니다", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "일시정지", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const time = await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .inputValue();
  await page.waitForTimeout(1200);
  await expect(
    page.getByRole("slider", { name: "재생 시점", exact: true }),
  ).toHaveValue(time);
});

test("scenario selection, replay end, responsive layout and screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  await page.getByRole("button", { name: "실험·재생", exact: true }).click();
  for (const name of [
    "작업자 활동",
    "외부 환경 유입",
    "공조·환기 이상",
    "장비·공정 이상",
    "센서 이상",
  ]) {
    await page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .click();
    await expect(
      page.getByRole("slider", { name: "재생 시점", exact: true }),
    ).toHaveValue("0");
  }
  await page.getByLabel("시나리오 선택").selectOption("external_inflow");
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .fill("120");
  await expect(page.getByText("재생 완료", { exact: true })).toBeVisible();
  await page.getByRole("slider", { name: "재생 시점", exact: true }).fill("65");
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "작업환경 관제", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/dashboard-mobile.png" });
  await page
    .getByRole("heading", { name: "센서 변화 추이" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/dashboard-mobile-chart.png" });
  expect(errors).toEqual([]);
});

test("replay speed and automatic completion", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("combobox", { name: "재생 배속" }).selectOption("4");
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("slider", { name: "재생 시점", exact: true }),
  ).toHaveValue("4");
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page
    .getByRole("slider", { name: "재생 시점", exact: true })
    .fill("119");
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.clock.runFor(500);
  await expect(
    page.getByRole("slider", { name: "재생 시점", exact: true }),
  ).toHaveValue("120");
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("재생 완료", { exact: true })).toBeVisible();
});
