import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
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
});

export const appointmentsTable = pgTable("salon_appointments", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
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