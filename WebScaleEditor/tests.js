import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, parseScaleFile } from './core.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FACTORY = readFileSync(join(__dirname, '../factoryPreset/scale.txt'), 'utf8');

test('core.js loads as an ES module', () => {
  assert.equal(typeof VERSION, 'string');
});

test('parseScaleFile parses factory file to 16 slots with no errors', () => {
  const { slots, errors } = parseScaleFile(FACTORY);
  assert.equal(errors.length, 0);
  assert.equal(slots.length, 16);
});

test('parseScaleFile correctly parses slot 0 of factory file', () => {
  const { slots } = parseScaleFile(FACTORY);
  const s0 = slots[0];
  assert.deepEqual(s0.led1, { r: 127, g: 0, b: 0 });
  assert.deepEqual(s0.led2, { r: 127, g: 0, b: 51 });
  assert.equal(s0.rootEmphasize, true);
  assert.deepEqual([...s0.notes].sort((a,b) => a-b), [0,7,12,14,16,17,19,21,23]);
});

test('parseScaleFile correctly parses slot 8 of factory file (Whole tone — rootEmphasize off)', () => {
  const { slots } = parseScaleFile(FACTORY);
  const s8 = slots[8];
  assert.equal(s8.rootEmphasize, false);
  assert.deepEqual([...s8.notes].sort((a,b) => a-b), [0,2,4,6,8,10]);
});
