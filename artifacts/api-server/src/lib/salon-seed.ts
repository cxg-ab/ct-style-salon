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