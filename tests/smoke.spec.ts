import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Build trust into support/i)).toBeVisible();
});

test("cases list loads", async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByText("Cases").first()).toBeVisible();
  await expect(page.getByText(/CS-/).first()).toBeVisible();
});

test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard / Proof").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Hit@K Evaluation" })).toBeVisible();
});
