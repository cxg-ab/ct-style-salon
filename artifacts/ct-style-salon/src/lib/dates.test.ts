import assert from 'node:assert/strict';
import test from 'node:test';
import { localDateISO } from './dates.ts';

test('localDateISO keeps the local calendar day around midnight', () => {
  const afterMidnight = new Date(2026, 7, 31, 0, 30, 0);
  assert.equal(localDateISO(afterMidnight), '2026-08-31');
  assert.equal(
    localDateISO(afterMidnight),
    `${afterMidnight.getFullYear()}-${String(afterMidnight.getMonth() + 1).padStart(2, '0')}-${String(afterMidnight.getDate()).padStart(2, '0')}`,
  );
});
