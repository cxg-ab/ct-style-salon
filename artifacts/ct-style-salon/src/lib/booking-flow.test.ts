import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingSteps, selectEmployee } from './booking-flow.ts';

test('booking steps keep employee selection first', () => {
  assert.deepEqual(bookingSteps, ['Employee', 'Service', 'Date & time', 'Details']);
});

test('choosing a different employee keeps services and clears only the time', () => {
  assert.deepEqual(selectEmployee(7, [3, 4]), {
    stylistId: 7,
    serviceIds: [3, 4],
    time: '',
    step: 2,
  });
});