export const UAE_BOOKING_DAYS_AHEAD = 5;
export const UAE_TIME_ZONE = 'Asia/Dubai';

const uaeDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: UAE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function uaeDateTimeParts(value: Date = new Date()) {
  const parts = Object.fromEntries(
    uaeDateTimeFormatter.formatToParts(value).map(({ type, value: partValue }) => [type, partValue]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function uaeIsoDate(value: Date = new Date()) {
  return uaeDateTimeParts(value).date;
}

export function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function slotTimeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return undefined;
  return (hour % 12) * 60 + minute + (match[3] === 'PM' ? 720 : 0);
}

export function isFutureUaeSlot(date: string, time: string, now: Date = new Date()) {
  const slotMinutes = slotTimeToMinutes(time);
  if (slotMinutes === undefined) return false;
  const current = uaeDateTimeParts(now);
  if (date > current.date) return true;
  if (date < current.date) return false;
  return slotMinutes > current.minutes;
}

export function bookingDateBounds(now: Date = new Date()) {
  const minDate = uaeIsoDate(now);
  return {
    minDate,
    maxDate: addIsoDays(minDate, UAE_BOOKING_DAYS_AHEAD),
  };
}

export function rolloverDate(selectedDate: string, now: Date = new Date()) {
  const currentDate = uaeIsoDate(now);
  return selectedDate < currentDate ? currentDate : selectedDate;
}