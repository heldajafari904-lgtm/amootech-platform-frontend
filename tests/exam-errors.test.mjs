import assert from 'node:assert/strict';
import test from 'node:test';
import { errorMessage } from '../src/lib/api.ts';

test('Quiz24 detail retains provider code without duplicated internal metadata', () => {
  const detail = 'بسته فعال نیست (کد Quiz24: 150)';
  assert.equal(errorMessage({ detail, provider_code: 150, provider_message: 'بسته فعال نیست' }), detail);
});

test('Exam configuration and ordinary validation errors remain readable', () => {
  assert.equal(errorMessage({ detail: 'آدرس بازگشت معتبر نیست.', provider_code: null }), 'آدرس بازگشت معتبر نیست.');
  assert.equal(errorMessage({ title: ['عنوان را وارد کنید.'] }), 'title: عنوان را وارد کنید.');
  assert.equal(errorMessage(new Error('پاسخی از Quiz24 دریافت نشد.')), 'پاسخی از Quiz24 دریافت نشد.');
});
