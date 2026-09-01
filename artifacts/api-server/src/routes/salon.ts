import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { clerkClient, getAuth } from "@clerk/express";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentGroupBody,
  CreateAppointmentGroupResponse,
  CreateAppointmentResponse,
  CreateServiceBody,
  CreateServiceResponse,
  CreateStylistBody,
  CreateStylistResponse,
  DeleteStylistParams,
  DeleteStylistResponse,
  GetAvailabilityQueryParams,
  GetAvailabilityResponse,
  GetSalonSummaryResponse,
  ListManagerAppointmentsResponse,
  ListManagerCustomersResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  ListServicesResponse,
  ListStylistsResponse,
  UpdateManagerAppointmentBody,
  UpdateManagerAppointmentParams,
  UpdateManagerAppointmentResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
  UpdateStylistBody,
  UpdateStylistParams,
  UpdateStylistResponse,
  UpdateStylistScheduleBody,
  UpdateStylistScheduleParams,
  UpdateStylistScheduleResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  db,
  servicesTable,
  stylistsTable,
} from "@workspace/db";
import {
  ensureSalonSeeded,
  type StylistScheduleEntry,
} from "../lib/salon-seed";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_BOOKING_DAYS_AHEAD = 5;
const UAE_TIME_ZONE = "Asia/Dubai";
export type SalonClock = () => Date;
const systemClock: SalonClock = () => new Date();
let salonClock: SalonClock = systemClock;
type BookedAppointment = {
  time: string;
  durationMinutes: number;
};

function timeToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) {
    return undefined;
  }

  return (hour % 12) * 60 + minute + (match[3] === "PM" ? 12 * 60 : 0);
}

function scheduleTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatSlotTime(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function slotsForSchedule(
  schedule: StylistScheduleEntry[],
  weekday: number,
  durationMinutes: number,
): string[] {
  const slots = new Set<string>();
  for (const entry of schedule.filter((item) => item.dayOfWeek === weekday)) {
    const open = scheduleTimeToMinutes(entry.openTime);
    const close = scheduleTimeToMinutes(entry.closeTime);
    for (let start = open; start + durationMinutes <= close; start += 30) {
      const overlapsBreak = (entry.breaks ?? []).some((breakTime) => {
        const breakStart = scheduleTimeToMinutes(breakTime.startTime);
        const breakEnd = scheduleTimeToMinutes(breakTime.endTime);
        return start < breakEnd && breakStart < start + durationMinutes;
      });
      if (!overlapsBreak) {
        slots.add(formatSlotTime(start));
      }
    }
  }
  return [...slots].sort((left, right) => {
    return (timeToMinutes(left) ?? 0) - (timeToMinutes(right) ?? 0);
  });
}

function validateSchedule(schedule: StylistScheduleEntry[]): string | undefined {
  for (const entry of schedule) {
    if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
      return "Choose a valid working day for every schedule entry.";
    }
    const open = scheduleTimeToMinutes(entry.openTime);
    const close = scheduleTimeToMinutes(entry.closeTime);
    if (!Number.isFinite(open) || !Number.isFinite(close) || open >= close) {
      return "Each opening time must be earlier than its closing time.";
    }
    const breaks = entry.breaks ?? [];
    for (const breakTime of breaks) {
      const breakStart = scheduleTimeToMinutes(breakTime.startTime);
      const breakEnd = scheduleTimeToMinutes(breakTime.endTime);
      if (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd) || breakStart >= breakEnd) {
        return "Each break must start before it ends.";
      }
      if (breakStart < open || breakEnd > close) {
        return "Breaks must fall within working hours.";
      }
    }
    for (let breakIndex = 0; breakIndex < breaks.length; breakIndex += 1) {
      for (let otherBreakIndex = breakIndex + 1; otherBreakIndex < breaks.length; otherBreakIndex += 1) {
        const breakTime = breaks[breakIndex];
        const otherBreak = breaks[otherBreakIndex];
        if (
          scheduleTimeToMinutes(breakTime.startTime) < scheduleTimeToMinutes(otherBreak.endTime) &&
          scheduleTimeToMinutes(otherBreak.startTime) < scheduleTimeToMinutes(breakTime.endTime)
        ) {
          return "Breaks cannot overlap on the same day.";
        }
      }
    }
  }

  for (let index = 0; index < schedule.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < schedule.length; otherIndex += 1) {
      const entry = schedule[index];
      const other = schedule[otherIndex];
      if (
        entry.dayOfWeek === other.dayOfWeek &&
        scheduleTimeToMinutes(entry.openTime) < scheduleTimeToMinutes(other.closeTime) &&
        scheduleTimeToMinutes(other.openTime) < scheduleTimeToMinutes(entry.closeTime)
      ) {
        return "Working hours cannot overlap on the same day.";
      }
    }
  }
  return undefined;
}

type AuthenticatedRequest = Request & {
  salonManagerId?: string;
};

async function requireCustomerAccount(req: Request, res: Response): Promise<string | undefined> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to manage appointments in your account." });
    return undefined;
  }
  return userId;
}

export async function requireSalonManager(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  const testManager =
    process.env.NODE_ENV === "test" && req.header("x-salon-manager") === "true"
      ? "test-manager"
      : undefined;
  const testNonManager =
    process.env.NODE_ENV === "test" && req.header("x-salon-user") === "true";

  if (!userId && !testManager && !testNonManager) {
    res.status(401).json({ error: "Sign in as a salon manager to make changes." });
    return false;
  }

  if (testNonManager) {
    res.status(403).json({ error: "Your account does not have salon manager access." });
    return false;
  }

  if (userId) {
    const user = await clerkClient.users.getUser(userId);
    if (user.publicMetadata.role !== "manager") {
      res.status(403).json({ error: "Your account does not have salon manager access." });
      return false;
    }
  }

  req.salonManagerId = userId ?? testManager;
  req.log?.info({ managerId: req.salonManagerId }, "Salon manager mutation authorized");
  return true;
}

function appointmentTimesOverlap(
  startTime: string,
  durationMinutes: number,
  booked: BookedAppointment,
): boolean {
  const start = timeToMinutes(startTime);
  const bookedStart = timeToMinutes(booked.time);
  if (start === undefined || bookedStart === undefined) {
    return false;
  }

  // Ranges are half-open, so an appointment ending at another's start is valid.
  return (
    start < bookedStart + booked.durationMinutes &&
    bookedStart < start + durationMinutes
  );
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function uaeDateTimeParts(value = new Date()): {
  date: string;
  minutes: number;
} {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: UAE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function setSalonClockForTests(clock: SalonClock): void {
  salonClock = clock;
}

export function resetSalonClockForTests(): void {
  salonClock = systemClock;
}

function currentUaeDateTimeParts() {
  return uaeDateTimeParts(salonClock());
}

function isFutureUaeSlot(date: string, time: string): boolean {
  const requestedMinutes = timeToMinutes(time);
  if (requestedMinutes === undefined) {
    return false;
  }
  const current = currentUaeDateTimeParts();
  if (date > current.date) {
    return true;
  }
  if (date < current.date) {
    return false;
  }
  return requestedMinutes > current.minutes;
}

function appointmentResponse(
  row: typeof appointmentsTable.$inferSelect,
  serviceRows: Array<typeof servicesTable.$inferSelect>,
  stylistName: string,
) {
  const { clerkUserId: _clerkUserId, ...publicRow } = row;
  const serviceIds = row.serviceIds.length > 0 ? row.serviceIds : [row.serviceId];
  const servicesById = new Map(serviceRows.map((service) => [service.id, service]));
  const selectedServices = serviceIds
    .map((serviceId) => servicesById.get(serviceId))
    .filter((service): service is typeof servicesTable.$inferSelect => Boolean(service));
  const serviceNames = selectedServices.map((service) => service.name);
  const calculatedDuration = selectedServices.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );
  const calculatedPrice = selectedServices.reduce(
    (total, service) => total + Number(service.price),
    0,
  );

  return {
    ...publicRow,
    serviceId: serviceIds[0],
    serviceIds,
    serviceName: serviceNames.join(", "),
    serviceNames,
    totalDurationMinutes: row.totalDurationMinutes ?? calculatedDuration,
    totalPrice: Number(row.totalPrice ?? calculatedPrice),
    stylistName,
    date: new Date(`${row.date}T00:00:00.000Z`),
  };
}

function isWithinBookingWindow(date: Date): boolean {
  const today = currentUaeDateTimeParts().date;
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const requestedUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysAhead = Math.round((requestedUtc - todayUtc) / (24 * 60 * 60 * 1000));
  return daysAhead >= 0 && daysAhead <= MAX_BOOKING_DAYS_AHEAD;
}

async function serializeAppointments(
  rows: Array<{ appointment: typeof appointmentsTable.$inferSelect; stylistName: string }>,
) {
  return Promise.all(
    rows.map(async ({ appointment, stylistName }) => {
      const serviceIds =
        appointment.serviceIds.length > 0
          ? appointment.serviceIds
          : [appointment.serviceId];
      const serviceRows = await db
        .select()
        .from(servicesTable)
        .where(inArray(servicesTable.id, serviceIds));
      return appointmentResponse(appointment, serviceRows, stylistName);
    }),
  );
}

function parseServiceIds(value: unknown): number[] {
  const values = Array.isArray(value)
    ? value.flatMap((item) => String(item).split(","))
    : value === undefined || value === null
      ? []
      : String(value).split(",");
  return [...new Set(values.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function stylistResponse(row: typeof stylistsTable.$inferSelect) {
  return {
    ...row,
    photoUrl:
      row.photoUrl?.startsWith("/objects/")
        ? `/api/storage${row.photoUrl}`
        : row.photoUrl,
    schedule: row.schedule ?? [],
    serviceIds: row.serviceIds ?? [],
  };
}

function isEligibleForServices(
  stylist: Pick<typeof stylistsTable.$inferSelect, "serviceIds">,
  serviceIds: number[],
): boolean {
  return stylist.serviceIds.length === 0 || serviceIds.every((id) => stylist.serviceIds.includes(id));
}

function storedPhotoPath(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  const storagePrefix = "/api/storage/objects/";
  if (photoUrl.startsWith(storagePrefix)) {
    return `/objects/${photoUrl.slice(storagePrefix.length)}`;
  }
  return photoUrl;
}

function managedPhotoPath(photoUrl: string | null | undefined): string | null {
  const path = storedPhotoPath(photoUrl);
  return path?.startsWith("/objects/") ? path : null;
}

async function cleanupReplacedPhoto(
  stylistId: number,
  previousPhotoUrl: string | null | undefined,
  nextPhotoUrl: string | null | undefined,
  req: Request,
): Promise<void> {
  try {
    const previousPath = managedPhotoPath(previousPhotoUrl);
    const nextPath = managedPhotoPath(nextPhotoUrl);
    if (!previousPath || previousPath === nextPath) {
      return;
    }

    const referencedPhotos = await db
      .select({ photoUrl: stylistsTable.photoUrl })
      .from(stylistsTable)
      .where(ne(stylistsTable.id, stylistId));
    if (referencedPhotos.some((row) => managedPhotoPath(row.photoUrl) === previousPath)) {
      return;
    }

    await objectStorageService.deleteObjectEntity(previousPath);
  } catch (error) {
    req.log?.error({ err: error }, "Error deleting replaced employee photo");
  }
}

function validateStylistPayload(payload: {
  name: string;
  role: string;
  bio?: string;
  initials?: string;
  accent: string;
  photoUrl?: string | null;
  schedule: StylistScheduleEntry[];
  serviceIds?: number[];
}): string | undefined {
  if (
    !payload.name.trim() ||
    !payload.role.trim() ||
    !payload.accent.trim()
  ) {
    return "Name, job title, and accent are required.";
  }
  if ((payload.initials ?? "").trim().length > 5) {
    return "Initials must be five characters or fewer.";
  }
  if (payload.photoUrl) {
    if (payload.photoUrl.startsWith("/")) {
      if (
        payload.photoUrl.startsWith("//") ||
        payload.photoUrl.includes("..") ||
        payload.photoUrl.includes("\\")
      ) {
        return "Enter a valid photo URL.";
      }
    } else {
      try {
        const url = new URL(payload.photoUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return "Photo URL must use http or https.";
        }
      } catch {
        return "Enter a valid photo URL.";
      }
    }
  }
  return validateSchedule(payload.schedule);
}

async function validateStylistServiceIds(serviceIds: number[]): Promise<boolean> {
  if (serviceIds.length === 0) return true;
  const rows = await db.select({ id: servicesTable.id }).from(servicesTable).where(inArray(servicesTable.id, serviceIds));
  return rows.length === serviceIds.length;
}

router.get("/services", async (_req, res): Promise<void> => {
  await ensureSalonSeeded();
  const rows = await db.select().from(servicesTable).orderBy(servicesTable.id);
  res.json(
    ListServicesResponse.parse(
      rows.map((row) => ({ ...row, price: Number(row.price) })),
    ),
  );
});

function validateServicePayload(payload: {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  category: string;
  featured: boolean;
}): string | undefined {
  if (
    !payload.name.trim() ||
    !payload.description.trim() ||
    !payload.category.trim()
  ) {
    return "Name, description, and category are required.";
  }
  if (
    !Number.isInteger(payload.durationMinutes) ||
    payload.durationMinutes <= 0
  ) {
    return "Duration must be a positive whole number of minutes.";
  }
  if (
    !Number.isFinite(payload.price) ||
    payload.price < 0 ||
    Number(payload.price.toFixed(2)) !== payload.price
  ) {
    return "Enter a valid price with no more than two decimal places.";
  }
  return undefined;
}

function serviceResponse(row: typeof servicesTable.$inferSelect) {
  return {
    ...row,
    price: Number(row.price),
  };
}

router.post("/services", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const body = CreateServiceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter a complete service with a valid duration and price." });
    return;
  }
  const validationError = validateServicePayload(body.data);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const [created] = await db
    .insert(servicesTable)
    .values({
      ...body.data,
      name: body.data.name.trim(),
      description: body.data.description.trim(),
      category: body.data.category.trim(),
      price: body.data.price.toFixed(2),
    })
    .returning();

  res.status(201).json(CreateServiceResponse.parse(serviceResponse(created)));
});

router.patch("/services/:serviceId", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const params = UpdateServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid service." });
    return;
  }
  const body = UpdateServiceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter a complete service with a valid duration and price." });
    return;
  }
  const validationError = validateServicePayload(body.data);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const [updated] = await db
    .update(servicesTable)
    .set({
      ...body.data,
      name: body.data.name.trim(),
      description: body.data.description.trim(),
      category: body.data.category.trim(),
      price: body.data.price.toFixed(2),
    })
    .where(eq(servicesTable.id, params.data.serviceId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Service not found." });
    return;
  }

  res.json(UpdateServiceResponse.parse(serviceResponse(updated)));
});

router.delete("/services/:serviceId", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const params = UpdateServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid service." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${params.data.serviceId})`);
    const [service] = await tx
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(eq(servicesTable.id, params.data.serviceId))
      .limit(1);
    if (!service) {
      return { status: 404 as const, error: "Service not found." };
    }

    const [appointment] = await tx
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(
        or(
          eq(appointmentsTable.serviceId, service.id),
          sql`${appointmentsTable.serviceIds} @> ARRAY[${service.id}]::integer[]`,
        ),
      )
      .limit(1);
    if (appointment) {
      return {
        status: 409 as const,
        error: "This service cannot be deleted because it has existing appointments.",
      };
    }

    await tx.delete(servicesTable).where(eq(servicesTable.id, service.id));
    const stylists = await tx.select().from(stylistsTable);
    for (const stylist of stylists.filter((entry) => entry.serviceIds.includes(service.id))) {
      await tx.update(stylistsTable)
        .set({ serviceIds: stylist.serviceIds.filter((id) => id !== service.id) })
        .where(eq(stylistsTable.id, stylist.id));
    }
    return { status: 204 as const };
  });
  if (result.status !== 204) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(204).send();
});

router.get("/stylists", async (_req, res): Promise<void> => {
  await ensureSalonSeeded();
  const rows = await db
    .select()
    .from(stylistsTable)
    .where(eq(stylistsTable.active, true))
    .orderBy(stylistsTable.id);
  res.json(
    ListStylistsResponse.parse(rows.map(stylistResponse)),
  );
});

router.post("/stylists", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const body = CreateStylistBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter complete employee details and a valid schedule." });
    return;
  }
  const validationError = validateStylistPayload(body.data);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  if (!(await validateStylistServiceIds(body.data.serviceIds ?? []))) {
    res.status(400).json({ error: "Choose valid services for this employee." });
    return;
  }

  const [created] = await db
    .insert(stylistsTable)
    .values({
      name: body.data.name.trim(),
      role: body.data.role.trim(),
      bio: (body.data.bio ?? "").trim(),
      initials: (body.data.initials ?? "").trim().toUpperCase(),
      accent: body.data.accent.trim(),
      photoUrl: storedPhotoPath(body.data.photoUrl?.trim()),
      schedule: body.data.schedule,
      serviceIds: body.data.serviceIds ?? [],
      active: true,
    })
    .returning();

  res.status(201).json(CreateStylistResponse.parse(stylistResponse(created)));
});

router.patch("/stylists/:stylistId", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const params = UpdateStylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid employee." });
    return;
  }
  const body = UpdateStylistBody.safeParse(req.body);
  if (!body.success) {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Enter complete employee details and a valid schedule." });
      return;
    }

    const [stylist] = await db
      .select({ id: stylistsTable.id })
      .from(stylistsTable)
      .where(
        and(
          eq(stylistsTable.id, params.data.stylistId),
          eq(stylistsTable.active, true),
        ),
      )
      .limit(1);
    if (!stylist) {
      res.status(404).json({ error: "Employee not found." });
      return;
    }

    const [duplicate] = await db
      .select({ id: stylistsTable.id })
      .from(stylistsTable)
      .where(and(eq(stylistsTable.name, name), ne(stylistsTable.id, stylist.id)))
      .limit(1);
    if (duplicate) {
      res.status(400).json({ error: "An employee with that name already exists." });
      return;
    }

    const [renamed] = await db
      .update(stylistsTable)
      .set({ name })
      .where(eq(stylistsTable.id, stylist.id))
      .returning();
    res.json(UpdateStylistResponse.parse(stylistResponse(renamed)));
    return;
  }
  const validationError = validateStylistPayload(body.data);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  if (!(await validateStylistServiceIds(body.data.serviceIds ?? []))) {
    res.status(400).json({ error: "Choose valid services for this employee." });
    return;
  }

  const [existing] = await db
    .select({ photoUrl: stylistsTable.photoUrl, serviceIds: stylistsTable.serviceIds })
    .from(stylistsTable)
    .where(and(eq(stylistsTable.id, params.data.stylistId), eq(stylistsTable.active, true)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const nextPhotoUrl = storedPhotoPath(body.data.photoUrl?.trim());
  const [updated] = await db
    .update(stylistsTable)
    .set({
      name: body.data.name.trim(),
      role: body.data.role.trim(),
      bio: (body.data.bio ?? "").trim(),
      initials: (body.data.initials ?? "").trim().toUpperCase(),
      accent: body.data.accent.trim(),
      photoUrl: nextPhotoUrl,
      schedule: body.data.schedule,
      serviceIds: body.data.serviceIds ?? existing.serviceIds,
    })
    .where(and(eq(stylistsTable.id, params.data.stylistId), eq(stylistsTable.active, true)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  await cleanupReplacedPhoto(params.data.stylistId, existing.photoUrl, nextPhotoUrl, req);
  res.json(UpdateStylistResponse.parse(stylistResponse(updated)));
});

router.delete("/stylists/:stylistId", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const params = DeleteStylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid employee." });
    return;
  }

  const [updated] = await db
    .update(stylistsTable)
    .set({ active: false })
    .where(and(eq(stylistsTable.id, params.data.stylistId), eq(stylistsTable.active, true)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  res.json(DeleteStylistResponse.parse(stylistResponse(updated)));
});

router.patch("/stylists/:stylistId/schedule", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) {
    return;
  }

  await ensureSalonSeeded();
  const params = UpdateStylistScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid employee." });
    return;
  }
  const body = UpdateStylistScheduleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Use valid opening and closing times for every working day." });
    return;
  }
  const validationError = validateSchedule(body.data.schedule);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const [stylist] = await db
    .select()
    .from(stylistsTable)
    .where(eq(stylistsTable.id, params.data.stylistId))
    .limit(1);
  if (!stylist) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const [updated] = await db
    .update(stylistsTable)
    .set({ schedule: body.data.schedule })
    .where(eq(stylistsTable.id, params.data.stylistId))
    .returning();
  res.json(UpdateStylistScheduleResponse.parse(stylistResponse(updated)));
});

router.get("/availability", async (req, res): Promise<void> => {
  await ensureSalonSeeded();
  const parsed = GetAvailabilityQueryParams.safeParse({
    date: toDate(req.query.date),
    stylistId: Number(req.query.stylistId),
    serviceIds: parseServiceIds(req.query.serviceIds ?? req.query.serviceId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid appointment date." });
    return;
  }
  if (process.env.NODE_ENV !== "test" && !isWithinBookingWindow(parsed.data.date)) {
    res.status(400).json({ error: "Availability can only be checked within the next five days." });
    return;
  }

  const date = String(req.query.date);
  const stylistRows = await db
    .select({ id: stylistsTable.id, name: stylistsTable.name, schedule: stylistsTable.schedule, serviceIds: stylistsTable.serviceIds })
    .from(stylistsTable)
    .where(
      and(
        eq(stylistsTable.id, parsed.data.stylistId),
        eq(stylistsTable.active, true),
      ),
    )
    .limit(1);
  const stylist = stylistRows[0];
  if (!stylist) {
    res.status(400).json({ error: "Choose a valid employee." });
    return;
  }

  const serviceRows = await db
    .select()
    .from(servicesTable)
    .where(inArray(servicesTable.id, parsed.data.serviceIds));
  if (serviceRows.length !== parsed.data.serviceIds.length) {
    res.status(400).json({ error: "Choose valid services." });
    return;
  }
  if (!isEligibleForServices(stylist, parsed.data.serviceIds)) {
    res.status(400).json({ error: "That employee does not provide all selected services." });
    return;
  }
  const durationMinutes = serviceRows.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );

  const booked = await db
    .select({
      time: appointmentsTable.time,
      durationMinutes: appointmentsTable.totalDurationMinutes,
      legacyDurationMinutes: servicesTable.durationMinutes,
    })
    .from(appointmentsTable)
    .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(
      and(
        eq(appointmentsTable.stylistId, stylist.id),
        eq(appointmentsTable.date, date),
        ne(appointmentsTable.status, "cancelled"),
        ne(appointmentsTable.status, "completed"),
      ),
    );
  const bookedAppointments: BookedAppointment[] = booked.map((appointment) => ({
    time: appointment.time,
    durationMinutes: appointment.durationMinutes ?? appointment.legacyDurationMinutes,
  }));

  const schedule = stylist.schedule ?? [];
  const weekday = parsed.data.date.getUTCDay();
  const scheduledSlots = schedule.length > 0
    ? slotsForSchedule(schedule, weekday, durationMinutes).filter(
        (slot) =>
          !bookedAppointments.some((bookedAppointment) =>
            appointmentTimesOverlap(
              slot,
              durationMinutes,
              bookedAppointment,
            ),
          ),
      )
    : [];
  const output = [{
    stylistId: stylist.id,
    date: parsed.data.date,
    slots: scheduledSlots.filter((slot) => isFutureUaeSlot(date, slot)),
  }];
  res.json(GetAvailabilityResponse.parse(output));
});

router.get("/appointments", async (req, res): Promise<void> => {
  await ensureSalonSeeded();
  const parsed = ListAppointmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const userId = getAuth(req)?.userId;
  if (!userId && !parsed.data.email) {
    res.status(400).json({ error: "Sign in or enter the email used for your booking." });
    return;
  }

  const rows = await db
    .select({
      appointment: appointmentsTable,
      stylistName: stylistsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(stylistsTable, eq(appointmentsTable.stylistId, stylistsTable.id))
    .where(
      userId
        ? eq(appointmentsTable.clerkUserId, userId)
        : eq(appointmentsTable.email, parsed.data.email!.toLowerCase()),
    )
    .orderBy(desc(appointmentsTable.date), desc(appointmentsTable.time));

  res.json(ListAppointmentsResponse.parse(await serializeAppointments(rows)));
});

router.post("/appointments", async (req, res): Promise<void> => {
  await ensureSalonSeeded();
  const body = CreateAppointmentBody.safeParse({
    ...req.body,
    serviceIds: parseServiceIds(req.body?.serviceIds ?? req.body?.serviceId),
    date: toDate(req.body?.date),
    notes: req.body?.notes ?? null,
  });
  if (!body.success) {
    const invalidField = String(body.error.issues[0]?.path[0] ?? "");
    const errorByField: Record<string, string> = {
      customerName: "Enter a name with at least two characters.",
      email: "Enter a valid email address.",
      phone: "Enter a phone number with at least seven characters.",
      serviceIds: "Choose at least one service.",
      stylistId: "Choose an employee.",
      date: "Choose a valid appointment date.",
      time: "Choose an appointment time.",
    };
    req.log?.warn(
      {
        invalidFields: [...new Set(body.error.issues.map((issue) => String(issue.path[0] ?? "unknown")))],
      },
      "Appointment rejected because booking details failed validation",
    );
    res.status(400).json({
      error: errorByField[invalidField] ?? "Check your booking details and try again.",
    });
    return;
  }
  if (process.env.NODE_ENV !== "test" && !isWithinBookingWindow(body.data.date)) {
    res.status(400).json({ error: "Appointments can only be booked within the next five days." });
    return;
  }
  const date = body.data.date.toISOString().slice(0, 10);
  if (!isFutureUaeSlot(date, body.data.time)) {
    res.status(400).json({ error: "That appointment time has already passed in the UAE." });
    return;
  }

  const clerkUserId = getAuth(req)?.userId ?? null;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${body.data.stylistId})`);
    const serviceRows = await tx
      .select()
      .from(servicesTable)
      .where(inArray(servicesTable.id, body.data.serviceIds));
    const stylist = await tx
      .select()
      .from(stylistsTable)
      .where(
        and(
          eq(stylistsTable.id, body.data.stylistId),
          eq(stylistsTable.active, true),
        ),
      )
      .limit(1);
    if (
      serviceRows.length !== body.data.serviceIds.length ||
      !stylist[0]
    ) {
      return {
        status: 400 as const,
        error: "That service or stylist is no longer available.",
      };
    }
    if (!isEligibleForServices(stylist[0], body.data.serviceIds)) {
      return {
        status: 400 as const,
        error: "That employee does not provide all selected services.",
      };
    }
    const durationMinutes = serviceRows.reduce(
      (total, service) => total + service.durationMinutes,
      0,
    );
    const totalPrice = serviceRows.reduce(
      (total, service) => total + Number(service.price),
      0,
    );

    const schedule = (stylist[0].schedule ?? []) as StylistScheduleEntry[];
    const weekday = body.data.date.getUTCDay();
    if (!slotsForSchedule(schedule, weekday, durationMinutes).includes(body.data.time)) {
      const breakConflict = schedule
        .filter((entry) => entry.dayOfWeek === weekday)
        .some((entry) =>
          (entry.breaks ?? []).some((breakTime) => {
            const start = timeToMinutes(body.data.time);
            const breakStart = scheduleTimeToMinutes(breakTime.startTime);
            const breakEnd = scheduleTimeToMinutes(breakTime.endTime);
            return start !== undefined &&
              start < breakEnd &&
              breakStart < start + durationMinutes;
          }),
        );
      if (breakConflict) {
        return {
          status: 400 as const,
          error: "That employee is on a break at the selected time.",
        };
      }
      return {
        status: 400 as const,
        error: "That employee is not scheduled for the selected time.",
      };
    }

    const existingAppointments = await tx
      .select({
        time: appointmentsTable.time,
        durationMinutes: appointmentsTable.totalDurationMinutes,
        legacyDurationMinutes: servicesTable.durationMinutes,
      })
      .from(appointmentsTable)
      .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointmentsTable.stylistId, body.data.stylistId),
          eq(appointmentsTable.date, date),
          ne(appointmentsTable.status, "cancelled"),
          ne(appointmentsTable.status, "completed"),
        ),
      );
    const bookedAppointments = existingAppointments.map((appointment) => ({
      time: appointment.time,
      durationMinutes: appointment.durationMinutes ?? appointment.legacyDurationMinutes,
    }));
    if (
      bookedAppointments.some((existingAppointment) =>
        appointmentTimesOverlap(body.data.time, durationMinutes, existingAppointment),
      )
    ) {
      req.log?.warn(
        {
          stylistId: body.data.stylistId,
          date,
          time: body.data.time,
        },
        "Appointment rejected because the selected employee has an overlapping appointment",
      );
      return {
        status: 400 as const,
        error: "That time was just booked. Please choose another slot.",
      };
    }

    const [created] = await tx
      .insert(appointmentsTable)
      .values({
        serviceId: body.data.serviceIds[0],
        serviceIds: body.data.serviceIds,
        totalDurationMinutes: durationMinutes,
        totalPrice: totalPrice.toFixed(2),
        stylistId: body.data.stylistId,
        customerName: body.data.customerName,
        email: body.data.email.toLowerCase(),
        phone: body.data.phone,
        clerkUserId,
        date,
        time: body.data.time,
        notes: body.data.notes ?? null,
        status: "confirmed",
      })
      .returning();

    return {
      status: 201 as const,
      body: CreateAppointmentResponse.parse(
        appointmentResponse(created, serviceRows, stylist[0].name),
      ),
    };
  });
  if (result.status !== 201) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result.body);
});

router.post("/appointment-groups", async (req, res): Promise<void> => {
  await ensureSalonSeeded();
  const body = CreateAppointmentGroupBody.safeParse({
    ...req.body,
    items: Array.isArray(req.body?.items)
      ? req.body.items.map((item: Record<string, unknown>) => ({
          ...item,
          serviceIds: parseServiceIds(item.serviceIds),
          date: toDate(item.date),
          notes: item.notes ?? null,
        }))
      : req.body?.items,
  });
  if (!body.success) {
    res.status(400).json({ error: "Check every group booking detail and try again." });
    return;
  }
  for (const item of body.data.items) {
    if (process.env.NODE_ENV !== "test" && !isWithinBookingWindow(item.date)) {
      res.status(400).json({ error: "Appointments can only be booked within the next five days." });
      return;
    }
    const date = item.date.toISOString().slice(0, 10);
    if (!isFutureUaeSlot(date, item.time)) {
      res.status(400).json({ error: "That appointment time has already passed in the UAE." });
      return;
    }
  }

  const groupBookingId = crypto.randomUUID();
  const clerkUserId = getAuth(req)?.userId ?? null;
  const result = await db.transaction(async (tx) => {
    const stylistIds = [...new Set(body.data.items.map((item) => item.stylistId))].sort((a, b) => a - b);
    for (const stylistId of stylistIds) {
      await tx.execute(sql`select pg_advisory_xact_lock(${stylistId})`);
    }
    const prepared: Array<{
      item: any;
      date: string;
      durationMinutes: number;
      totalPrice: number;
      stylist: typeof stylistsTable.$inferSelect;
      services: Array<typeof servicesTable.$inferSelect>;
    }> = [];
    for (const item of body.data.items) {
      const services = await tx.select().from(servicesTable).where(inArray(servicesTable.id, item.serviceIds));
      const [stylist] = await tx.select().from(stylistsTable)
        .where(and(eq(stylistsTable.id, item.stylistId), eq(stylistsTable.active, true))).limit(1);
      if (!stylist || services.length !== item.serviceIds.length || !isEligibleForServices(stylist, item.serviceIds)) {
        return { error: "That service or employee is no longer available." };
      }
      const durationMinutes = services.reduce((total, service) => total + service.durationMinutes, 0);
      const date = item.date.toISOString().slice(0, 10);
      if (!slotsForSchedule(stylist.schedule ?? [], item.date.getUTCDay(), durationMinutes).includes(item.time)) {
        return { error: "That employee is not scheduled for the selected time." };
      }
      const existing = await tx.select({
        time: appointmentsTable.time, durationMinutes: appointmentsTable.totalDurationMinutes,
        legacyDurationMinutes: servicesTable.durationMinutes,
      }).from(appointmentsTable).innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
        .where(and(eq(appointmentsTable.stylistId, item.stylistId), eq(appointmentsTable.date, date),
          ne(appointmentsTable.status, "cancelled"), ne(appointmentsTable.status, "completed")));
      if (existing.some((appointment) => appointmentTimesOverlap(item.time, durationMinutes, {
        time: appointment.time, durationMinutes: appointment.durationMinutes ?? appointment.legacyDurationMinutes,
      })) || prepared.some((other) => other.item.stylistId === item.stylistId && other.date === date &&
        appointmentTimesOverlap(item.time, durationMinutes, { time: other.item.time, durationMinutes: other.durationMinutes }))) {
        return { error: "A group appointment overlaps an existing or another group appointment." };
      }
      prepared.push({ item, date, durationMinutes, totalPrice: services.reduce((total, service) => total + Number(service.price), 0), stylist, services });
    }
    const created = [];
    for (const [index, entry] of prepared.entries()) {
      const [appointment] = await tx.insert(appointmentsTable).values({
        serviceId: entry.item.serviceIds[0], serviceIds: entry.item.serviceIds,
        totalDurationMinutes: entry.durationMinutes, totalPrice: entry.totalPrice.toFixed(2),
        stylistId: entry.item.stylistId, customerName: body.data.customerName.trim(),
        email: body.data.email.toLowerCase(), phone: body.data.phone.trim(), clerkUserId,
        date: entry.date, time: entry.item.time, notes: entry.item.notes ?? null, status: "confirmed",
        groupBookingId, groupPosition: index + 1, groupSize: prepared.length,
      }).returning();
      created.push(appointmentResponse(appointment, entry.services, entry.stylist.name));
    }
    return { groupBookingId, appointments: created };
  });
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateAppointmentGroupResponse.parse(result));
});

router.patch("/appointments/:appointmentId", async (req, res): Promise<void> => {
  const userId = await requireCustomerAccount(req, res);
  if (!userId) return;

  await ensureSalonSeeded();
  const params = UpdateAppointmentParams.safeParse(req.params);
  const body = UpdateAppointmentBody.safeParse({
    ...req.body,
    date: toDate(req.body?.date),
  });
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Choose a valid date and time." });
    return;
  }
  if (!isWithinBookingWindow(body.data.date)) {
    res.status(400).json({ error: "Appointments can only be moved within the next five days." });
    return;
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        appointment: appointmentsTable,
        stylistName: stylistsTable.name,
      })
      .from(appointmentsTable)
      .innerJoin(stylistsTable, eq(appointmentsTable.stylistId, stylistsTable.id))
      .where(eq(appointmentsTable.id, params.data.appointmentId))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }
    if (current.appointment.clerkUserId !== userId) {
      res.status(403).json({ error: "You can only change appointments in your account." });
      return;
    }
    if (current.appointment.status === "cancelled") {
      res.status(400).json({ error: "Cancelled appointments cannot be rescheduled." });
      return;
    }

    await tx.execute(sql`select pg_advisory_xact_lock(${current.appointment.stylistId})`);
    const serviceIds =
      current.appointment.serviceIds.length > 0
        ? current.appointment.serviceIds
        : [current.appointment.serviceId];
    const serviceRows = await tx
      .select()
      .from(servicesTable)
      .where(inArray(servicesTable.id, serviceIds));
    const durationMinutes = serviceRows.reduce(
      (total, service) => total + service.durationMinutes,
      0,
    );
    if (serviceRows.length !== serviceIds.length || durationMinutes < 1) {
      res.status(400).json({ error: "The services on this appointment are no longer available." });
      return;
    }
    const [rescheduleStylist] = await tx
      .select({ serviceIds: stylistsTable.serviceIds })
      .from(stylistsTable)
      .where(and(eq(stylistsTable.id, current.appointment.stylistId), eq(stylistsTable.active, true)))
      .limit(1);
    if (!rescheduleStylist || !isEligibleForServices(rescheduleStylist, serviceIds)) {
      res.status(400).json({ error: "That employee no longer provides all services on this appointment." });
      return;
    }

    const schedule = (current.appointment.stylistId
      ? (await tx
          .select({ schedule: stylistsTable.schedule })
          .from(stylistsTable)
          .where(eq(stylistsTable.id, current.appointment.stylistId))
          .limit(1))[0]?.schedule
      : []) as StylistScheduleEntry[];
    const weekday = body.data.date.getUTCDay();
    if (!slotsForSchedule(schedule, weekday, durationMinutes).includes(body.data.time)) {
      res.status(400).json({ error: "That employee is not scheduled for the selected time." });
      return;
    }

    const date = body.data.date.toISOString().slice(0, 10);
    if (!isFutureUaeSlot(date, body.data.time)) {
      res.status(400).json({ error: "That appointment time has already passed in the UAE." });
      return;
    }
    const existingAppointments = await tx
      .select({
        id: appointmentsTable.id,
        time: appointmentsTable.time,
        durationMinutes: appointmentsTable.totalDurationMinutes,
        legacyDurationMinutes: servicesTable.durationMinutes,
      })
      .from(appointmentsTable)
      .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointmentsTable.stylistId, current.appointment.stylistId),
          eq(appointmentsTable.date, date),
          ne(appointmentsTable.id, current.appointment.id),
          ne(appointmentsTable.status, "cancelled"),
          ne(appointmentsTable.status, "completed"),
        ),
      );
    if (
      existingAppointments.some((existingAppointment) =>
        appointmentTimesOverlap(body.data.time, durationMinutes, {
          time: existingAppointment.time,
          durationMinutes:
            existingAppointment.durationMinutes ?? existingAppointment.legacyDurationMinutes,
        }),
      )
    ) {
      res.status(400).json({ error: "That time is no longer available. Please choose another slot." });
      return;
    }

    const [updated] = await tx
      .update(appointmentsTable)
      .set({ date, time: body.data.time })
      .where(eq(appointmentsTable.id, current.appointment.id))
      .returning();
    res.json(
      UpdateAppointmentResponse.parse(
        appointmentResponse(updated, serviceRows, current.stylistName),
      ),
    );
  });
});

router.delete("/appointments/:appointmentId", async (req, res): Promise<void> => {
  const userId = await requireCustomerAccount(req, res);
  if (!userId) return;

  await ensureSalonSeeded();
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid appointment." });
    return;
  }

  const [current] = await db
    .select({
      appointment: appointmentsTable,
      stylistName: stylistsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(stylistsTable, eq(appointmentsTable.stylistId, stylistsTable.id))
    .where(eq(appointmentsTable.id, params.data.appointmentId))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }
  if (current.appointment.clerkUserId !== userId) {
    res.status(403).json({ error: "You can only cancel appointments in your account." });
    return;
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(eq(appointmentsTable.id, current.appointment.id))
    .returning();
  const serviceIds =
    current.appointment.serviceIds.length > 0
      ? current.appointment.serviceIds
      : [current.appointment.serviceId];
  const serviceRows = await db
    .select()
    .from(servicesTable)
    .where(inArray(servicesTable.id, serviceIds));
  res.json(
    UpdateAppointmentResponse.parse(
      appointmentResponse(updated, serviceRows, current.stylistName),
    ),
  );
});

router.get("/manager/appointments", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) return;
  await ensureSalonSeeded();
  const rows = await db
    .select({
      appointment: appointmentsTable,
      stylistName: stylistsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(stylistsTable, eq(appointmentsTable.stylistId, stylistsTable.id))
    .orderBy(desc(appointmentsTable.date), desc(appointmentsTable.time));
  res.json(ListManagerAppointmentsResponse.parse(await serializeAppointments(rows)));
});

router.patch("/manager/appointments/:appointmentId", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) return;
  await ensureSalonSeeded();

  const params = UpdateManagerAppointmentParams.safeParse(req.params);
  const body = UpdateManagerAppointmentBody.safeParse({
    ...req.body,
    serviceIds: req.body?.serviceIds === undefined
      ? undefined
      : parseServiceIds(req.body.serviceIds),
    date: req.body?.date === undefined ? undefined : toDate(req.body.date),
    notes: req.body?.notes === undefined ? undefined : req.body.notes,
  });
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Check the appointment changes and try again." });
    return;
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ appointment: appointmentsTable })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, params.data.appointmentId))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Appointment not found." });
      return;
    }

    const nextStatus = body.data.status ?? current.appointment.status;
    const nextStylistId = body.data.stylistId ?? current.appointment.stylistId;
    const nextServiceIds = body.data.serviceIds ??
      (current.appointment.serviceIds.length > 0
        ? current.appointment.serviceIds
        : [current.appointment.serviceId]);
    const nextDateValue = body.data.date ?? toDate(current.appointment.date);
    const nextTime = body.data.time ?? current.appointment.time;

    if (!nextDateValue) {
      res.status(400).json({ error: "Choose a valid appointment date." });
      return;
    }

    await tx.execute(sql`select pg_advisory_xact_lock(${nextStylistId})`);
    const serviceRows = await tx
      .select()
      .from(servicesTable)
      .where(inArray(servicesTable.id, nextServiceIds));
    const [stylist] = await tx
      .select()
      .from(stylistsTable)
      .where(and(eq(stylistsTable.id, nextStylistId), eq(stylistsTable.active, true)))
      .limit(1);
    if (serviceRows.length !== nextServiceIds.length || !stylist) {
      res.status(400).json({ error: "Choose active services and an active employee." });
      return;
    }
    if (!isEligibleForServices(stylist, nextServiceIds)) {
      res.status(400).json({ error: "That employee does not provide all selected services." });
      return;
    }

    const durationMinutes = serviceRows.reduce(
      (total, service) => total + service.durationMinutes,
      0,
    );
    const totalPrice = serviceRows.reduce(
      (total, service) => total + Number(service.price),
      0,
    );
    const date = nextDateValue.toISOString().slice(0, 10);

    if (nextStatus !== "cancelled" && nextStatus !== "completed") {
      if (process.env.NODE_ENV !== "test" && !isWithinBookingWindow(nextDateValue)) {
        res.status(400).json({ error: "Active appointments must stay within the next five days." });
        return;
      }
      const schedule = (stylist.schedule ?? []) as StylistScheduleEntry[];
      const weekday = nextDateValue.getUTCDay();
      if (!slotsForSchedule(schedule, weekday, durationMinutes).includes(nextTime)) {
        res.status(400).json({ error: "That employee is not scheduled for the selected time." });
        return;
      }

      const existingAppointments = await tx
        .select({
          id: appointmentsTable.id,
          time: appointmentsTable.time,
          durationMinutes: appointmentsTable.totalDurationMinutes,
          legacyDurationMinutes: servicesTable.durationMinutes,
        })
        .from(appointmentsTable)
        .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
        .where(
          and(
            eq(appointmentsTable.stylistId, nextStylistId),
            eq(appointmentsTable.date, date),
            ne(appointmentsTable.id, current.appointment.id),
            ne(appointmentsTable.status, "cancelled"),
            ne(appointmentsTable.status, "completed"),
          ),
        );
      if (
        existingAppointments.some((appointment) =>
          appointmentTimesOverlap(nextTime, durationMinutes, {
            time: appointment.time,
            durationMinutes: appointment.durationMinutes ?? appointment.legacyDurationMinutes,
          }),
        )
      ) {
        res.status(400).json({ error: "That employee already has an overlapping appointment." });
        return;
      }
    }

    const [updated] = await tx
      .update(appointmentsTable)
      .set({
        serviceId: nextServiceIds[0],
        serviceIds: nextServiceIds,
        totalDurationMinutes: durationMinutes,
        totalPrice: totalPrice.toFixed(2),
        stylistId: nextStylistId,
        customerName: body.data.customerName?.trim() ?? current.appointment.customerName,
        email: body.data.email?.trim().toLowerCase() ?? current.appointment.email,
        phone: body.data.phone?.trim() ?? current.appointment.phone,
        date,
        time: nextTime,
        notes: body.data.notes === undefined ? current.appointment.notes : body.data.notes,
        status: nextStatus,
      })
      .where(eq(appointmentsTable.id, current.appointment.id))
      .returning();

    res.json(
      UpdateManagerAppointmentResponse.parse(
        appointmentResponse(updated, serviceRows, stylist.name),
      ),
    );
  });
});

router.get("/manager/customers", async (req, res): Promise<void> => {
  if (!(await requireSalonManager(req, res))) return;
  await ensureSalonSeeded();
  const rows = await db
    .select({
      email: appointmentsTable.email,
      customerName: appointmentsTable.customerName,
      phone: appointmentsTable.phone,
      date: appointmentsTable.date,
      status: appointmentsTable.status,
    })
    .from(appointmentsTable)
    .orderBy(desc(appointmentsTable.date));
  const today = new Date().toISOString().slice(0, 10);
  const customers = new Map<
    string,
    {
      email: string;
      customerName: string;
      phone: string;
      appointmentCount: number;
      upcomingAppointmentCount: number;
      lastVisit: string | null;
    }
  >();
  for (const row of rows) {
    if (row.status === "cancelled" || row.status === "completed") continue;
    const key = row.email.toLowerCase();
    const customer = customers.get(key) ?? {
      email: row.email,
      customerName: row.customerName,
      phone: row.phone,
      appointmentCount: 0,
      upcomingAppointmentCount: 0,
      lastVisit: null,
    };
    customer.appointmentCount += 1;
    if (row.date >= today) customer.upcomingAppointmentCount += 1;
    if (!customer.lastVisit || row.date > customer.lastVisit) customer.lastVisit = row.date;
    customers.set(key, customer);
  }
  res.json(ListManagerCustomersResponse.parse(
    [...customers.values()].sort((left, right) => right.appointmentCount - left.appointmentCount),
  ));
});

router.get("/salon-summary", (_req, res): void => {
  res.json(
    GetSalonSummaryResponse.parse({
      rating: 4.8,
      reviewCount: 212,
      nextAvailable: "Today at 4:00 PM",
      neighborhood: "My City Centre Masdar",
      hours: "Mon–Thu 11–10 · Fri–Sat 11–10:30",
    }),
  );
});

export default router;