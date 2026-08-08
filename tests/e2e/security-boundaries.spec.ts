import { expect, test } from "@playwright/test";

const appOrigin = "http://127.0.0.1:3100";

const privateReads = [
  "/api/account/export",
  "/api/admin/review",
  "/api/admin/orders",
  "/api/admin/support",
  "/api/admin/users",
  "/api/auth/me",
  "/api/booth-exports",
  "/api/collaborations",
  "/api/collaborations/00000000-0000-4000-8000-000000000000/deliverables",
  "/api/entitlements",
  "/api/locker/beats",
  "/api/locker/beats/00000000-0000-4000-8000-000000000000/media",
  "/api/locker/hooks",
  "/api/locker/songs",
  "/api/membership",
  "/api/notifications",
  "/api/orders",
  "/api/orders/00000000-0000-4000-8000-000000000000",
  "/api/orders/00000000-0000-4000-8000-000000000000/license",
  "/api/producer",
  "/api/producer/referrals",
  "/api/producer/services",
  "/api/profile",
  "/api/projects",
  "/api/rough-takes",
  "/api/sessions",
  "/api/song-sections/versions",
  "/api/songs",
  "/api/support/tickets",
] as const;

const privateWrites = [
  { method: "DELETE", path: "/api/account" },
  { method: "POST", path: "/api/collaborations" },
  { method: "POST", path: "/api/collaborations/00000000-0000-4000-8000-000000000000/deliverables/upload" },
  { method: "POST", path: "/api/collaborations/00000000-0000-4000-8000-000000000000/deliverables" },
  { method: "PATCH", path: "/api/collaborations/00000000-0000-4000-8000-000000000000/deliverables/11111111-1111-4111-8111-111111111111" },
  { method: "PUT", path: "/api/admin/marketplace" },
  { method: "PATCH", path: "/api/admin/orders" },
  { method: "PATCH", path: "/api/admin/users" },
  { method: "POST", path: "/api/producer/beats" },
  { method: "POST", path: "/api/stripe/checkout" },
  { method: "POST", path: "/api/support/tickets" },
] as const;

test.describe("release security boundaries", () => {
  test("anonymous callers cannot read private workspaces", async ({ request }) => {
    for (const path of privateReads) {
      const response = await request.get(path);
      expect.soft(response.status(), `${path} should reject anonymous reads`).toBe(401);
      expect.soft(response.headers()["cache-control"] ?? "", `${path} should never cache access failures`).toContain("no-store");
    }
  });

  test("anonymous callers cannot mutate protected resources", async ({ request }) => {
    for (const route of privateWrites) {
      const response = await request.fetch(route.path, {
        method: route.method,
        headers: { Origin: appOrigin },
        data: {},
      });
      expect.soft(response.status(), `${route.method} ${route.path} should require a session`).toBe(401);
      expect.soft(response.headers()["cache-control"] ?? "", `${route.path} should never cache access failures`).toContain("no-store");
    }
  });

  test("cross-origin mutations are rejected before application logic", async ({ request }) => {
    const response = await request.post("/api/collaborations", {
      headers: { Origin: "https://attacker.example" },
      data: {},
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid request origin." });
  });

  test("public responses carry the production security policy", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("microphone=(self)");
    expect(headers["x-dns-prefetch-control"]).toBe("off");
    expect(headers["x-permitted-cross-domain-policies"]).toBe("none");
  });

  test("health checks expose availability without private data", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-request-id"]).toBeTruthy();
    expect(response.headers()["server-timing"]).toContain("database;dur=");
    expect(body).toMatchObject({ status: "ok", database: "reachable" });
    expect(body.release).toBeTruthy();
    expect(Date.parse(body.timestamp)).not.toBeNaN();

    const liveness = await request.get("/api/health/live");
    expect(liveness.status()).toBe(200);
    expect(liveness.headers()["cache-control"]).toBe("no-store");
    expect(liveness.headers()["x-request-id"]).toBeTruthy();
    await expect(liveness.json()).resolves.toMatchObject({ status: "ok" });
  });
});
