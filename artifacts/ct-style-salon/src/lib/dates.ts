export function localDateISO(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(value: string, amount: number): string {
  const next = new Date(`${value}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return localDateISO(next);
}
