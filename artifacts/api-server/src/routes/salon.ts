import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreateServiceBody,
  CreateServiceResponse,
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
  getStylistSchedule,
  setStylistSchedule,
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
      slots.add(formatSlotTime(start));
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

function isSalonManager(req: Request): boolean {
  return req.header("x-salon-manager") === "true";
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
  serviceName: string,
  stylistName: string,
) {
  return {
    ...row,
    serviceName,
    stylistName,
    date: new Date(`${row.date}T00:00:00.000Z`),
  };
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
  if (!isSalonManager(req)) {
    res.status(403).json({ error: "Manager access is required to update services." });
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
  if (!isSalonManager(req)) {
    res.status(403).json({ error: "Manager access is required to update services." });
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

router.get("/stylists", async (_req, res): Promise<void> => {
  await ensureSalonSeeded();
  const rows = await db.select().from(stylistsTable).orderBy(stylistsTable.id);
  res.json(
    ListStylistsResponse.parse(
      rows.map((row) => ({ ...row, schedule: getStylistSchedule(row.name) })),
    ),
  );
});

router.patch("/stylists/:stylistId/schedule", async (req, res): Promise<void> => {
  if (!isSalonManager(req)) {
    res.status(403).json({ error: "Manager access is required to update employee schedules." });
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

  const schedule = setStylistSchedule(stylist.name, body.data.schedule);
  res.json(UpdateStylistScheduleResponse.parse({ ...stylist, schedule }));
});

router.get("/availability", async (req, res): Promise<void> => {
  await ensureSalonSeeded();
  const parsed = GetAvailabilityQueryParams.safeParse({
    date: toDate(req.query.date),
    stylistId: Number(req.query.stylistId),
    serviceId: Number(req.query.serviceId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid appointment date." });
    return;
  }

  const date = String(req.query.date);
  const stylistRows = await db
    .select({ id: stylistsTable.id, name: stylistsTable.name })
    .from(stylistsTable)
    .where(eq(stylistsTable.id, parsed.data.stylistId))
    .limit(1);
  const stylist = stylistRows[0];
  if (!stylist) {
    res.status(400).json({ error: "Choose a valid employee." });
    return;
  }

  const serviceRows = await db
    .select({ durationMinutes: servicesTable.durationMinutes })
    .from(servicesTable)
    .where(eq(servicesTable.id, parsed.data.serviceId))
    .limit(1);
  const service = serviceRows[0];
  if (!service) {
    res.status(400).json({ error: "Choose a valid service." });
    return;
  }

  const booked = await db
    .select({
      stylistId: appointmentsTable.stylistId,
      time: appointmentsTable.time,
      durationMinutes: servicesTable.durationMinutes,
    })
    .from(appointmentsTable)
    .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(eq(appointmentsTable.date, date));
  const bookedByStylist = new Map<number, BookedAppointment[]>();
  for (const appointment of booked) {
    const appointments = bookedByStylist.get(appointment.stylistId) ?? [];
    appointments.push({
      time: appointment.time,
      durationMinutes: appointment.durationMinutes,
    });
    bookedByStylist.set(appointment.stylistId, appointments);
  }

  const schedule = getStylistSchedule(stylist.name);
  const weekday = parsed.data.date.getUTCDay();
  const output = [{
    stylistId: stylist.id,
    date: parsed.data.date,
    slots: schedule.length > 0
      ? slotsForSchedule(schedule, weekday, service.durationMinutes).filter(
          (slot) =>
            !bookedByStylist
              .get(stylist.id)
              ?.some((bookedAppointment) =>
                appointmentTimesOverlap(
                  slot,
                  service.durationMinutes,
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
      serviceName: servicesTable.name,
      stylistName: stylistsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .innerJoin(stylistsTable, eq(appointmentsTable.stylistId, stylistsTable.id))
    .where(eq(appointmentsTable.email, parsed.data.email.toLowerCase()))
    .orderBy(desc(appointmentsTable.date), desc(appointmentsTable.time));

  res.json(
    ListAppointmentsResponse.parse(
      rows.map(({ appointment, serviceName, stylistName }) =>
        appointmentResponse(appointment, serviceName, stylistName),
      ),
    ),
  );
});

router.post("/appointments", async (req, res): Promise<void> => {
  await ensureSalonSeeded();
  const body = CreateAppointmentBody.safeParse({
    ...req.body,
    date: toDate(req.body?.date),
    notes: req.body?.notes ?? null,
  });
  if (!body.success) {
    res.status(400).json({ error: "Check your booking details and try again." });
    return;
  }

  const service = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, body.data.serviceId))
    .limit(1);
  const stylist = await db
    .select()
    .from(stylistsTable)
    .where(eq(stylistsTable.id, body.data.stylistId))
    .limit(1);
  if (!service[0] || !stylist[0]) {
    res.status(400).json({ error: "That service or stylist is no longer available." });
    return;
  }

  const schedule = getStylistSchedule(stylist[0].name);
  const weekday = body.data.date.getUTCDay();
  if (!slotsForSchedule(schedule, weekday, service[0].durationMinutes).includes(body.data.time)) {
    res.status(400).json({ error: "That employee is not scheduled for the selected time." });
    return;
  }

  const date = body.data.date.toISOString().slice(0, 10);
  const existingAppointments = await db
    .select({
      time: appointmentsTable.time,
      durationMinutes: servicesTable.durationMinutes,
    })
    .from(appointmentsTable)
    .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .where(
      and(
        eq(appointmentsTable.stylistId, body.data.stylistId),
        eq(appointmentsTable.date, date),
      ),
    );
  if (
    existingAppointments.some((existingAppointment) =>
      appointmentTimesOverlap(
        body.data.time,
        service[0].durationMinutes,
        existingAppointment,
      ),
    )
  ) {
    res.status(400).json({ error: "That time was just booked. Please choose another slot." });
    return;
  }

  const [created] = await db
    .insert(appointmentsTable)
    .values({
      serviceId: body.data.serviceId,
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
      appointmentResponse(created, service[0].name, stylist[0].name),
    ),
  );
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