import test from 'node:test';
import assert from 'node:assert/strict';
import { canRetrySync, syncLabel, normalizeOTPInput } from '../src/components/accounts/mobile.ts';

test('retry requires verification and never retries ambiguous or conflicting accounts', () => {
  for (const state of ['FAILED', 'PENDING', 'SYNCING']) {
    assert.equal(canRetrySync({ mobile_verified_at: '2026-10-18', quiz24_sync_status: state }), true);
    assert.equal(canRetrySync({ mobile_verified_at: null, quiz24_sync_status: state }), false);
  }
  for (const state of ['NOT_READY', 'SYNCED', 'CONFLICT', 'UNKNOWN']) assert.equal(canRetrySync({ mobile_verified_at: '2026-10-18', quiz24_sync_status: state }), false);
});
test('Persian status distinguishes verified identity, retryable failure and support review', () => {
  assert.notEqual(syncLabel('FAILED'), syncLabel('UNKNOWN'));
  assert.match(syncLabel('CONFLICT'), /پشتیبانی/);
  assert.equal(syncLabel('SYNCED'), 'متصل');
});

test('Persian and Arabic OTP digits normalize without dropping the leading zero', () => {
  assert.equal(normalizeOTPInput('۰۱۲٣٤٥'), '012345');
  assert.equal(normalizeOTPInput('01 23-45x6'), '012345');
});
