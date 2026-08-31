import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const port = Number(process.env.TEST_PORT ?? 18080 + (process.pid % 1000));
const apiBaseUrl =
  process.env.API_BASE_URL ?? `http://127.0.0.1:${port}/api`;
const testEmailPrefix = `overlap-regression-${process.pid}-${Date.now()}`;
const cleanupSql =
  "DELETE FROM salon_appointments WHERE email LIKE 'overlap-regression-%@example.test';";

let apiProcess;
let shortService;
let longService;
let marco;

function cleanupTestAppointments() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for overlap regression tests.");
  }

  execFileSync(
    "psql",
    [
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--dbname",
      process.env.DATABASE_URL,
      "--command",
      cleanupSql,
    ],
    { stdio: "ignore" },
  );
}

async function waitForApi() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/healthz`);
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not start at ${apiBaseUrl}.`);
}

async function request(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function createAppointment({ serviceId, date, time, label }) {
  return request("/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      serviceId,
      stylistId: marco.id,
      customerName: "Overlap Regression",
      email: `${testEmailPrefix}-${label}@example.test`,
      phone: "0500000000",
      date,
      time,
      notes: null,
    }),
  });
}

before(async () => {
  cleanupTestAppointments();

  if (!process.env.API_BASE_URL) {
    apiProcess = spawn(process.execPath, ["./dist/index.mjs"], {
      env: { ...process.env, NODE_ENV: "test", PORT: String(port) },
      stdio: "ignore",
    });
  }
  await waitForApi();

  const [{ body: services }, { body: stylists }] = await Promise.all([
    request("/services"),
    request("/stylists"),
  ]);
  shortService = services.find((service) => service.name === "Beard Ritual");
  longService = services.find((service) => service.name === "The CT Style");
  marco = stylists.find((stylist) => stylist.name === "Marco");

  assert.ok(shortService, "The seeded short service should be available.");
  assert.ok(longService, "The seeded long service should be available.");
  assert.ok(marco, "The seeded Marco stylist should be available.");
});

after(async () => {
  try {
    cleanupTestAppointments();
  } finally {
    if (apiProcess) {
      apiProcess.kill("SIGTERM");
      await once(apiProcess, "exit");
    }
  }
});

test("a longer service removes slots overlapping an existing shorter service", async () => {
  const date = "2099-01-05";
  const created = await createAppointment({
    serviceId: shortService.id,
    date,
    time: "11:30 AM",
    label: "short-blocker",
  });
  assert.equal(created.response.status, 201);

  const availability = await request(
    `/availability?date=${date}&stylistId=${marco.id}&serviceId=${longService.id}`,
  );
  assert.equal(availability.response.status, 200);
  const slots = availability.body[0].slots;
  assert.ok(slots.includes("10:00 AM"));
  assert.ok(slots.includes("1:00 PM"));
  assert.ok(!slots.includes("11:30 AM"));
});

test("an appointment ending at a candidate start remains bookable", async () => {
  const date = "2099-01-06";
  const created = await createAppointment({
    serviceId: longService.id,
    date,
    time: "10:00 AM",
    label: "back-to-back-blocker",
  });
  assert.equal(created.response.status, 201);

  const availability = await request(
    `/availability?date=${date}&stylistId=${marco.id}&serviceId=${shortService.id}`,
  );
  assert.equal(availability.response.status, 200);
  const slots = availability.body[0].slots;
  assert.ok(!slots.includes("10:00 AM"));
  assert.ok(slots.includes("11:30 AM"));
});

test("a direct overlapping booking is rejected by the server", async () => {
  const date = "2099-01-07";
  const created = await createAppointment({
    serviceId: shortService.id,
    date,
    time: "11:30 AM",
    label: "direct-overlap-blocker",
  });
  assert.equal(created.response.status, 201);

  const overlapping = await createAppointment({
    serviceId: longService.id,
    date,
    time: "11:30 AM",
    label: "direct-overlap-attempt",
  });
  assert.equal(overlapping.response.status, 400);
  assert.equal(
    overlapping.body.error,
    "That time was just booked. Please choose another slot.",
  );
});