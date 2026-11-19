// KAN-5: the back office shows customer-cancelled orders as CANCELLED and
// offers no way to move them to another status.
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

async function loginAsAdmin(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: "Orders" })).toBeVisible({ timeout: 15000 });
}

/** Registers a customer, places an order and cancels it, all through the API. */
async function createCancelledOrder(request: APIRequestContext): Promise<{ id: number; number: string }> {
  const email = `kan5-admin-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const reg = await request.post(`${API}/api/auth/register`, {
    data: { fullName: "Cancel Admin E2E", email, phoneNumber: "+37495555777", password: "secret123" },
  });
  expect(reg.ok()).toBeTruthy();
  const { token } = await reg.json();
  const auth = { Authorization: `Bearer ${token}` };

  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const created = await request.post(`${API}/api/order`, {
    headers: auth,
    data: {
      chefId: chef.id,
      receiverName: "Cancel Admin E2E",
      receiverPhoneNumber: "+37495555777",
      receiverEmail: email,
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: detail.dishes[0].id, quantity: 1 }],
    },
  });
  expect(created.ok()).toBeTruthy();
  const { number } = await created.json();

  const cancelled = await request.post(`${API}/api/customer/orders/${number}/cancel`, { headers: auth });
  expect(cancelled.ok()).toBeTruthy();
  const order = await cancelled.json();
  expect(order.status).toBe("CANCELLED");
  return { id: order.id, number };
}

test.describe("KAN-5 cancelled orders (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("order page labels a cancelled order and offers no status changes", async ({ page, request }) => {
    const order = await createCancelledOrder(request);

    await page.goto(`/#/orders/${order.id}/show`);
    await expect(page.getByRole("heading", { name: `Order ${order.number}`, level: 5 })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByTestId("order-cancelled-note")).toBeVisible();
    await expect(page.getByText("Change status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mark as / })).toHaveCount(0);
  });

  test("orders list shows the cancelled order with a CANCELLED status", async ({ page, request }) => {
    const order = await createCancelledOrder(request);

    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    const row = page.getByRole("row").filter({ hasText: order.number });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible();
  });

  test("dashboard counts cancelled orders under their own status", async ({ page, request }) => {
    await createCancelledOrder(request);

    await page.goto("/#/");
    await expect(page.getByText("Orders by status")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("CANCELLED", { exact: true }).first()).toBeVisible();
  });
});
