import assert from "node:assert/strict";
import test from "node:test";
import { appointmentLookupCode, lookupCodesMatch } from "./booking-access";

test("lookup codes are stable, case-insensitive, and email-specific", () => {
  const code = appointmentLookupCode("Guest@Example.com");
  assert.equal(code.length, 6);
  assert.equal(appointmentLookupCode("guest@example.com"), code);
  assert.equal(lookupCodesMatch("guest@example.com", code.toLowerCase()), true);
  assert.equal(lookupCodesMatch("guest@example.com", "ZZZZZZ"), false);
  assert.notEqual(appointmentLookupCode("other@example.com"), code);
});
