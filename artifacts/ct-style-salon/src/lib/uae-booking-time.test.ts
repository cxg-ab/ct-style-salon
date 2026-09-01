import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UAE_BOOKING_DAYS_AHEAD,
  bookingDateBounds,
  isFutureUaeSlot,
  rolloverDate,
  uaeIsoDate,
} from './uae-booking-time';

const beforeMidnight = new Date('2026-05-10T19:59:00.000Z');
const afterMidnight = new Date('2026-05-10T20:01:00.000Z');

test('uses UAE time for the last minute before midnight', () => {
  assert.equal(uaeIsoDate(beforeMidnight), '2026-05-10');
  assert.equal(isFutureUaeSlot('2026-05-10', '11:00 PM', beforeMidnight), false);
  assert.equal(isFutureUaeSlot('2026-05-11', '12:00 AM', beforeMidnight), true);
});

test('uses the new UAE date immediately after midnight', () => {
  assert.equal(uaeIsoDate(afterMidnight), '2026-05-11');
  assert.equal(isFutureUaeSlot('2026-05-10', '11:00 PM', afterMidnight), false);
  assert.equal(isFutureUaeSlot('2026-05-11', '12:00 AM', afterMidnight), false);
  assert.equal(isFutureUaeSlot('2026-05-11', '1:30 AM', afterMidnight), true);
});

test('keeps the five-day boundary inclusive for customer rescheduling', () => {
  const bounds = bookingDateBounds(afterMidnight);
  assert.equal(bounds.minDate, '2026-05-11');
  assert.equal(bounds.maxDate, '2026-05-16');
  assert.equal(UAE_BOOKING_DAYS_AHEAD, 5);
  assert.equal(isFutureUaeSlot(bounds.maxDate, '10:00 AM', afterMidnight), true);
  assert.equal(isFutureUaeSlot('2026-05-17', '10:00 AM', afterMidnight), true);
});

test('rolls a selected booking date forward when the UAE date changes', () => {
  assert.equal(rolloverDate('2026-05-10', afterMidnight), '2026-05-11');
  assert.equal(rolloverDate('2026-05-16', afterMidnight), '2026-05-16');
});

test('does not keep a selected time after it has passed in the UAE', () => {
  const now = new Date('2026-05-10T10:00:00.000Z');
  assert.equal(isFutureUaeSlot('2026-05-10', '1:59 PM', now), false);
  assert.equal(isFutureUaeSlot('2026-05-10', '2:01 PM', now), true);
});