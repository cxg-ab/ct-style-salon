import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingSteps, selectEmployee } from './booking-flow.ts';

test('booking steps keep employee selection first', () => {
  assert.deepEqual(bookingSteps, ['Employee', 'Service', 'Date & time', 'Details']);
});

test('choosing a different employee clears dependent selections', () => {
  assert.deepEqual(selectEmployee(7), {
    stylistId: 7,
    serviceId: undefined,
    time: '',
    step: 2,
  });
});