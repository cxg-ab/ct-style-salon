import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingSteps } from './booking-flow.ts';

test('booking steps order', () => {
  assert.deepEqual(bookingSteps, ['Service', 'Employee', 'Date & time', 'Details']);
});
