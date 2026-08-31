import { db, servicesTable, stylistsTable } from "@workspace/db";

const seedServices = [
  {
    name: "Signature Cut",
    description: "A tailored cut, hot towel finish, and styling session.",
    durationMinutes: 45,
    price: "120",
    category: "Hair",
    featured: true,
  },
  {
    name: "Texture & Finish",
    description: "Shape, texture, and a polished finish for your signature look.",
    durationMinutes: 60,
    price: "165",
    category: "Hair",
    featured: true,
  },
  {
    name: "Beard Ritual",
    description: "Precision shaping, warm towel, and conditioning treatment.",
    durationMinutes: 30,
    price: "80",
    category: "Beard",
    featured: true,
  },
  {
    name: "The CT Style",
    description: "The full experience: cut, beard ritual, and finishing detail.",
    durationMinutes: 90,
    price: "220",
    category: "Signature",
    featured: false,
  },
];

const seedStylists = [
  {
    name: "Marco",
    role: "Senior Barber",
    bio: "Known for clean lines, modern texture, and a calm chair-side ritual.",
    initials: "MC",
    accent: "copper",
  },
  {
    name: "Aisha",
    role: "Style Director",
    bio: "Creates effortless shape with a soft spot for expressive finishes.",
    initials: "AK",
    accent: "olive",
  },
  {
    name: "Daniel",
    role: "Master Barber",
    bio: "A detail obsessive who makes classic grooming feel distinctly yours.",
    initials: "DS",
    accent: "ink",
  },
];

export type StylistScheduleEntry = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
};

const defaultStylistSchedules: Record<string, StylistScheduleEntry[]> = {
  Marco: [
    { dayOfWeek: 1, openTime: "10:00", closeTime: "20:30" },
    { dayOfWeek: 2, openTime: "10:00", closeTime: "20:30" },
    { dayOfWeek: 3, openTime: "10:00", closeTime: "20:30" },
    { dayOfWeek: 4, openTime: "10:00", closeTime: "20:30" },
    { dayOfWeek: 5, openTime: "10:00", closeTime: "20:30" },
    { dayOfWeek: 6, openTime: "10:00", closeTime: "20:30" },
  ],
  Aisha: [
    { dayOfWeek: 0, openTime: "11:00", closeTime: "21:30" },
    { dayOfWeek: 1, openTime: "11:00", closeTime: "21:30" },
    { dayOfWeek: 2, openTime: "11:00", closeTime: "21:30" },
    { dayOfWeek: 3, openTime: "11:00", closeTime: "21:30" },
    { dayOfWeek: 5, openTime: "11:00", closeTime: "21:30" },
    { dayOfWeek: 6, openTime: "11:00", closeTime: "21:30" },
  ],
  Daniel: [
    { dayOfWeek: 1, openTime: "09:30", closeTime: "20:00" },
    { dayOfWeek: 2, openTime: "09:30", closeTime: "20:00" },
    { dayOfWeek: 3, openTime: "09:30", closeTime: "20:00" },
    { dayOfWeek: 4, openTime: "09:30", closeTime: "20:00" },
    { dayOfWeek: 5, openTime: "09:30", closeTime: "20:00" },
  ],
};

const stylistSchedules = new Map(
  Object.entries(defaultStylistSchedules).map(([name, schedule]) => [
    name,
    schedule.map((entry) => ({ ...entry })),
  ]),
);

export function getStylistSchedule(name: string): StylistScheduleEntry[] {
  return (stylistSchedules.get(name) ?? []).map((entry) => ({ ...entry }));
}

export function setStylistSchedule(
  name: string,
  schedule: StylistScheduleEntry[],
): StylistScheduleEntry[] {
  const savedSchedule = schedule.map((entry) => ({ ...entry }));
  stylistSchedules.set(name, savedSchedule);
  return savedSchedule.map((entry) => ({ ...entry }));
}

export function renameStylistSchedule(
  previousName: string,
  nextName: string,
): StylistScheduleEntry[] {
  const schedule = stylistSchedules.get(previousName) ?? [];
  stylistSchedules.delete(previousName);
  stylistSchedules.set(nextName, schedule);
  return schedule.map((entry) => ({ ...entry }));
}

export async function ensureSalonSeeded(): Promise<void> {
  const [service] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .limit(1);
  if (!service) {
    await db.insert(servicesTable).values(seedServices);
  }

  const [stylist] = await db
    .select({ id: stylistsTable.id })
    .from(stylistsTable)
    .limit(1);
  if (!stylist) {
    await db.insert(stylistsTable).values(seedStylists);
  }
}