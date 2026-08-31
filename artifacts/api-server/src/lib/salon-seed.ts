import { eq } from "drizzle-orm";
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
    schedule: [
      { dayOfWeek: 1, openTime: "10:00", closeTime: "20:30" },
      { dayOfWeek: 2, openTime: "10:00", closeTime: "20:30" },
      { dayOfWeek: 3, openTime: "10:00", closeTime: "20:30" },
      { dayOfWeek: 4, openTime: "10:00", closeTime: "20:30" },
      { dayOfWeek: 5, openTime: "10:00", closeTime: "20:30" },
      { dayOfWeek: 6, openTime: "10:00", closeTime: "20:30" },
    ],
    active: true,
  },
  {
    name: "Aisha",
    role: "Style Director",
    bio: "Creates effortless shape with a soft spot for expressive finishes.",
    initials: "AK",
    accent: "olive",
    schedule: [
      { dayOfWeek: 0, openTime: "11:00", closeTime: "21:30" },
      { dayOfWeek: 1, openTime: "11:00", closeTime: "21:30" },
      { dayOfWeek: 2, openTime: "11:00", closeTime: "21:30" },
      { dayOfWeek: 3, openTime: "11:00", closeTime: "21:30" },
      { dayOfWeek: 5, openTime: "11:00", closeTime: "21:30" },
      { dayOfWeek: 6, openTime: "11:00", closeTime: "21:30" },
    ],
    active: true,
  },
  {
    name: "Daniel",
    role: "Master Barber",
    bio: "A detail obsessive who makes classic grooming feel distinctly yours.",
    initials: "DS",
    accent: "ink",
    schedule: [
      { dayOfWeek: 1, openTime: "09:30", closeTime: "20:00" },
      { dayOfWeek: 2, openTime: "09:30", closeTime: "20:00" },
      { dayOfWeek: 3, openTime: "09:30", closeTime: "20:00" },
      { dayOfWeek: 4, openTime: "09:30", closeTime: "20:00" },
      { dayOfWeek: 5, openTime: "09:30", closeTime: "20:00" },
    ],
    active: true,
  },
];

export type StylistScheduleEntry = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  breaks?: StylistBreak[];
};

export type StylistBreak = {
  startTime: string;
  endTime: string;
};

function copySchedule(schedule: StylistScheduleEntry[]): StylistScheduleEntry[] {
  return schedule.map((entry) => ({
    ...entry,
    breaks: (entry.breaks ?? []).map((breakTime) => ({ ...breakTime })),
  }));
}

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
    copySchedule(schedule),
  ]),
);

export function getStylistSchedule(name: string): StylistScheduleEntry[] {
  return copySchedule(stylistSchedules.get(name) ?? []);
}

export function setStylistSchedule(
  name: string,
  schedule: StylistScheduleEntry[],
): StylistScheduleEntry[] {
  const savedSchedule = copySchedule(schedule);
  stylistSchedules.set(name, savedSchedule);
  return copySchedule(savedSchedule);
}

export function renameStylistSchedule(
  previousName: string,
  nextName: string,
): StylistScheduleEntry[] {
  const schedule = stylistSchedules.get(previousName) ?? [];
  stylistSchedules.delete(previousName);
  stylistSchedules.set(nextName, schedule);
  return copySchedule(schedule);
}

export async function ensureSalonSeeded(): Promise<void> {
  const [service] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .limit(1);
  if (!service) {
    await db.insert(servicesTable).values(seedServices);
  }

  const existingStylists = await db
    .select({ id: stylistsTable.id, name: stylistsTable.name, schedule: stylistsTable.schedule })
    .from(stylistsTable)
    .orderBy(stylistsTable.id);
  if (existingStylists.length === 0) {
    await db.insert(stylistsTable).values(seedStylists);
    return;
  }

  for (const stylist of existingStylists) {
    const defaultSchedule = defaultStylistSchedules[stylist.name];
    if (defaultSchedule && stylist.schedule.length === 0) {
      await db
        .update(stylistsTable)
        .set({ schedule: defaultSchedule })
        .where(eq(stylistsTable.id, stylist.id));
    }
  }
}
