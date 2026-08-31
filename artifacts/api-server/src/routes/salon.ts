import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { clerkClient, getAuth } from "@clerk/express";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateAppointmentBody,
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
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  ListServicesResponse,
  ListStylistsResponse,
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

const router: IRouter = Router();
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
    for (let start = open; start + durationMinutes <= close; start += 90) {
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

async function requireSalonManager(req: AuthenticatedRequest, res: Response): Promise<boolean> {
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

function appointmentResponse(
  row: typeof appointmentsTable.$inferSelect,
  serviceRows: Array<typeof servicesTable.$inferSelect>,
  stylistName: string,
) {
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
    ...row,
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
    schedule: row.schedule ?? [],
  };
}

function validateStylistPayload(payload: {
  name: string;
  role: string;
  bio: string;
  initials: string;
  accent: string;
  schedule: StylistScheduleEntry[];
}): string | undefined {
  if (
    !payload.name.trim() ||
    !payload.role.trim() ||
    !payload.bio.trim() ||
    !payload.initials.trim() ||
    !payload.accent.trim()
  ) {
    return "Name, job title, description, initials, and accent are required.";
  }
  if (payload.initials.trim().length > 5) {
    return "Initials must be five characters or fewer.";
  }
  return validateSchedule(payload.schedule);
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

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${params.data.serviceId})`);
    const [service] = await tx
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(eq(servicesTable.id, params.data.serviceId))
      .limit(1);
    if (!service) {
      res.status(404).json({ error: "Service not found." });
      return;
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
      res.status(409).json({ error: "This service cannot be deleted because it has existing appointments." });
      return;
    }

    await tx.delete(servicesTable).where(eq(servicesTable.id, service.id));
    res.status(204).send();
  });
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
  if (!requireSalonManager(req, res)) {
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

  const [created] = await db
    .insert(stylistsTable)
    .values({
      name: body.data.name.trim(),
      role: body.data.role.trim(),
      bio: body.data.bio.trim(),
      initials: body.data.initials.trim().toUpperCase(),
      accent: body.data.accent.trim(),
      schedule: body.data.schedule,
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

  const [updated] = await db
    .update(stylistsTable)
    .set({
      name: body.data.name.trim(),
      role: body.data.role.trim(),
      bio: body.data.bio.trim(),
      initials: body.data.initials.trim().toUpperCase(),
      accent: body.data.accent.trim(),
      schedule: body.data.schedule,
    })
    .where(and(eq(stylistsTable.id, params.data.stylistId), eq(stylistsTable.active, true)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  res.json(UpdateStylistResponse.parse(stylistResponse(updated)));
});

router.delete("/stylists/:stylistId", async (req, res): Promise<void> => {
  if (!requireSalonManager(req, res)) {
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

  const date = String(req.query.date);
  const stylistRows = await db
    .select({ id: stylistsTable.id, name: stylistsTable.name, schedule: stylistsTable.schedule })
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
  const durationMinutes = serviceRows.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );

  const booked = await db
    .select({
      stylistId: appointmentsTable.stylistId,
      time: appointmentsTable.time,
      durationMinutes: appointmentsTable.totalDurationMinutes,
      legacyDurationMinutes: servicesTable.durationMinutes,
    })
    .from(appointmentsTable)
    .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(eq(appointmentsTable.date, date));
  const bookedByStylist = new Map<number, BookedAppointment[]>();
  for (const appointment of booked) {
    const appointments = bookedByStylist.get(appointment.stylistId) ?? [];
    appointments.push({
      time: appointment.time,
      durationMinutes: appointment.durationMinutes ?? appointment.legacyDurationMinutes,
    });
    bookedByStylist.set(appointment.stylistId, appointments);
  }

  const schedule = stylist.schedule ?? [];
  const weekday = parsed.data.date.getUTCDay();
  const output = [{
    stylistId: stylist.id,
    date: parsed.data.date,
    slots: schedule.length > 0
      ? slotsForSchedule(schedule, weekday, durationMinutes).filter(
          (slot) =>
            !bookedByStylist
              .get(stylist.id)
              ?.some((bookedAppointment) =>
                appointmentTimesOverlap(
                  slot,
                  durationMinutes,
                  bookedAppointment,
                ),
              ),
        )
      : [],
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

  const rows = await db
    .select({
      appointment: appointmentsTable,
      stylistName: stylistsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(stylistsTable, eq(appointmentsTable.stylistId, stylistsTable.id))
    .where(eq(appointmentsTable.email, parsed.data.email.toLowerCase()))
    .orderBy(desc(appointmentsTable.date), desc(appointmentsTable.time));

  res.json(
    ListAppointmentsResponse.parse(
      await Promise.all(
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
      ),
    ),
  );
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
    res.status(400).json({ error: "Check your booking details and try again." });
    return;
  }

  await db.transaction(async (tx) => {
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
      res.status(400).json({ error: "That service or stylist is no longer available." });
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
        res.status(400).json({ error: "That employee is on a break at the selected time." });
        return;
      }
      res.status(400).json({ error: "That employee is not scheduled for the selected time." });
      return;
    }

    const date = body.data.date.toISOString().slice(0, 10);
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
      res.status(400).json({ error: "That time was just booked. Please choose another slot." });
      return;
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
        date,
        time: body.data.time,
        notes: body.data.notes ?? null,
        status: "confirmed",
      })
      .returning();

    res.status(201).json(
      CreateAppointmentResponse.parse(
        appointmentResponse(created, serviceRows, stylist[0].name),
      ),
    );
  });
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