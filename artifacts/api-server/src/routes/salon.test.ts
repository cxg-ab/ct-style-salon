import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";
import { eq } from "drizzle-orm";
import app from "../app";
import {
  appointmentsTable,
  db,
  pool,
  servicesTable,
  stylistsTable,
} from "@workspace/db";
import type { StylistScheduleEntry } from "../lib/salon-seed";
import { ObjectStorageService } from "../lib/objectStorage";

const testDate = "2099-09-07";
const testEmail = "schedule-regression@example.com";
const bundleEmail = "bundle-regression@example.com";
const lifecycleEmail = "stylist-lifecycle@example.com";
const serviceTestName = "Automated Service Regression";
const managerHeaders = { "x-salon-manager": "true" };
let server: Server;
let baseUrl = "";
let marcoId: number;
let aishaId: number;
let danielId: number;
let signatureCutId: number;
let beardRitualId: number;
let bundleDurationMinutes: number;
let bundleTotalPrice: number;
let createdServiceId: number | undefined;
let createdStylistId: number | undefined;
let originalSchedules = new Map<number, StylistScheduleEntry[]>();
let originalStylistNames = new Map<number, string>();

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
    body: response.status === 204 ? undefined as T : (await response.json()) as T,
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

async function updateStylistName(
  stylistId: number,
  name: string,
): Promise<ApiResult<Record<string, unknown>>> {
  return request(`/api/stylists/${stylistId}`, {
    method: "PATCH",
    headers: managerHeaders,
    body: JSON.stringify({ name }),
  });
}

const servicePayload = {
  name: serviceTestName,
  description: "A service created by the API regression suite.",
  durationMinutes: 45,
  price: 125,
  category: "Regression",
  featured: false,
};

async function updateService(
  serviceId: number,
  payload: Partial<typeof servicePayload>,
  headers: Record<string, string> = managerHeaders,
): Promise<ApiResult<Record<string, unknown>>> {
  return request(`/api/services/${serviceId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

async function deleteService(
  serviceId: number,
  headers: Record<string, string> = managerHeaders,
): Promise<ApiResult<{ error: string } | undefined>> {
  return request(`/api/services/${serviceId}`, {
    method: "DELETE",
    headers,
  });
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
  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, bundleEmail));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, lifecycleEmail));
  if (createdStylistId) {
    await db.delete(stylistsTable).where(eq(stylistsTable.id, createdStylistId));
  }

  const stylists = await request<
    Array<{ id: number; name: string; schedule: StylistScheduleEntry[] }>
  >("/api/stylists");
  assert.equal(stylists.response.status, 200);
  for (const stylist of stylists.body) {
    originalSchedules.set(stylist.id, stylist.schedule);
    originalStylistNames.set(stylist.id, stylist.name);
  }
  const orderedStylists = [...stylists.body].sort((left, right) => left.id - right.id);
  marcoId = orderedStylists[0]?.id ?? 0;
  aishaId = orderedStylists[1]?.id ?? 0;
  danielId = orderedStylists[2]?.id ?? 0;

  const services = await request<
    Array<{ id: number; name: string; durationMinutes: number; price: number }>
  >("/api/services");
  assert.equal(services.response.status, 200);
  signatureCutId =
    services.body.find((service) => service.name === "Signature Cut")?.id ?? 0;
  beardRitualId =
    services.body.find((service) => service.name === "Beard Ritual")?.id ?? 0;
  const bundleServices = services.body.filter(
    (service) => service.id === signatureCutId || service.id === beardRitualId,
  );
  bundleDurationMinutes = bundleServices.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );
  bundleTotalPrice = bundleServices.reduce(
    (total, service) => total + Number(service.price),
    0,
  );
  assert.ok(marcoId && aishaId && danielId && signatureCutId && beardRitualId);
});

after(async () => {
  for (const [stylistId, name] of originalStylistNames) {
    await updateStylistName(stylistId, name);
  }
  for (const [stylistId, schedule] of originalSchedules) {
    await updateSchedule(stylistId, schedule);
  }
  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, testEmail));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, bundleEmail));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.email, lifecycleEmail));
  if (createdServiceId) {
    await db.delete(servicesTable).where(eq(servicesTable.id, createdServiceId));
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

test("manager can create a service and the service persists in the listing", async () => {
  const created = await request<{
    id: number;
    name: string;
    durationMinutes: number;
    price: number;
    category: string;
    featured: boolean;
  }>("/api/services", {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify(servicePayload),
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.body.name, serviceTestName);
  assert.equal(created.body.durationMinutes, 45);
  assert.equal(created.body.price, 125);
  assert.equal(created.body.category, "Regression");
  assert.equal(created.body.featured, false);
  createdServiceId = created.body.id;

  const listed = await request<
    Array<{
      id: number;
      name: string;
      description: string;
      durationMinutes: number;
      price: number;
      category: string;
      featured: boolean;
    }>
  >("/api/services");
  assert.equal(listed.response.status, 200);
  assert.deepEqual(
    listed.body.find((service) => service.id === createdServiceId),
    {
      id: createdServiceId,
      name: serviceTestName,
      description: servicePayload.description,
      durationMinutes: 45,
      price: 125,
      category: "Regression",
      featured: false,
    },
  );
});

test("manager can update a service and the changes persist", async () => {
  assert.ok(createdServiceId);
  const payload = {
    ...servicePayload,
    name: "Updated Automated Service",
    description: "The persisted update from the API regression suite.",
    durationMinutes: 75,
    price: 130.5,
    category: "Updated Regression",
    featured: true,
  };

  const updated = await updateService(createdServiceId, payload);
  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body, {
    id: createdServiceId,
    ...payload,
  });

  const listed = await request<
    Array<{
      id: number;
      name: string;
      description: string;
      durationMinutes: number;
      price: number;
      category: string;
      featured: boolean;
    }>
  >("/api/services");
  assert.equal(listed.response.status, 200);
  assert.deepEqual(
    listed.body.find((service) => service.id === createdServiceId),
    { id: createdServiceId, ...payload },
  );
});

test("service management rejects unauthenticated requests", async () => {
  const create = await request<{ error: string }>("/api/services", {
    method: "POST",
    body: JSON.stringify(servicePayload),
  });
  assert.equal(create.response.status, 401);
  assert.equal(create.body.error, "Sign in as a salon manager to make changes.");

  const update = await updateService(createdServiceId ?? 999999, servicePayload, {});
  assert.equal(update.response.status, 401);
  assert.equal(update.body.error, "Sign in as a salon manager to make changes.");

  const deletion = await deleteService(createdServiceId ?? 999999, {});
  assert.equal(deletion.response.status, 401);
  assert.equal(deletion.body?.error, "Sign in as a salon manager to make changes.");
});

test("service management rejects authenticated non-managers", async () => {
  const result = await request(`/api/services/${signatureCutId}`, {
    method: "DELETE",
    headers: { "x-salon-user": "true" },
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, {
    error: "Your account does not have salon manager access.",
  });
});

test("employee photo uploads require a manager and enforce image limits", async () => {
  const unauthenticated = await request<{ error: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      body: JSON.stringify({
        name: "portrait.png",
        size: 1024,
        contentType: "image/png",
      }),
    },
  );
  assert.equal(unauthenticated.response.status, 401);

  const unsupported = await request<{ error: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      headers: managerHeaders,
      body: JSON.stringify({
        name: "portrait.pdf",
        size: 1024,
        contentType: "application/pdf",
      }),
    },
  );
  assert.equal(unsupported.response.status, 400);

  const oversized = await request<{ error: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      headers: managerHeaders,
      body: JSON.stringify({
        name: "portrait.png",
        size: 5 * 1024 * 1024 + 1,
        contentType: "image/png",
      }),
    },
  );
  assert.equal(oversized.response.status, 400);

  const valid = await request<{
    uploadURL: string;
    objectPath: string;
    metadata: { name: string; size: number; contentType: string };
  }>("/api/storage/uploads/request-url", {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      name: "portrait.png",
      size: 1024,
      contentType: "image/png",
    }),
  });
  assert.equal(valid.response.status, 200);
  assert.match(valid.body.uploadURL, /^https?:\/\//);
  assert.match(valid.body.objectPath, /^\/objects\/uploads\//);
  assert.deepEqual(valid.body.metadata, {
    name: "portrait.png",
    size: 1024,
    contentType: "image/png",
  });

  const listed = await request<
    Array<{
      id: number;
      name: string;
      role: string;
      bio: string;
      initials: string;
      accent: string;
      photoUrl: string | null;
      schedule: StylistScheduleEntry[];
    }>
  >("/api/stylists");
  const current = listed.body.find((stylist) => stylist.id === marcoId);
  assert.ok(current);
  const originalPhotoUrl = current.photoUrl;
  try {
    const updated = await request<{ photoUrl: string | null }>(
      `/api/stylists/${marcoId}`,
      {
        method: "PATCH",
        headers: managerHeaders,
        body: JSON.stringify({
          name: current.name,
          role: current.role,
          bio: current.bio,
          initials: current.initials,
          accent: current.accent,
          photoUrl: valid.body.objectPath,
          schedule: current.schedule,
        }),
      },
    );
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.photoUrl, `/api/storage${valid.body.objectPath}`);
    const [stored] = await db
      .select({ photoUrl: stylistsTable.photoUrl })
      .from(stylistsTable)
      .where(eq(stylistsTable.id, marcoId));
    assert.equal(stored?.photoUrl, valid.body.objectPath);
  } finally {
    await db
      .update(stylistsTable)
      .set({
        photoUrl: originalPhotoUrl?.startsWith("/api/storage/objects/")
          ? `/objects/${originalPhotoUrl.slice("/api/storage/objects/".length)}`
          : originalPhotoUrl,
      })
      .where(eq(stylistsTable.id, marcoId));
  }
});

test("service management rejects incomplete requests", async () => {
  const incomplete = {
    name: "Incomplete Service",
    durationMinutes: 45,
    price: 100,
    category: "Regression",
    featured: false,
  };

  const create = await request<{ error: string }>("/api/services", {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify(incomplete),
  });
  assert.equal(create.response.status, 400);
  assert.equal(
    create.body.error,
    "Enter a complete service with a valid duration and price.",
  );

  const update = await updateService(createdServiceId ?? 999999, incomplete);
  assert.equal(update.response.status, 400);
  assert.equal(
    update.body.error,
    "Enter a complete service with a valid duration and price.",
  );
});

test("service management rejects non-positive durations", async () => {
  const invalid = { ...servicePayload, durationMinutes: 0 };
  const negative = { ...servicePayload, durationMinutes: -15 };

  for (const payload of [invalid, negative]) {
    const create = await request<{ error: string }>("/api/services", {
      method: "POST",
      headers: managerHeaders,
      body: JSON.stringify(payload),
    });
    assert.equal(create.response.status, 400);
    assert.equal(
      create.body.error,
      "Enter a complete service with a valid duration and price.",
    );

    const update = await updateService(createdServiceId ?? 999999, payload);
    assert.equal(update.response.status, 400);
    assert.equal(
      update.body.error,
      "Enter a complete service with a valid duration and price.",
    );
  }
});

test("service management rejects malformed prices", async () => {
  const invalid = { ...servicePayload, price: 100.125 };

  const create = await request<{ error: string }>("/api/services", {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify(invalid),
  });
  assert.equal(create.response.status, 400);
  assert.equal(
    create.body.error,
    "Enter a valid price with no more than two decimal places.",
  );

  const update = await updateService(createdServiceId ?? 999999, invalid);
  assert.equal(update.response.status, 400);
  assert.equal(
    update.body.error,
    "Enter a valid price with no more than two decimal places.",
  );
});

test("manager can delete an unused service and it disappears from the listing", async () => {
  assert.ok(createdServiceId);
  const deletedId = createdServiceId;
  const deleted = await deleteService(deletedId);
  assert.equal(deleted.response.status, 204);
  createdServiceId = undefined;

  const listed = await request<Array<{ id: number }>>("/api/services");
  assert.equal(listed.response.status, 200);
  assert.ok(!listed.body.some((service) => service.id === deletedId));
});

test("manager roster lifecycle persists edits and archives employees with appointments", async () => {
  const created = await request<{
    id: number;
    name: string;
    role: string;
    bio: string;
    initials: string;
    accent: string;
    photoUrl: string | null;
    active: boolean;
    schedule: StylistScheduleEntry[];
  }>("/api/stylists", {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      name: "Lifecycle Employee",
      role: "Guest Stylist",
      bio: "A temporary employee for the roster lifecycle test.",
      initials: "LE",
      accent: "#B86B45",
      photoUrl: "https://cdn.example.com/lifecycle.jpg",
      schedule: scheduleWithMonday("10:00", "14:00"),
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.active, true);
  assert.equal(created.body.photoUrl, "https://cdn.example.com/lifecycle.jpg");
  createdStylistId = created.body.id;

  const updated = await request<{ name: string; photoUrl: string | null; schedule: StylistScheduleEntry[] }>(
    `/api/stylists/${createdStylistId}`,
    {
      method: "PATCH",
      headers: managerHeaders,
      body: JSON.stringify({
        name: "Updated Lifecycle Employee",
        role: "Senior Guest Stylist",
        bio: "An updated employee profile for the roster lifecycle test.",
        initials: "ULE",
        accent: "#6B705C",
        photoUrl: "https://cdn.example.com/updated-lifecycle.jpg",
        schedule: scheduleWithMonday("11:00", "15:00"),
      }),
    },
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.name, "Updated Lifecycle Employee");
  assert.equal(updated.body.photoUrl, "https://cdn.example.com/updated-lifecycle.jpg");
  assert.deepEqual(updated.body.schedule, scheduleWithMonday("11:00", "15:00"));

  const appointment = await request<{ stylistName: string }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      serviceId: signatureCutId,
      stylistId: createdStylistId,
      customerName: "Roster Test Guest",
      email: "stylist-lifecycle@example.com",
      phone: "+971500000000",
      date: testDate,
      time: "11:00 AM",
    }),
  });
  assert.equal(appointment.response.status, 201);

  const removed = await request<{ active: boolean }>(`/api/stylists/${createdStylistId}`, {
    method: "DELETE",
    headers: managerHeaders,
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.active, false);

  const listed = await request<Array<{ id: number }>>("/api/stylists");
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.some((stylist) => stylist.id === createdStylistId), false);

  const history = await request<Array<{ stylistName: string }>>(
    "/api/appointments?email=stylist-lifecycle%40example.com",
  );
  assert.equal(history.response.status, 200);
  assert.equal(history.body[0]?.stylistName, "Updated Lifecycle Employee");
});

test("employee photo cleanup deletes only unreferenced managed objects", async () => {
  const sharedPhotoPath = "/objects/uploads/photo-cleanup-shared";
  const replacementPhotoPath = "/objects/uploads/photo-cleanup-replacement";
  const [first, second] = await db
    .insert(stylistsTable)
    .values([
      {
        name: "Photo Cleanup First",
        role: "Guest Stylist",
        bio: "A temporary employee for photo cleanup coverage.",
        initials: "PCF",
        accent: "#B86B45",
        photoUrl: sharedPhotoPath,
        schedule: [],
        active: true,
      },
      {
        name: "Photo Cleanup Second",
        role: "Guest Stylist",
        bio: "Another temporary employee for photo cleanup coverage.",
        initials: "PCS",
        accent: "#6B705C",
        photoUrl: sharedPhotoPath,
        schedule: [],
        active: true,
      },
    ])
    .returning({ id: stylistsTable.id });
  const deletedPaths: string[] = [];
  const originalDeleteObjectEntity = ObjectStorageService.prototype.deleteObjectEntity;
  ObjectStorageService.prototype.deleteObjectEntity = async function (objectPath) {
    deletedPaths.push(objectPath);
  };

  const updatePhoto = (stylistId: number, photoUrl: string | null) =>
    request<{ photoUrl: string | null }>(`/api/stylists/${stylistId}`, {
      method: "PATCH",
      headers: managerHeaders,
      body: JSON.stringify({
        name: stylistId === first.id ? "Photo Cleanup First" : "Photo Cleanup Second",
        role: "Guest Stylist",
        bio: "A temporary employee for photo cleanup coverage.",
        initials: stylistId === first.id ? "PCF" : "PCS",
        accent: stylistId === first.id ? "#B86B45" : "#6B705C",
        photoUrl,
        schedule: [],
      }),
    });

  try {
    const firstReplacement = await updatePhoto(first.id, replacementPhotoPath);
    assert.equal(firstReplacement.response.status, 200);
    assert.deepEqual(deletedPaths, []);

    const secondCleared = await updatePhoto(second.id, null);
    assert.equal(secondCleared.response.status, 200);
    assert.deepEqual(deletedPaths, [sharedPhotoPath]);

    const firstCleared = await updatePhoto(first.id, null);
    assert.equal(firstCleared.response.status, 200);
    assert.deepEqual(deletedPaths, [sharedPhotoPath, replacementPhotoPath]);

    await db
      .update(stylistsTable)
      .set({ photoUrl: "https://cdn.example.com/legacy-photo.jpg" })
      .where(eq(stylistsTable.id, first.id));
    const externalReplacement = await updatePhoto(first.id, "https://cdn.example.com/new-photo.jpg");
    assert.equal(externalReplacement.response.status, 200);
    assert.deepEqual(deletedPaths, [sharedPhotoPath, replacementPhotoPath]);
  } finally {
    ObjectStorageService.prototype.deleteObjectEntity = originalDeleteObjectEntity;
    await db.delete(stylistsTable).where(eq(stylistsTable.id, first.id));
    await db.delete(stylistsTable).where(eq(stylistsTable.id, second.id));
  }
});

test("manager can rename an employee without losing their schedule", async () => {
  const originalSchedule = originalSchedules.get(marcoId);
  const originalName = originalStylistNames.get(marcoId);
  assert.ok(originalSchedule);
  assert.ok(originalName);

  const updated = await updateStylistName(marcoId, `${originalName} Updated`);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.name, `${originalName} Updated`);
  assert.deepEqual(updated.body.schedule, originalSchedule);

  const listed = await request<
    Array<{ id: number; name: string; schedule: StylistScheduleEntry[] }>
  >("/api/stylists");
  assert.equal(listed.response.status, 200);
  const listedStylist = listed.body.find((stylist) => stylist.id === marcoId);
  assert.equal(listedStylist?.name, `${originalName} Updated`);
  assert.deepEqual(listedStylist?.schedule, originalSchedule);

  const blank = await updateStylistName(marcoId, "   ");
  assert.equal(blank.response.status, 400);
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

test("recurring breaks are saved and remove overlapping appointment starts", async () => {
  const schedule: StylistScheduleEntry[] = [{
    dayOfWeek: 1,
    openTime: "10:00",
    closeTime: "18:00",
    breaks: [{ startTime: "11:45", endTime: "13:00" }],
  }];
  await updateSchedule(marcoId, schedule);

  const listed = await request<Array<{ id: number; schedule: StylistScheduleEntry[] }>>("/api/stylists");
  assert.deepEqual(listed.body.find((stylist) => stylist.id === marcoId)?.schedule, schedule);

  const availability = await request<Array<{ slots: string[] }>>(
    `/api/availability?date=${testDate}&stylistId=${marcoId}&serviceId=${signatureCutId}`,
  );
  assert.equal(availability.response.status, 200);
  assert.deepEqual(availability.body[0]?.slots, ["10:00 AM", "1:00 PM", "2:30 PM", "4:00 PM"]);
});

test("break validation rejects invalid and overlapping intervals", async () => {
  const invalidSchedules: StylistScheduleEntry[][] = [
    [{
      dayOfWeek: 1,
      openTime: "10:00",
      closeTime: "18:00",
      breaks: [{ startTime: "14:00", endTime: "13:00" }],
    }],
    [{
      dayOfWeek: 1,
      openTime: "10:00",
      closeTime: "18:00",
      breaks: [{ startTime: "09:00", endTime: "10:30" }],
    }],
    [{
      dayOfWeek: 1,
      openTime: "10:00",
      closeTime: "18:00",
      breaks: [
        { startTime: "12:00", endTime: "13:00" },
        { startTime: "12:30", endTime: "13:30" },
      ],
    }],
  ];

  for (const schedule of invalidSchedules) {
    const result = await request<{ error: string }>(`/api/stylists/${marcoId}/schedule`, {
      method: "PATCH",
      headers: managerHeaders,
      body: JSON.stringify({ schedule }),
    });
    assert.equal(result.response.status, 400);
  }
});

test("appointment creation rechecks recurring break conflicts", async () => {
  await updateSchedule(marcoId, [{
    dayOfWeek: 1,
    openTime: "10:00",
    closeTime: "18:00",
    breaks: [{ startTime: "11:45", endTime: "13:00" }],
  }]);

  const appointment = await request<{ error: string }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      serviceId: signatureCutId,
      stylistId: marcoId,
      customerName: "Break Conflict",
      email: testEmail,
      phone: "+971500000000",
      date: testDate,
      time: "11:30 AM",
    }),
  });
  assert.equal(appointment.response.status, 400);
  assert.equal(appointment.body.error, "That employee is on a break at the selected time.");
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

test("service bundles use combined availability, persist as one appointment, and display in lookup", async () => {
  await updateSchedule(aishaId, [{
    dayOfWeek: 1,
    openTime: "10:00",
    closeTime: "18:00",
    breaks: [{ startTime: "11:45", endTime: "13:00" }],
  }]);

  const availability = await request<Array<{ slots: string[] }>>(
    `/api/availability?date=2099-09-14&stylistId=${aishaId}&serviceIds=${signatureCutId}&serviceIds=${beardRitualId}`,
  );
  assert.equal(availability.response.status, 200);
  const tenAmOverlapsBreak =
    10 * 60 < 13 * 60 &&
    11 * 60 + 45 < 10 * 60 + bundleDurationMinutes;
  assert.equal(availability.body[0]?.slots.includes("10:00 AM"), !tenAmOverlapsBreak);
  assert.ok(availability.body[0]?.slots.includes("1:00 PM"));

  const created = await request<{
    id: number;
    serviceId: number;
    serviceIds: number[];
    serviceName: string;
    serviceNames: string[];
    totalDurationMinutes: number;
    totalPrice: number;
  }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      serviceIds: [signatureCutId, beardRitualId],
      stylistId: aishaId,
      customerName: "Bundle Regression",
      email: bundleEmail,
      phone: "+971500000000",
      date: "2099-09-14",
      time: "1:00 PM",
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.serviceId, signatureCutId);
  assert.deepEqual(created.body.serviceIds, [signatureCutId, beardRitualId]);
  assert.deepEqual(created.body.serviceNames, ["Signature Cut", "Beard Ritual"]);
  assert.equal(created.body.serviceName, "Signature Cut, Beard Ritual");
  assert.equal(created.body.totalDurationMinutes, bundleDurationMinutes);
  assert.equal(created.body.totalPrice, bundleTotalPrice);

  const overlapping = await request<{ error: string }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      serviceIds: [beardRitualId],
      stylistId: aishaId,
      customerName: "Bundle Overlap",
      email: bundleEmail,
      phone: "+971500000000",
      date: "2099-09-14",
      time: "1:00 PM",
    }),
  });
  assert.equal(overlapping.response.status, 400);
  assert.equal(
    overlapping.body.error,
    "That time was just booked. Please choose another slot.",
  );

  const history = await request<Array<{
    serviceIds: number[];
    serviceNames: string[];
    totalDurationMinutes: number;
    totalPrice: number;
  }>>(`/api/appointments?email=${encodeURIComponent(bundleEmail)}`);
  assert.equal(history.response.status, 200);
  assert.deepEqual(history.body[0]?.serviceIds, [signatureCutId, beardRitualId]);
  assert.deepEqual(history.body[0]?.serviceNames, ["Signature Cut", "Beard Ritual"]);
  assert.equal(history.body[0]?.totalDurationMinutes, bundleDurationMinutes);
  assert.equal(history.body[0]?.totalPrice, bundleTotalPrice);
});

test("services referenced by appointments cannot be deleted", async () => {
  const result = await deleteService(signatureCutId);
  assert.equal(result.response.status, 409);
  assert.equal(
    result.body?.error,
    "This service cannot be deleted because it has existing appointments.",
  );
});