// Order ratings (order-ratings.spec.md): customers rate their own delivered orders.
// Setup goes through the API (register, order, admin accept + deliver) so each test
// owns its data and only the behaviour under test runs in the browser.
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const AUTH_KEY = "foodme.customer.auth";

type CustomerAuth = { token: string; customer: { id: number; email: string } };

async function registerCustomer(request: APIRequestContext): Promise<CustomerAuth> {
  const email = `rating-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await request.post(`${API}/api/auth/register`, {
    data: { fullName: "Rating Tester", email, phoneNumber: "+37490000006", password: "secret123" },
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
      receiverName: "Rating Tester",
      receiverPhoneNumber: "+37490000006",
      receiverEmail: auth.customer.email,
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: detail.dishes[0].id, quantity: 1 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).number;
}

async function adminMove(request: APIRequestContext, number: string, statuses: string[]) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${number}`)).json();
  for (const status of statuses) {
    const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status },
    });
    expect(res.ok()).toBeTruthy();
  }
}

async function deliveredOrder(request: APIRequestContext, auth: CustomerAuth): Promise<string> {
  const number = await placeOrder(request, auth);
  await adminMove(request, number, ["ACCEPTED", "DELIVERED"]);
  return number;
}

/** Signs the customer in by seeding the storefront's stored auth before the app loads. */
async function signIn(page: Page, auth: CustomerAuth) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_KEY, JSON.stringify(auth)] as const,
  );
}

test.describe("Order ratings (storefront)", () => {
  test("customer rates a delivered order from My Orders; the rating survives a reload", async ({
    page,
    request,
  }) => {
    const auth = await registerCustomer(request);
    const number = await deliveredOrder(request, auth);
    await signIn(page, auth);

    await page.goto("/orders");
    await page.getByRole("button", { name: `Rate order ${number}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: `Rate order ${number}` })).toBeVisible();
    const submit = dialog.getByRole("button", { name: "Submit rating" });
    await expect(submit).toBeDisabled();

    await dialog.getByRole("radio", { name: "4 stars" }).check({ force: true });
    await dialog.getByPlaceholder("Tell us about your order").fill("Warm and tasty");
    await submit.click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
    await expect(page.getByText("Warm and tasty")).toBeVisible();
    await expect(page.getByRole("button", { name: `Rate order ${number}` })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();

    await page.goto(`/tracking/${number}`);
    const section = page.getByRole("region", { name: "Your rating" });
    await expect(section.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
    await expect(section.getByText("Warm and tasty")).toBeVisible();
  });

  test("stars can be chosen with the keyboard", async ({ page, request }) => {
    const auth = await registerCustomer(request);
    const number = await deliveredOrder(request, auth);
    await signIn(page, auth);

    await page.goto(`/tracking/${number}`);
    await page.getByRole("button", { name: "Rate order" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("radio", { name: "1 star" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("radio", { name: "3 stars" })).toBeChecked();

    await dialog.getByRole("button", { name: "Submit rating" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Rated 3 out of 5 stars" })).toBeVisible();
  });

  test("an order that isn't delivered has no rating option", async ({ page, request }) => {
    const auth = await registerCustomer(request);
    const number = await placeOrder(request, auth);
    await adminMove(request, number, ["ACCEPTED"]);
    await signIn(page, auth);

    await page.goto("/orders");
    await expect(page.getByRole("link", { name: new RegExp(number) })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rate order/ })).toHaveCount(0);

    await page.goto(`/tracking/${number}`);
    await expect(page.getByText("Preparing your order")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rate order" })).toHaveCount(0);
  });

  test("a refused rating shows the reason and keeps the window open to retry", async ({ page, request }) => {
    const auth = await registerCustomer(request);
    const number = await deliveredOrder(request, auth);
    await signIn(page, auth);

    await page.goto("/orders");
    await page.getByRole("button", { name: `Rate order ${number}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: "5 stars" }).check({ force: true });

    // The order gets rated elsewhere (e.g. another tab) while the window is open.
    const res = await request.post(`${API}/api/customer/orders/${number}/review`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      data: { rating: 2 },
    });
    expect(res.ok()).toBeTruthy();

    await dialog.getByRole("button", { name: "Submit rating" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Order already reviewed.");
    await expect(dialog.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
