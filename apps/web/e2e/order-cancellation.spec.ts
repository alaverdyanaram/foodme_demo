// KAN-5: customers cancel their own order before the kitchen accepts it.
// Setup goes through the API (register, order, admin accept) so each test
// owns its data and only the behaviour under test runs in the browser.
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const AUTH_KEY = "foodme.customer.auth";

type CustomerAuth = { token: string; customer: { id: number; email: string } };

async function registerCustomer(request: APIRequestContext): Promise<CustomerAuth> {
  const email = `kan5-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await request.post(`${API}/api/auth/register`, {
    data: { fullName: "Cancel Tester", email, phoneNumber: "+37490000005", password: "secret123" },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function placeOrder(request: APIRequestContext, auth: CustomerAuth): Promise<string> {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    data: {
      chefId: chef.id,
      receiverName: "Cancel Tester",
      receiverPhoneNumber: "+37490000005",
      receiverEmail: auth.customer.email,
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: detail.dishes[0].id, quantity: 1 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("NEW");
  return body.number;
}

async function adminAccept(request: APIRequestContext, number: string) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${number}`)).json();
  const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: "ACCEPTED" },
  });
  expect(res.ok()).toBeTruthy();
}

/** Signs the customer in by seeding the storefront's stored auth before the app loads. */
async function signIn(page: Page, auth: CustomerAuth) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_KEY, JSON.stringify(auth)] as const,
  );
}

test.describe("KAN-5 order cancellation (storefront)", () => {
  test("customer cancels a received order from tracking; it shows as Cancelled everywhere", async ({
    page,
    request,
  }) => {
    const auth = await registerCustomer(request);
    const number = await placeOrder(request, auth);
    await signIn(page, auth);

    await page.goto(`/tracking/${number}`);
    await expect(page.getByText("Order received")).toBeVisible();

    await page.getByRole("button", { name: "Cancel order" }).click();
    const confirm = page.getByRole("group", { name: "Confirm cancellation" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Yes, cancel order" }).click();

    await expect(page.getByText("Order cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    // Survives a reload: the status comes from the backend, not local state.
    await page.reload();
    await expect(page.getByText("Order cancelled")).toBeVisible();

    await page.goto("/orders");
    const row = page.getByRole("link", { name: new RegExp(number) });
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
  });

  test("Keep order dismisses the confirmation and leaves the order received", async ({ page, request }) => {
    const auth = await registerCustomer(request);
    const number = await placeOrder(request, auth);
    await signIn(page, auth);

    await page.goto(`/tracking/${number}`);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("button", { name: "Keep order" }).click();

    await expect(page.getByRole("group", { name: "Confirm cancellation" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();
    const order = await (await request.get(`${API}/api/order/number/${number}`)).json();
    expect(order.status).toBe("NEW");
  });

  test("no cancel option once the kitchen has accepted the order", async ({ page, request }) => {
    const auth = await registerCustomer(request);
    const number = await placeOrder(request, auth);
    await adminAccept(request, number);
    await signIn(page, auth);

    await page.goto(`/tracking/${number}`);
    await expect(page.getByText("Preparing your order")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  test("kitchen accepts while the customer is deciding: cancellation is refused", async ({ page, request }) => {
    const auth = await registerCustomer(request);
    const number = await placeOrder(request, auth);
    await signIn(page, auth);

    await page.goto(`/tracking/${number}`);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await adminAccept(request, number);
    await page.getByRole("button", { name: "Yes, cancel order" }).click();

    await expect(page.getByRole("alert")).toContainText("can be cancelled");
    await expect(page.getByText("Preparing your order")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  test("guests and other customers don't get a cancel option", async ({ page, request }) => {
    const owner = await registerCustomer(request);
    const number = await placeOrder(request, owner);

    await page.goto(`/tracking/${number}`);
    await expect(page.getByText("Order received")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    const stranger = await registerCustomer(request);
    await signIn(page, stranger);
    await page.goto(`/tracking/${number}`);
    await expect(page.getByText("Order received")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });
});
