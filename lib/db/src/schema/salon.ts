import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const servicesTable = pgTable("salon_services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  featured: boolean("featured").notNull().default(false),
});

export const stylistsTable = pgTable("salon_stylists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  bio: text("bio").notNull(),
  initials: text("initials").notNull(),
  accent: text("accent").notNull(),
  schedule: jsonb("schedule")
    .$type<
      Array<{
        dayOfWeek: number;
        openTime: string;
        closeTime: string;
        breaks?: Array<{ startTime: string; endTime: string }>;
      }>
    >()
    .notNull()
    .default([]),
  active: boolean("active").notNull().default(true),
});

export const appointmentsTable = pgTable("salon_appointments", {
  id: serial("id").primaryKey(),
  // serviceId remains as the first service for backwards compatibility with
  // existing records and integrations. serviceIds is the canonical bundle.
  serviceId: integer("service_id").notNull(),
  serviceIds: integer("service_ids").array().notNull().default(sql`ARRAY[]::integer[]`),
  totalDurationMinutes: integer("total_duration_minutes"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }),
  stylistId: integer("stylist_id").notNull(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
});
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;

export const insertStylistSchema = createInsertSchema(stylistsTable).omit({
  id: true,
});
export type InsertStylist = z.infer<typeof insertStylistSchema>;
export type Stylist = typeof stylistsTable.$inferSelect;

export const insertAppointmentSchema = createInsertSchema(
  appointmentsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;