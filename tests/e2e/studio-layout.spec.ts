import { expect, test } from "@playwright/test";

type ViewportMetrics = {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  shellLayout: string | null;
  appBarBottom: number;
  stageContentTop: number;
};

async function readViewportMetrics(page: import("@playwright/test").Page) {
  return page.evaluate<ViewportMetrics>(() => {
    const appBar = document.querySelector(".mesh-app-bar")?.getBoundingClientRect();
    const topbar = document.querySelector(".particles-topbar")?.getBoundingClientRect();
    const root = document.querySelector("[data-mesh-app-shell]");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      shellLayout: root?.getAttribute("data-mesh-shell-layout") ?? null,
      appBarBottom: appBar?.bottom ?? 0,
      stageContentTop: topbar?.top ?? 0,
    };
  });
}

test("studio launch preserves the mobile canvas around shared shell controls", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    localStorage.setItem("mesh-particles:room", "mobile-layout-contract");
    localStorage.setItem("mesh-particles:signalingUrl", "ws://localhost:1/never");
    localStorage.removeItem("mesh-particles:iceServers");
  });

  try {
    const page = await context.newPage();
    await page.goto(baseURL ?? "", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Particles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arm this phone" })).toBeVisible();

    const launch = await readViewportMetrics(page);
    expect(launch.shellLayout).toBe("overlay");
    expect(launch.scrollWidth).toBe(launch.clientWidth);
    expect(launch.scrollHeight).toBe(launch.clientHeight);
    expect(launch.appBarBottom).toBeLessThanOrEqual(launch.stageContentTop + 1);

    await page.getByRole("button", { name: "Arm this phone" }).click();
    await expect(page.getByRole("button", { name: "Trigger moment" })).toBeVisible();

    const armed = await readViewportMetrics(page);
    expect(armed.scrollWidth).toBe(armed.clientWidth);
    expect(armed.scrollHeight).toBe(armed.clientHeight);
  } finally {
    await context.close();
  }
});
