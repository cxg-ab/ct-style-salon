import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";
import { eq } from "drizzle-orm";
import app from "../app";
import {
  appointmentsTable,
  db,
  pool,
} from "@workspace/db";
import type { StylistScheduleEntry } from "../lib/salon-seed";

const testDate = "2099-09-07";
const testEmail = "schedule-regression@example.com";
const managerHeaders = { "x-salon-manager": "true" };
let server: Server;
let baseUrl = "";
let marcoId: number;
let aishaId: number;
let danielId: number;
let signatureCutId: number;
let originalSchedules = new Map<number, StylistScheduleEntry[]>();

type ApiResult<T> = {
  response: Response;
  body: T;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
  return {
    response,
    body: (await response.json()) as T,
  };
}

async function updateSchedule(
  stylistId: number,
  schedule: StylistScheduleEntry[],
): Promise<void> {
  const result = await request(`/api/stylists/${stylistId}/schedule`, {
    method: "PATCH",
    headers: managerHeaders,
    body: JSON.stringify({ schedule }),
  });
  assert.equal(result.response.status, 200);
}

function scheduleWithMonday(
  openTime: string,
  closeTime: string,
): StylistScheduleEntry[] {
  return [{ dayOfWeek: 1, openTime, closeTime }];
}

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose an address.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, testEmail));

  const stylists = await request<
    Array<{ id: number; name: string; schedule: StylistScheduleEntry[] }>
  >("/api/stylists");
  assert.equal(stylists.response.status, 200);
  for (const stylist of stylists.body) {
    originalSchedules.set(stylist.id, stylist.schedule);
  }
  marcoId = stylists.body.find((stylist) => stylist.name === "Marco")?.id ?? 0;
  aishaId = stylists.body.find((stylist) => stylist.name === "Aisha")?.id ?? 0;
  danielId = stylists.body.find((stylist) => stylist.name === "Daniel")?.id ?? 0;

  const services = await request<Array<{ id: number; name: string }>>("/api/services");
  assert.equal(services.response.status, 200);
  signatureCutId =
    services.body.find((service) => service.name === "Signature Cut")?.id ?? 0;
  assert.ok(marcoId && aishaId && danielId && signatureCutId);
});

after(async () => {
  for (const [stylistId, schedule] of originalSchedules) {
    await updateSchedule(stylistId, schedule);
  }
  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, testEmail));
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

test("different employees return different slots for the same date", async () => {
  await updateSchedule(marcoId, scheduleWithMonday("10:00", "14:00"));
  await updateSchedule(aishaId, scheduleWithMonday("14:00", "18:00"));

  const [marco, aisha] = await Promise.all([
    request<Array<{ stylistId: number; date: string; slots: string[] }>>(
      `/api/availability?date=${testDate}&stylistId=${marcoId}&serviceId=${signatureCutId}`,
    ),
    request<Array<{ stylistId: number; date: string; slots: string[] }>>(
      `/api/availability?date=${testDate}&stylistId=${aishaId}&serviceId=${signatureCutId}`,
    ),
  ]);

  assert.equal(marco.response.status, 200);
  assert.equal(aisha.response.status, 200);
  assert.deepEqual(marco.body[0]?.stylistId, marcoId);
  assert.deepEqual(aisha.body[0]?.stylistId, aishaId);
  assert.deepEqual(marco.body[0]?.slots, ["10:00 AM", "11:30 AM", "1:00 PM"]);
  assert.deepEqual(aisha.body[0]?.slots, ["2:00 PM", "3:30 PM", "5:00 PM"]);
  assert.notDeepEqual(marco.body[0]?.slots, aisha.body[0]?.slots);
});

test("closed schedule days return no availability", async () => {
  await updateSchedule(danielId, [{ dayOfWeek: 2, openTime: "10:00", closeTime: "18:00" }]);

  const result = await request<Array<{ slots: string[] }>>(
    `/api/availability?date=${testDate}&stylistId=${danielId}&serviceId=${signatureCutId}`,
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body[0]?.slots, []);
});

test("invalid employees are rejected by availability and appointment creation", async () => {
  const availability = await request<{ error: string }>(
    `/api/availability?date=${testDate}&stylistId=999999&serviceId=${signatureCutId}`,
  );
  assert.equal(availability.response.status, 400);
  assert.equal(availability.body.error, "Choose a valid employee.");

  const appointment = await request<{ error: string }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      serviceId: signatureCutId,
      stylistId: 999999,
      customerName: "Invalid Employee",
      email: testEmail,
      phone: "+971500000000",
      date: testDate,
      time: "10:00 AM",
    }),
  });
  assert.equal(appointment.response.status, 400);
  assert.equal(
    appointment.body.error,
    "That service or stylist is no longer available.",
  );
});

test("booked slots disappear and valid appointment creation succeeds", async () => {
  await updateSchedule(aishaId, scheduleWithMonday("10:00", "18:00"));
  const beforeBooking = await request<Array<{ slots: string[] }>>(
    `/api/availability?date=${testDate}&stylistId=${aishaId}&serviceId=${signatureCutId}`,
  );
  assert.equal(beforeBooking.response.status, 200);
  assert.ok(beforeBooking.body[0]?.slots.includes("10:00 AM"));

  const appointment = await request<{
    id: number;
    serviceId: number;
    stylistId: number;
    date: string;
    time: string;
    email: string;
    status: string;
  }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      serviceId: signatureCutId,
      stylistId: aishaId,
      customerName: "Schedule Regression",
      email: testEmail,
      phone: "+971500000000",
      date: testDate,
      time: "10:00 AM",
      notes: null,
    }),
  });
  assert.equal(appointment.response.status, 201);
  assert.equal(appointment.body.serviceId, signatureCutId);
  assert.equal(appointment.body.stylistId, aishaId);
  assert.equal(appointment.body.date, `${testDate}T00:00:00.000Z`);
  assert.equal(appointment.body.time, "10:00 AM");
  assert.equal(appointment.body.email, testEmail);
  assert.equal(appointment.body.status, "confirmed");

  const afterBooking = await request<Array<{ slots: string[] }>>(
    `/api/availability?date=${testDate}&stylistId=${aishaId}&serviceId=${signatureCutId}`,
  );
  assert.equal(afterBooking.response.status, 200);
  assert.ok(!afterBooking.body[0]?.slots.includes("10:00 AM"));
});