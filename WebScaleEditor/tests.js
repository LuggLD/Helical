import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from './core.js';

test('core.js loads as an ES module', () => {
  assert.equal(typeof VERSION, 'string');
});
