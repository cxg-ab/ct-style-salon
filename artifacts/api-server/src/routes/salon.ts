import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  GetAvailabilityQueryParams,
  GetAvailabilityResponse,
  GetSalonSummaryResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  ListServicesResponse,
  ListStylistsResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  db,
  servicesTable,
  stylistsTable,
} from "@workspace/db";
import { ensureSalonSeeded } from "../lib/salon-seed";

const router: IRouter = Router();
const stylistSchedules: Record<string, { workingDays: number[]; slots: string[] }> = {
  Marco: {
    workingDays: [1, 2, 3, 4, 5, 6],
    slots: ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM", "5:30 PM", "7:00 PM"],
  },
  Aisha: {
    workingDays: [0, 1, 2, 3, 5, 6],
    slots: ["11:00 AM", "12:30 PM", "2:00 PM", "3:30 PM", "5:00 PM", "6:30 PM", "8:00 PM"],
  },
  Daniel: {
    workingDays: [1, 2, 3, 4, 5],
    slots: ["9:30 AM", "11:00 AM", "12:30 PM", "2:00 PM", "3:30 PM", "5:00 PM", "6:30 PM"],
  },
};

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

router.get("/stylists", async (_req, res): Promise<void> => {
  await ensureSalonSeeded();
  const rows = await db.select().from(stylistsTable).orderBy(stylistsTable.id);
  res.json(ListStylistsResponse.parse(rows));
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

  const schedule = stylistSchedules[stylist.name];
  const weekday = parsed.data.date.getUTCDay();
  const output = [{
    stylistId: stylist.id,
    date: parsed.data.date,
    slots: schedule?.workingDays.includes(weekday)
      ? schedule.slots.filter(
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

  const schedule = stylistSchedules[stylist[0].name];
  const weekday = body.data.date.getUTCDay();
  if (!schedule?.workingDays.includes(weekday) || !schedule.slots.includes(body.data.time)) {
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