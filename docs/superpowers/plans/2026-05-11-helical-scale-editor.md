# Helical Web Scale Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portable, zero-install web app that replaces the Max-based Helical scale editor — load, edit, and save the `scale.txt` SD-card file from any modern browser.

**Architecture:** Static single-page web app, no build step, no runtime dependencies. Pure logic (`core.js`) is split from DOM glue (`app.js`) so the highest-risk code can be unit-tested with `node --test` (zero dev dependencies). UI is built with native HTML, CSS, and ES-module JavaScript. Users open `index.html` directly in any browser; developers can run the test suite with Node 18+.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML, CSS, `node --test` (Node 18+ built-in), `node:assert/strict` (Node built-in).

**Reference spec:** `docs/superpowers/specs/2026-05-10-helical-scale-editor-design.md`. When in doubt about behavior, the spec is the source of truth.

**Commits in this repo MUST use** `-c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)"` overrides and include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

**Working branch:** `web-scale-editor` (already created and checked out).

---

## File structure (final state)

```
WebScaleEditor/
├── index.html           — markup, structure, file picker input
├── style.css            — all visual styling
├── core.js              — pure logic, ES module: parsing, serializing, validation, state ops
├── app.js               — DOM glue, ES module: imports core.js
├── tests.js             — node --test suite, imports core.js
└── README.md            — end-user instructions, manual test plan, dev/test instructions
```

`core.js` exports (final set):
- `parseScaleFile(text) → { slots, errors, warnings }`
- `serializeScaleFile(slots) → string`
- `validateSlot(slot) → string[]`
- `createDefaultSlots() → Slot[]`
- `deepCloneSlots(slots) → Slot[]`
- `slotsEqual(a, b) → boolean`
- `applyToSlot(slots, sourceSlot, slotIndex, { notes, colors }) → Slot[]`
- `clearSlot(slots, idx) → Slot[]`
- `FACTORY_PRESETS` — array of 16 `{ name, slot }` entries

A "Slot" is the shape:
```js
{ led1: {r,g,b}, led2: {r,g,b}, rootEmphasize: false, notes: Set<number> }
```

`copySlot` and `applyPreset` are both wrappers around `applyToSlot` since they only differ in where the source comes from (another slot vs. a preset).

---

# Phase 1 — Core logic (strict TDD)

## Task 1: Project scaffold and test runner sanity check

**Files:**
- Create: `WebScaleEditor/core.js`
- Create: `WebScaleEditor/tests.js`
- Create: `WebScaleEditor/index.html` (empty stub for now)
- Create: `WebScaleEditor/style.css` (empty stub)
- Create: `WebScaleEditor/app.js` (empty stub)
- Create: `WebScaleEditor/README.md` (placeholder content)

- [ ] **Step 1: Create the empty module stubs**

```bash
mkdir -p WebScaleEditor
```

Write `WebScaleEditor/core.js`:
```js
// Pure logic for the Helical scale editor. No DOM, no globals.
export const VERSION = '0.1.0';
```

Write `WebScaleEditor/app.js`:
```js
// DOM glue for the Helical scale editor. Imports from core.js.
import { VERSION } from './core.js';
console.log('Helical Web Scale Editor', VERSION);
```

Write `WebScaleEditor/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Helical Scale Editor</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main id="root">scaffold</main>
<script type="module" src="app.js"></script>
</body>
</html>
```

Write `WebScaleEditor/style.css`:
```css
/* WebScaleEditor styles — populated in later tasks. */
```

Write `WebScaleEditor/README.md`:
```markdown
# Helical Web Scale Editor

A browser-based editor for the Helical eurorack module's `scale.txt` file. Open `index.html` in any modern browser.

This README will be expanded in a later task.
```

- [ ] **Step 2: Write a sanity test in `WebScaleEditor/tests.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from './core.js';

test('core.js loads as an ES module', () => {
  assert.equal(typeof VERSION, 'string');
});
```

- [ ] **Step 3: Run the test**

Run from the repo root:
```bash
node --test WebScaleEditor/tests.js
```

Expected output: `pass 1` (or "tests 1, pass 1, fail 0"). Exit code 0.

- [ ] **Step 4: Commit**

```bash
git add WebScaleEditor/
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: scaffold module + node --test

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `parseScaleFile` — happy path

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

The factory file at `factoryPreset/scale.txt` has 16 lines; line 1 is:
```
127 0 0 127 0 51 1 0 7 12 14 16 17 19 21 23
```
This parses to: `led1={r:127,g:0,b:0}`, `led2={r:127,g:0,b:51}`, `rootEmphasize=true`, `notes={0,7,12,14,16,17,19,21,23}`.

- [ ] **Step 1: Add a failing test to `WebScaleEditor/tests.js`**

Append:
```js
import { parseScaleFile } from './core.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FACTORY = readFileSync(join(__dirname, '../factoryPreset/scale.txt'), 'utf8');

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

test('parseScaleFile correctly parses slot 14 of factory file (Whole tone — rootEmphasize off)', () => {
  const { slots } = parseScaleFile(FACTORY);
  const s14 = slots[14];
  assert.equal(s14.rootEmphasize, false);
  assert.deepEqual([...s14.notes].sort((a,b) => a-b), [0,2,4,6,8,10]);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test WebScaleEditor/tests.js
```

Expected: at least 3 failures, with messages like "parseScaleFile is not a function" or "Cannot read properties of undefined".

- [ ] **Step 3: Implement `parseScaleFile` happy path in `WebScaleEditor/core.js`**

Append:
```js
export function parseScaleFile(text) {
  const errors = [];
  const warnings = [];

  const lines = text
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))   // strip trailing whitespace per line
    .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''));

  if (lines.length !== 16) {
    errors.push(`Expected 16 lines, got ${lines.length}`);
    return { slots: null, errors, warnings };
  }

  const slots = lines.map((line, i) => {
    const toks = line.trim().split(/\s+/).filter(t => t.length > 0);
    const nums = toks.map(t => parseInt(t, 10));

    const led1 = { r: nums[0], g: nums[1], b: nums[2] };
    const led2 = { r: nums[3], g: nums[4], b: nums[5] };
    const rootEmphasize = nums[6] === 1;
    const notes = new Set(nums.slice(7));

    return { led1, led2, rootEmphasize, notes };
  });

  return { slots, errors, warnings };
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
node --test WebScaleEditor/tests.js
```

Expected: all 4 tests pass (1 sanity + 3 new).

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: parseScaleFile happy path

Parses scale.txt into 16 slot objects. Tested against the factory file.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `parseScaleFile` — error and edge cases

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

Cases to cover per the spec:
- Wrong line count
- Line with < 7 tokens
- Non-numeric token
- Trailing whitespace, trailing space on last line, missing final newline (all should be tolerated by the happy-path code already)
- Notes > 47 (loaded into state, surfaced via validator later)
- LED values out of 0–255 (soft warning, but loaded)

- [ ] **Step 1: Add failing tests to `WebScaleEditor/tests.js`**

Append:
```js
test('parseScaleFile rejects wrong line count', () => {
  const { slots, errors } = parseScaleFile('1 2 3 4 5 6 1\n');
  assert.equal(slots, null);
  assert.match(errors[0], /Expected 16 lines, got 1/);
});

test('parseScaleFile rejects a line with too few tokens', () => {
  const tooShort = '1 2 3\n' + ('1 2 3 4 5 6 1 0\n'.repeat(15));
  const { slots, errors } = parseScaleFile(tooShort);
  assert.equal(slots, null);
  assert.ok(errors.some(e => /line 1.*too few/i.test(e)));
});

test('parseScaleFile rejects a non-numeric token', () => {
  const bad = '1 2 3 4 5 6 abc 0 7\n' + ('1 2 3 4 5 6 1 0\n'.repeat(15));
  const { slots, errors } = parseScaleFile(bad);
  assert.equal(slots, null);
  assert.ok(errors.some(e => /line 1.*abc/.test(e)));
});

test('parseScaleFile tolerates missing trailing newline', () => {
  const noTrailing = FACTORY.replace(/[\s\n]+$/, '');
  const { errors } = parseScaleFile(noTrailing);
  assert.equal(errors.length, 0);
});

test('parseScaleFile tolerates trailing space on the last line (factory behavior)', () => {
  // Factory file does this exact thing.
  const { errors } = parseScaleFile(FACTORY);
  assert.equal(errors.length, 0);
});

test('parseScaleFile soft-warns on LED value > 255 (loads it anyway)', () => {
  const oneBad = '300 0 0 0 0 0 0 7\n' + ('1 2 3 4 5 6 1 0\n'.repeat(15));
  const { slots, warnings } = parseScaleFile(oneBad);
  assert.equal(slots.length, 16);
  assert.equal(slots[0].led1.r, 300);   // loaded as-is, validator surfaces it
  assert.ok(warnings.some(w => /line 1.*LED/i.test(w)));
});
```

- [ ] **Step 2: Run tests and verify failures**

```bash
node --test WebScaleEditor/tests.js
```

Expected: 6 new failures (the soft-warning and error-case tests).

- [ ] **Step 3: Update `parseScaleFile` in `WebScaleEditor/core.js`**

Replace the existing `parseScaleFile` body with:

```js
export function parseScaleFile(text) {
  const errors = [];
  const warnings = [];

  // Split, trim trailing whitespace, drop trailing empty line(s).
  let lines = text.split('\n').map(line => line.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  if (lines.length !== 16) {
    errors.push(`Expected 16 lines, got ${lines.length}`);
    return { slots: null, errors, warnings };
  }

  const slots = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const toks = lines[i].trim().split(/\s+/).filter(t => t.length > 0);

    if (toks.length < 7) {
      errors.push(`Line ${lineNum}: too few values (expected at least 7, got ${toks.length})`);
      continue;
    }

    const nums = [];
    let lineHadError = false;
    for (const tok of toks) {
      const n = parseInt(tok, 10);
      if (!Number.isFinite(n) || String(n) !== tok) {
        errors.push(`Line ${lineNum}: non-numeric token "${tok}"`);
        lineHadError = true;
        break;
      }
      nums.push(n);
    }
    if (lineHadError) continue;

    for (let c = 0; c < 6; c++) {
      if (nums[c] < 0 || nums[c] > 255) {
        warnings.push(`Line ${lineNum}: LED channel value ${nums[c]} is outside 0-255`);
      }
    }
    if (nums[6] !== 0 && nums[6] !== 1) {
      warnings.push(`Line ${lineNum}: rootEmphasize flag ${nums[6]} is not 0 or 1`);
    }

    slots.push({
      led1: { r: nums[0], g: nums[1], b: nums[2] },
      led2: { r: nums[3], g: nums[4], b: nums[5] },
      rootEmphasize: nums[6] !== 0,
      notes: new Set(nums.slice(7).filter(n => n >= 0)),
    });
  }

  if (errors.length > 0) {
    return { slots: null, errors, warnings };
  }
  return { slots, errors, warnings };
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
node --test WebScaleEditor/tests.js
```

Expected: all tests pass (sanity + happy-path + 6 new).

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: parseScaleFile error and edge cases

Reports wrong line count, malformed lines, non-numeric tokens, and
soft-warns on LED values outside 0-255. Tolerates trailing space and
missing trailing newline (matching the factory file).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `serializeScaleFile` + round-trip

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

- [ ] **Step 1: Add failing tests**

Append to `tests.js`:
```js
import { serializeScaleFile } from './core.js';

test('serializeScaleFile produces one line per slot, LF terminated', () => {
  const slot = {
    led1: { r: 127, g: 0, b: 0 },
    led2: { r: 127, g: 0, b: 51 },
    rootEmphasize: true,
    notes: new Set([12, 7, 0, 14, 16, 17, 19, 21, 23]),
  };
  const slots = Array.from({ length: 16 }, () => slot);
  const out = serializeScaleFile(slots);
  const lines = out.split('\n');
  assert.equal(lines.length, 17);                  // 16 lines + trailing empty after final \n
  assert.equal(lines[16], '');
  assert.equal(lines[0], '127 0 0 127 0 51 1 0 7 12 14 16 17 19 21 23');
});

test('serializeScaleFile emits notes sorted ascending', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set([23, 7, 0, 12]),
  };
  const out = serializeScaleFile(Array.from({ length: 16 }, () => slot));
  assert.equal(out.split('\n')[0], '0 0 0 0 0 0 0 0 7 12 23');
});

test('serializeScaleFile handles empty notes set', () => {
  const slot = {
    led1: { r: 1, g: 2, b: 3 }, led2: { r: 4, g: 5, b: 6 },
    rootEmphasize: true, notes: new Set(),
  };
  const out = serializeScaleFile(Array.from({ length: 16 }, () => slot));
  assert.equal(out.split('\n')[0], '1 2 3 4 5 6 1');
});

test('parse → serialize → parse round-trips on factory file', () => {
  const first = parseScaleFile(FACTORY);
  const text = serializeScaleFile(first.slots);
  const second = parseScaleFile(text);
  assert.equal(second.errors.length, 0);
  assert.equal(second.slots.length, 16);
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(second.slots[i].led1, first.slots[i].led1, `slot ${i} led1`);
    assert.deepEqual(second.slots[i].led2, first.slots[i].led2, `slot ${i} led2`);
    assert.equal(second.slots[i].rootEmphasize, first.slots[i].rootEmphasize, `slot ${i} rootEmphasize`);
    assert.deepEqual(
      [...second.slots[i].notes].sort((a,b)=>a-b),
      [...first.slots[i].notes].sort((a,b)=>a-b),
      `slot ${i} notes`
    );
  }
});
```

- [ ] **Step 2: Run tests and verify failures**

```bash
node --test WebScaleEditor/tests.js
```

Expected: 4 failures (serializeScaleFile undefined).

- [ ] **Step 3: Implement `serializeScaleFile` in `WebScaleEditor/core.js`**

Append:
```js
export function serializeScaleFile(slots) {
  if (!Array.isArray(slots) || slots.length !== 16) {
    throw new Error(`serializeScaleFile expects 16 slots, got ${slots && slots.length}`);
  }
  return slots.map(s => {
    const sorted = [...s.notes].sort((a, b) => a - b);
    const parts = [
      s.led1.r, s.led1.g, s.led1.b,
      s.led2.r, s.led2.g, s.led2.b,
      s.rootEmphasize ? 1 : 0,
      ...sorted,
    ];
    return parts.join(' ');
  }).join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
node --test WebScaleEditor/tests.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: serializeScaleFile + round-trip test

Notes are emitted sorted ascending. Each line is newline-terminated.
Round-trip against the factory file is verified.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `validateSlot`

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

- [ ] **Step 1: Add failing tests**

Append to `tests.js`:
```js
import { validateSlot } from './core.js';

test('validateSlot returns no warnings for a normal slot', () => {
  const slot = {
    led1: { r: 127, g: 0, b: 0 }, led2: { r: 127, g: 0, b: 51 },
    rootEmphasize: true, notes: new Set([0, 7, 12, 14, 16, 17, 19, 21, 23]),
  };
  assert.deepEqual(validateSlot(slot), []);
});

test('validateSlot warns on empty notes', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set(),
  };
  assert.ok(validateSlot(slot).some(w => /empty/i.test(w)));
});

test('validateSlot warns when root emphasize on + no notes >= 12', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: true, notes: new Set([0, 2, 4, 7]),
  };
  assert.ok(validateSlot(slot).some(w => /first octave/i.test(w) || /silence/i.test(w)));
});

test('validateSlot does NOT warn about emphasize-silence when rootEmphasize off', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set([0, 2, 4, 7]),
  };
  assert.equal(validateSlot(slot).length, 0);
});

test('validateSlot warns about notes >= 48', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set([0, 7, 48, 60]),
  };
  const w = validateSlot(slot);
  assert.ok(w.some(s => /48/.test(s) && /60/.test(s)));
});
```

- [ ] **Step 2: Run tests and verify failures**

```bash
node --test WebScaleEditor/tests.js
```

Expected: 5 failures.

- [ ] **Step 3: Implement `validateSlot`**

Append to `core.js`:
```js
export function validateSlot(slot) {
  const out = [];
  if (slot.notes.size === 0) {
    out.push('Scale is empty');
  }
  if (slot.rootEmphasize && slot.notes.size > 0) {
    const hasUpper = [...slot.notes].some(n => n >= 12);
    if (!hasUpper) {
      out.push('Root Emphasize is on but no notes above the first octave — this will produce silence');
    }
  }
  const oor = [...slot.notes].filter(n => n >= 48).sort((a, b) => a - b);
  if (oor.length > 0) {
    out.push(`Notes outside the editor's 4-octave range (>=48): ${oor.join(', ')}`);
  }
  return out;
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
node --test WebScaleEditor/tests.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: validateSlot for advisory warnings

Empty scale, root-emphasize silence, and out-of-editor-range notes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `deepCloneSlots` and `slotsEqual`

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

These power undo/redo and dirty tracking. They must correctly handle the `Set` inside each slot.

- [ ] **Step 1: Add failing tests**

Append:
```js
import { deepCloneSlots, slotsEqual } from './core.js';

test('deepCloneSlots produces an independent copy including the notes Set', () => {
  const orig = parseScaleFile(FACTORY).slots;
  const copy = deepCloneSlots(orig);
  assert.notEqual(copy, orig);
  assert.notEqual(copy[0], orig[0]);
  assert.notEqual(copy[0].notes, orig[0].notes);
  copy[0].notes.add(99);
  assert.equal(orig[0].notes.has(99), false);
});

test('slotsEqual returns true for identical clones', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  assert.equal(slotsEqual(a, b), true);
});

test('slotsEqual returns false when a note differs', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  b[3].notes.add(99);
  assert.equal(slotsEqual(a, b), false);
});

test('slotsEqual returns false when an LED color differs', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  b[5].led1.r = (b[5].led1.r + 1) % 256;
  assert.equal(slotsEqual(a, b), false);
});

test('slotsEqual returns false when rootEmphasize differs', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  b[7].rootEmphasize = !b[7].rootEmphasize;
  assert.equal(slotsEqual(a, b), false);
});
```

- [ ] **Step 2: Run and verify failures**

```bash
node --test WebScaleEditor/tests.js
```

- [ ] **Step 3: Implement in `core.js`**

Append:
```js
export function deepCloneSlots(slots) {
  return slots.map(s => ({
    led1: { ...s.led1 },
    led2: { ...s.led2 },
    rootEmphasize: s.rootEmphasize,
    notes: new Set(s.notes),
  }));
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function slotsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.led1.r !== y.led1.r || x.led1.g !== y.led1.g || x.led1.b !== y.led1.b) return false;
    if (x.led2.r !== y.led2.r || x.led2.g !== y.led2.g || x.led2.b !== y.led2.b) return false;
    if (x.rootEmphasize !== y.rootEmphasize) return false;
    if (!setsEqual(x.notes, y.notes)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run and verify pass**

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: deepCloneSlots and slotsEqual

Powers undo/redo snapshots and dirty tracking. Correctly handles
the notes Set in each slot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `createDefaultSlots`

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

The starting state when the user opens the editor without loading a file: 16 slots with LEDs off, no notes, root emphasize off.

- [ ] **Step 1: Add failing tests**

Append:
```js
import { createDefaultSlots } from './core.js';

test('createDefaultSlots returns 16 slots', () => {
  assert.equal(createDefaultSlots().length, 16);
});

test('createDefaultSlots has all LEDs off, no notes, no emphasis', () => {
  const slots = createDefaultSlots();
  for (const s of slots) {
    assert.deepEqual(s.led1, { r: 0, g: 0, b: 0 });
    assert.deepEqual(s.led2, { r: 0, g: 0, b: 0 });
    assert.equal(s.rootEmphasize, false);
    assert.equal(s.notes.size, 0);
  }
});

test('createDefaultSlots returns independent objects', () => {
  const slots = createDefaultSlots();
  slots[0].led1.r = 200;
  slots[0].notes.add(5);
  assert.equal(slots[1].led1.r, 0);
  assert.equal(slots[1].notes.size, 0);
});
```

- [ ] **Step 2: Run and verify failures**

- [ ] **Step 3: Implement in `core.js`**

Append:
```js
export function createDefaultSlots() {
  return Array.from({ length: 16 }, () => ({
    led1: { r: 0, g: 0, b: 0 },
    led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false,
    notes: new Set(),
  }));
}
```

- [ ] **Step 4: Run and verify pass**

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: createDefaultSlots

16 empty slots used as the initial editor state before any load.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `applyToSlot` (used by copy and preset-apply)

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

Both "copy slot N to M" and "apply preset P to current slot" reduce to the same shape: take a source `slot`, write some-or-all of its fields into `slots[targetIndex]`. `applyToSlot` does this purely.

Signature: `applyToSlot(slots, sourceSlot, targetIndex, { notes, colors }) → newSlots`

- If `notes` is true: target's `notes` and `rootEmphasize` are replaced from source.
- If `colors` is true: target's `led1` and `led2` are replaced from source.
- Always returns a new `slots` array (the target slot is a fresh object; siblings are referenced as-is — that's fine because callers will use this output as a whole new state and not mutate it later).

- [ ] **Step 1: Add failing tests**

Append:
```js
import { applyToSlot } from './core.js';

const SAMPLE_SOURCE = {
  led1: { r: 50, g: 100, b: 150 },
  led2: { r: 200, g: 0, b: 100 },
  rootEmphasize: true,
  notes: new Set([0, 5, 10]),
};

test('applyToSlot with both flags replaces everything in target', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: true });
  assert.deepEqual(out[3].led1, SAMPLE_SOURCE.led1);
  assert.deepEqual(out[3].led2, SAMPLE_SOURCE.led2);
  assert.equal(out[3].rootEmphasize, true);
  assert.deepEqual([...out[3].notes].sort(), [0, 10, 5]);
});

test('applyToSlot with notes:true colors:false leaves target LEDs untouched', () => {
  const slots = createDefaultSlots();
  slots[3].led1 = { r: 1, g: 2, b: 3 };
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: false });
  assert.deepEqual(out[3].led1, { r: 1, g: 2, b: 3 });
  assert.equal(out[3].rootEmphasize, true);
  assert.equal(out[3].notes.size, 3);
});

test('applyToSlot with notes:false colors:true leaves target notes untouched', () => {
  const slots = createDefaultSlots();
  slots[3].notes = new Set([99]);
  slots[3].rootEmphasize = false;
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: false, colors: true });
  assert.deepEqual([...out[3].notes], [99]);
  assert.equal(out[3].rootEmphasize, false);
  assert.deepEqual(out[3].led1, SAMPLE_SOURCE.led1);
});

test('applyToSlot returns a new array; original is unchanged', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: true });
  assert.notEqual(out, slots);
  assert.equal(slots[3].notes.size, 0);            // original target untouched
});

test('applyToSlot returns the same slot reference for non-targets', () => {
  // We don't strictly require this, but it's a useful structural check that
  // the function doesn't pointlessly clone every slot.
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: true });
  assert.equal(out[0], slots[0]);
  assert.equal(out[5], slots[5]);
});

test('applyToSlot throws if target index is out of range', () => {
  const slots = createDefaultSlots();
  assert.throws(() => applyToSlot(slots, SAMPLE_SOURCE, -1, { notes: true, colors: true }));
  assert.throws(() => applyToSlot(slots, SAMPLE_SOURCE, 16, { notes: true, colors: true }));
});

test('applyToSlot with neither flag is a no-op (returns slots unchanged structurally)', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: false, colors: false });
  assert.deepEqual([...out[3].notes], []);
  assert.deepEqual(out[3].led1, { r: 0, g: 0, b: 0 });
});
```

- [ ] **Step 2: Run and verify failures**

- [ ] **Step 3: Implement in `core.js`**

Append:
```js
export function applyToSlot(slots, sourceSlot, targetIndex, { notes, colors }) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= slots.length) {
    throw new Error(`applyToSlot: targetIndex ${targetIndex} out of range`);
  }
  const current = slots[targetIndex];
  const next = {
    led1: colors ? { ...sourceSlot.led1 } : { ...current.led1 },
    led2: colors ? { ...sourceSlot.led2 } : { ...current.led2 },
    rootEmphasize: notes ? sourceSlot.rootEmphasize : current.rootEmphasize,
    notes: notes ? new Set(sourceSlot.notes) : new Set(current.notes),
  };
  const out = slots.slice();
  out[targetIndex] = next;
  return out;
}
```

- [ ] **Step 4: Run and verify pass**

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: applyToSlot used by copy-to and apply-preset

Pure transform: write some-or-all of a source slot's fields into one
target slot, returning a new slots array.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `clearSlot`

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

Clears only notes — preserves LED colors and root emphasize. Returns a new slots array.

- [ ] **Step 1: Add failing tests**

Append:
```js
import { clearSlot } from './core.js';

test('clearSlot empties only the notes Set', () => {
  const slots = parseScaleFile(FACTORY).slots;
  const before = slots[3];
  const out = clearSlot(slots, 3);
  assert.equal(out[3].notes.size, 0);
  assert.deepEqual(out[3].led1, before.led1);
  assert.deepEqual(out[3].led2, before.led2);
  assert.equal(out[3].rootEmphasize, before.rootEmphasize);
});

test('clearSlot does not mutate the original slots array', () => {
  const slots = parseScaleFile(FACTORY).slots;
  const sizeBefore = slots[3].notes.size;
  clearSlot(slots, 3);
  assert.equal(slots[3].notes.size, sizeBefore);
});

test('clearSlot leaves non-target slots referentially equal', () => {
  const slots = parseScaleFile(FACTORY).slots;
  const out = clearSlot(slots, 3);
  assert.equal(out[0], slots[0]);
});
```

- [ ] **Step 2: Run and verify failures**

- [ ] **Step 3: Implement**

Append to `core.js`:
```js
export function clearSlot(slots, targetIndex) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= slots.length) {
    throw new Error(`clearSlot: targetIndex ${targetIndex} out of range`);
  }
  const current = slots[targetIndex];
  const next = {
    led1: { ...current.led1 },
    led2: { ...current.led2 },
    rootEmphasize: current.rootEmphasize,
    notes: new Set(),
  };
  const out = slots.slice();
  out[targetIndex] = next;
  return out;
}
```

- [ ] **Step 4: Run and verify pass**

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: clearSlot preserves colors and rootEmphasize

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `FACTORY_PRESETS` constant

**Files:**
- Modify: `WebScaleEditor/core.js`
- Modify: `WebScaleEditor/tests.js`

The 16 factory presets, parsed from `factoryPreset/scale.txt` and paired with the human-readable names from the main repo `README.md`'s `# Scale / Wavetable` section.

Names from the README (in order, slots 0–15):
```
Major(R)
Lydian(R)
Mixolydian(R)
Major Pentatonic(R)
Natural Minor(R)
Dorian(R)
Phrygian(R)
Minor Pentatonic(R)
I M7(R)
II m7(R)
III m7(R)
IV M7(R)
V 7(R)
VI m7(R)
Whole tone
Chromatic
```

We parse the factory file at module load time (using a hardcoded constant string baked into `core.js`, NOT a runtime fetch — `core.js` must run in both browser and node without I/O).

To get the constant string: cat the factory file contents, escape, embed as a multi-line template literal.

- [ ] **Step 1: Add failing tests**

Append to `tests.js`:
```js
import { FACTORY_PRESETS } from './core.js';

test('FACTORY_PRESETS has 16 entries', () => {
  assert.equal(FACTORY_PRESETS.length, 16);
});

test('FACTORY_PRESETS names match the README', () => {
  const expected = [
    'Major(R)', 'Lydian(R)', 'Mixolydian(R)', 'Major Pentatonic(R)',
    'Natural Minor(R)', 'Dorian(R)', 'Phrygian(R)', 'Minor Pentatonic(R)',
    'I M7(R)', 'II m7(R)', 'III m7(R)', 'IV M7(R)',
    'V 7(R)', 'VI m7(R)', 'Whole tone', 'Chromatic',
  ];
  assert.deepEqual(FACTORY_PRESETS.map(p => p.name), expected);
});

test('FACTORY_PRESETS[0] (Major(R)) has expected content', () => {
  const p = FACTORY_PRESETS[0].slot;
  assert.deepEqual(p.led1, { r: 127, g: 0, b: 0 });
  assert.deepEqual(p.led2, { r: 127, g: 0, b: 51 });
  assert.equal(p.rootEmphasize, true);
  assert.deepEqual([...p.notes].sort((a,b)=>a-b), [0,7,12,14,16,17,19,21,23]);
});

test('FACTORY_PRESETS[15] (Chromatic) has 12 notes from 0 to 11', () => {
  const p = FACTORY_PRESETS[15].slot;
  assert.equal(p.rootEmphasize, false);
  assert.deepEqual([...p.notes].sort((a,b)=>a-b), [0,1,2,3,4,5,6,7,8,9,10,11]);
});

test('FACTORY_PRESETS slots match parseScaleFile of factory file', () => {
  const parsed = parseScaleFile(FACTORY).slots;
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(FACTORY_PRESETS[i].slot.led1, parsed[i].led1, `slot ${i} led1`);
    assert.deepEqual(FACTORY_PRESETS[i].slot.led2, parsed[i].led2, `slot ${i} led2`);
    assert.equal(FACTORY_PRESETS[i].slot.rootEmphasize, parsed[i].rootEmphasize, `slot ${i} re`);
    assert.deepEqual(
      [...FACTORY_PRESETS[i].slot.notes].sort((a,b)=>a-b),
      [...parsed[i].notes].sort((a,b)=>a-b),
      `slot ${i} notes`
    );
  }
});
```

- [ ] **Step 2: Run and verify failures**

- [ ] **Step 3: Append to `core.js`**

The factory file contents, embedded as a string constant. Take the bytes verbatim — open `factoryPreset/scale.txt` and paste each line. The closing `\` removes the leading newline; the trailing comma-less concatenation matches the factory's no-newline-on-last-line:

```js
const FACTORY_FILE_TEXT = `\
127 0 0 127 0 51 1 0 7 12 14 16 17 19 21 23
0 102 0 127 0 51 1 0 7 12 14 16 18 19 21 23
0 0 127 127 0 51 1 0 7 12 14 16 17 19 21 22
127 127 51 127 0 51 1 0 7 12 14 16 19 21
0 0 127 51 102 127 1 0 7 12 14 15 17 19 20 22
102 0 0 51 102 127 1 0 7 12 14 15 17 19 21 22
0 152 0 51 102 127 1 0 7 12 13 15 17 19 20 22
127 127 51 51 102 127 1 0 7 12 15 17 19 22
0 127 51 127 127 0 0 0 2 4 6 8 10
127 127 51 127 127 51 0 0 1 2 3 4 5 6 7 8 9 10 11
127 127 51 152 0 0 1 0 7 12 16 19 23
51 51 127 0 152 0 1 2 9 12 14 17 21
51 51 127 0 0 127 1 4 11 14 16 19 23
127 127 51 127 127 0 1 5 12 16 17 21
127 127 0 0 127 102 1 7 14 17 19 23
51 51 127 127 0 102 1 9 12 16 19 21`;

const FACTORY_PRESET_NAMES = [
  'Major(R)', 'Lydian(R)', 'Mixolydian(R)', 'Major Pentatonic(R)',
  'Natural Minor(R)', 'Dorian(R)', 'Phrygian(R)', 'Minor Pentatonic(R)',
  'I M7(R)', 'II m7(R)', 'III m7(R)', 'IV M7(R)',
  'V 7(R)', 'VI m7(R)', 'Whole tone', 'Chromatic',
];

const _parsedFactory = parseScaleFile(FACTORY_FILE_TEXT);
if (_parsedFactory.errors.length > 0) {
  throw new Error('FACTORY_FILE_TEXT failed to parse: ' + _parsedFactory.errors.join('; '));
}

export const FACTORY_PRESETS = _parsedFactory.slots.map((slot, i) => ({
  name: FACTORY_PRESET_NAMES[i],
  slot,
}));
```

**IMPORTANT:** Wait — the spec notes that the README's preset list (lines 84–101 of repo `README.md`) lists names like "Whole tone" and "Chromatic" for slots 14 and 15, but earlier in the README a shorter intro list calls slot 1 "Natural Minor(R)" and slot 2 "Harmonic Minor(R)". Use the FULL list from README lines 84–101, which is the v2.09 set and matches the current factory file. Spot-check: slot 14 is `0 2 4 6 8 10` (whole tone) — confirmed. Slot 15 is `0 1 2 3 4 5 6 7 8 9 10 11` (chromatic) — confirmed.

- [ ] **Step 4: Run and verify pass**

```bash
node --test WebScaleEditor/tests.js
```

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/core.js WebScaleEditor/tests.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: FACTORY_PRESETS constant

The 16 factory scales (parsed from the factory file bytes embedded
as a string) paired with the names from the main repo README.
Available to both browser and node without any I/O.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 2 — Static UI shell (HTML + CSS, no behavior)

The CSS in this phase is large; each task is a single file edit with manual visual verification by opening `index.html` in a browser. The agent should keep the file open and refresh between tasks.

## Task 11: HTML skeleton

**Files:**
- Modify: `WebScaleEditor/index.html`

- [ ] **Step 1: Replace the entire `index.html` content**

Overwrite the file with:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Helical Scale Editor</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="app-header">
    <h1>Helical Scale Editor</h1>
    <div class="dirty-indicator" id="dirty-indicator" hidden>● unsaved changes</div>
  </header>

  <div class="error-banner" id="error-banner" hidden></div>

  <nav class="toolbar" id="toolbar">
    <button type="button" id="btn-load">📂 Load</button>
    <button type="button" id="btn-save">💾 Save</button>
    <button type="button" id="btn-undo" disabled>↶ Undo</button>
    <button type="button" id="btn-redo" disabled>↷ Redo</button>
    <span class="toolbar-sep"></span>
    <button type="button" id="btn-copy">⎘ Copy to…</button>
    <button type="button" id="btn-preset">📚 Apply preset…</button>
    <input type="file" id="file-input" accept=".txt,text/plain" hidden>
  </nav>

  <div class="slot-strip" id="slot-strip" role="tablist" aria-label="Scale slots"></div>

  <section class="editor" id="editor">
    <h2 class="editor-title" id="editor-title">Slot 00</h2>

    <div class="piano" id="piano" aria-label="Note editor"></div>
    <div class="octave-ruler" aria-hidden="true">
      <div>Octave 0</div><div>Octave 1</div><div>Octave 2</div><div>Octave 3</div>
    </div>

    <div class="led-editor">
      <label class="led-control">
        LED 1
        <input type="color" id="led1-input" value="#000000">
      </label>
      <label class="led-control">
        LED 2
        <input type="color" id="led2-input" value="#000000">
      </label>
      <div class="led-preview" id="led-preview" aria-label="Hardware blend preview"></div>
      <label class="emphasize-toggle">
        <input type="checkbox" id="root-emphasize-input">
        Root Emphasize
      </label>
      <button type="button" id="btn-clear" class="btn-clear">Clear notes</button>
    </div>

    <div class="validation-strip" id="validation-strip"></div>
  </section>

  <div class="dialog-backdrop" id="dialog-backdrop" hidden>
    <div class="dialog" id="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h3 class="dialog-title" id="dialog-title"></h3>
      <p class="dialog-lead" id="dialog-lead"></p>
      <div class="dialog-picker" id="dialog-picker"></div>
      <div class="dialog-options">
        <label><input type="checkbox" id="dialog-cb-notes" checked> <span id="dialog-cb-notes-label">Copy notes</span></label>
        <label><input type="checkbox" id="dialog-cb-colors" checked> <span id="dialog-cb-colors-label">Copy LED colors</span></label>
      </div>
      <div class="dialog-warning" id="dialog-warning" hidden></div>
      <div class="dialog-actions">
        <button type="button" id="dialog-cancel">Cancel</button>
        <button type="button" id="dialog-confirm" disabled>Confirm</button>
      </div>
    </div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open in browser to verify it loads**

```bash
xdg-open WebScaleEditor/index.html 2>/dev/null || true
```

If a headless environment: just confirm the file is well-formed by running:
```bash
node -e "const fs=require('fs'); const t=fs.readFileSync('WebScaleEditor/index.html','utf8'); if(t.includes('</html>')) console.log('OK'); else process.exit(1);"
```

Expected: page renders with all sections present (will look unstyled).

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/index.html
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: index.html skeleton

All structural elements present: toolbar, slot strip, piano, LED
editor, validation strip, dialog backdrop. No behavior yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Base CSS — theme, layout, toolbar, slot strip

**Files:**
- Modify: `WebScaleEditor/style.css`

This task lays down the dark theme, page structure, toolbar styling, and the slot strip (including the **critical gradient-origin fix**).

- [ ] **Step 1: Replace `style.css` content**

```css
:root {
  --bg-0: #14141f;
  --bg-1: #1d1d2c;
  --bg-2: #28283a;
  --bg-3: #33334a;
  --fg-0: #f1f1f5;
  --fg-1: #b8b8c4;
  --fg-2: #888893;
  --accent: #5560ff;
  --accent-fg: #ffffff;
  --warn: #d49a3c;
  --warn-bg: #3a2a1a;
  --error: #d44a3c;
  --error-bg: #3a1a1a;
  --ok: #4cb050;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg-0);
  color: var(--fg-0);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  min-height: 100vh;
  padding: 16px 20px 40px;
}

.app-header {
  display: flex; align-items: baseline; gap: 16px;
  margin-bottom: 16px;
}
.app-header h1 {
  font-size: 18px; font-weight: 600; margin: 0; color: var(--fg-0);
}
.dirty-indicator {
  color: var(--warn); font-size: 12px;
}

.error-banner {
  background: var(--error-bg);
  border-left: 3px solid var(--error);
  color: var(--fg-0);
  padding: 10px 14px;
  border-radius: 4px;
  margin-bottom: 14px;
  font-size: 13px;
  white-space: pre-wrap;
}

.toolbar {
  display: flex; gap: 6px; align-items: center;
  background: var(--bg-1);
  padding: 8px;
  border-radius: 8px;
  margin-bottom: 14px;
}
.toolbar button {
  background: var(--bg-2);
  color: var(--fg-0);
  border: 1px solid #00000000;
  padding: 7px 12px;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
}
.toolbar button:hover:not(:disabled) { background: var(--bg-3); }
.toolbar button:disabled { color: var(--fg-2); cursor: not-allowed; }
.toolbar-sep { flex: 1; }

.slot-strip {
  display: flex; gap: 5px; flex-wrap: wrap;
  background: var(--bg-1);
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 14px;
}
.slot-pill {
  position: relative;
  width: 42px; height: 52px;
  border-radius: 6px;
  font-size: 13px; font-weight: 600;
  color: #fff;
  text-shadow: 0 0 4px rgba(0,0,0,0.85), 0 1px 1px rgba(0,0,0,0.7);
  cursor: pointer;
  border: 2px solid transparent;
  display: flex; align-items: center; justify-content: center;
  user-select: none;
  /* CRITICAL: prevents the default padding-box origin from tiling the
     gradient and leaking opposite-end colors into the border area. */
  background-origin: border-box;
  background-repeat: no-repeat;
  transition: transform 0.08s;
}
.slot-pill:hover { transform: translateY(-1px); }
.slot-pill.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--accent), 0 0 10px rgba(85, 96, 255, 0.45);
}

@keyframes slot-flash {
  0%   { box-shadow: 0 0 0 0px rgba(255,255,255,0.95); }
  100% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
}
.slot-pill.flash { animation: slot-flash 0.22s ease-out 3; }

/* Editor pane container */
.editor {
  background: var(--bg-1);
  border-radius: 8px;
  padding: 16px;
}
.editor-title {
  font-size: 14px; font-weight: 600; margin: 0 0 12px;
  color: var(--fg-0);
}
```

- [ ] **Step 2: Open `WebScaleEditor/index.html` in a browser**

Verify: dark theme applied, header reads "Helical Scale Editor", toolbar shows buttons in a row, slot strip is an empty styled container. No JS errors in console.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/style.css
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: base CSS — theme, toolbar, slot strip

Includes the slot-pill background-origin fix that prevents the
gradient from tiling into the border area.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: CSS — piano keyboard

**Files:**
- Modify: `WebScaleEditor/style.css`

White keys are a CSS grid of 28 columns (4 octaves × 7 whites). Black keys are absolutely positioned at white-key boundaries with width 2.3% and half-width offset (1.15%), per the spec's verified math.

- [ ] **Step 1: Append to `WebScaleEditor/style.css`**

```css
.piano {
  position: relative;
  display: grid;
  grid-template-columns: repeat(28, 1fr);
  height: 140px;
  background: var(--bg-0);
  border-radius: 5px;
  overflow: hidden;
  user-select: none;
}
.pk-white {
  background: #e8e8e8;
  border-right: 1px solid #aaa;
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 6px;
  font-size: 10px; color: #555;
  cursor: pointer;
}
.pk-white:last-of-type { border-right: 0; }
.pk-white.root { background: #ffd5b3; color: #663300; font-weight: 600; }
.pk-white.on   { background: #ffb84d; }
.pk-white.root.on { background: #ff6a3d; color: #fff; }

.pk-black {
  position: absolute; top: 0; width: 2.3%; height: 62%;
  background: #1c1c2a;
  border-radius: 0 0 3px 3px;
  z-index: 2;
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 4px;
  font-size: 9px; color: #ccc;
  cursor: pointer;
}
/* IMPORTANT: black-key "on" tint differs from white-key tint so the
   highlighted blacks remain visually distinct against highlighted whites. */
.pk-black.on { background: #b87a1f; color: #fff; }

.octave-ruler {
  display: grid; grid-template-columns: repeat(4, 1fr);
  font-size: 10px; color: var(--fg-2);
  text-transform: uppercase; letter-spacing: 1px;
  margin-top: 6px; margin-bottom: 14px;
}
.octave-ruler div {
  text-align: center; padding: 2px 0;
  border-right: 1px dashed var(--bg-3);
}
.octave-ruler div:last-child { border-right: 0; }
```

- [ ] **Step 2: Visual check**

Reload `index.html`. The piano region is empty (we haven't rendered keys yet) but its container is correctly styled — a 140px-tall dark rectangle with the octave ruler underneath.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/style.css
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: piano keyboard CSS

4-octave grid + absolutely-positioned black keys. White and black
selected tints intentionally differ so highlighted blacks stay
distinguishable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: CSS — LED editor, validation strip, dialogs, animations

**Files:**
- Modify: `WebScaleEditor/style.css`

- [ ] **Step 1: Append to `WebScaleEditor/style.css`**

```css
.led-editor {
  display: flex; gap: 14px; align-items: center;
  background: var(--bg-2);
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.led-control {
  display: flex; align-items: center; gap: 8px;
  color: var(--fg-1); font-size: 13px;
}
.led-control input[type="color"] {
  width: 38px; height: 26px;
  background: transparent;
  border: 1px solid var(--bg-3);
  border-radius: 3px;
  padding: 0; cursor: pointer;
}
.led-preview {
  width: 64px; height: 26px;
  border-radius: 3px;
  background: linear-gradient(180deg, #000, #000);  /* placeholder, updated by JS */
  background-origin: border-box;
  background-repeat: no-repeat;
  border: 1px solid var(--bg-3);
}
.emphasize-toggle {
  display: flex; align-items: center; gap: 6px;
  color: var(--fg-1); font-size: 13px; cursor: pointer;
}
.btn-clear {
  margin-left: auto;
  background: var(--bg-3);
  color: var(--fg-0);
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.btn-clear:hover { background: #44446a; }

.validation-strip {
  font-size: 12px;
  color: var(--fg-2);
  padding: 6px 0;
}
.validation-strip .ok { color: var(--ok); }
.validation-strip .warn {
  color: var(--warn);
  display: block;
  background: var(--warn-bg);
  border-left: 3px solid var(--warn);
  padding: 6px 10px;
  border-radius: 3px;
  margin-bottom: 4px;
}

/* Dialog */
.dialog-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 10;
}
.dialog {
  background: var(--bg-1);
  border: 1px solid var(--bg-3);
  border-radius: 10px;
  padding: 18px 20px;
  width: 480px; max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45);
}
.dialog-title { margin: 0 0 4px; color: var(--fg-0); }
.dialog-lead { color: var(--fg-2); font-size: 12px; margin: 0 0 14px; }
.dialog-picker {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px;
  background: var(--bg-0); padding: 8px; border-radius: 6px;
  margin-bottom: 14px;
}
.dialog-pill {
  position: relative;
  width: 100%; aspect-ratio: 3/4;
  border-radius: 5px;
  font-size: 11px; font-weight: 600;
  color: #fff;
  text-shadow: 0 0 3px rgba(0,0,0,0.85);
  cursor: pointer;
  border: 2px solid transparent;
  background-origin: border-box;
  background-repeat: no-repeat;
  display: flex; align-items: center; justify-content: center;
}
.dialog-pill.selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--accent);
}
.dialog-pill.self {
  opacity: 0.35; cursor: not-allowed; filter: grayscale(0.4);
}
.dialog-options {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 12px;
}
.dialog-options label {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--bg-2);
  border-radius: 5px;
  font-size: 13px; cursor: pointer;
}
.dialog-warning {
  background: var(--warn-bg);
  border-left: 3px solid var(--warn);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #e6c89a;
  margin-bottom: 14px;
}
.dialog-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
.dialog-actions button {
  padding: 7px 14px;
  border-radius: 5px;
  border: 1px solid var(--bg-3);
  background: var(--bg-2);
  color: var(--fg-0);
  cursor: pointer;
  font-size: 13px;
}
.dialog-actions button:hover:not(:disabled) { background: var(--bg-3); }
.dialog-actions button#dialog-confirm {
  background: var(--accent); border-color: var(--accent);
  color: var(--accent-fg);
}
.dialog-actions button:disabled { opacity: 0.4; cursor: not-allowed; }

/* Undo "return to saved" indicator */
.toolbar button.saved-hint {
  box-shadow: inset 0 0 0 2px var(--ok);
}
```

- [ ] **Step 2: Reload `index.html` and visually verify**

You should see: LED editor row (color pickers + preview swatch + checkbox + Clear button), validation strip below, dialog backdrop hidden. Resize the window — layout should remain coherent.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/style.css
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: LED editor, validation, dialog CSS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 3 — App wiring (app.js)

`app.js` grows substantially in this phase. Each task adds one feature and re-runs a brief manual test.

## Task 15: app.js bootstrap — state initialization and render skeleton

**Files:**
- Modify: `WebScaleEditor/app.js`

Set up the state object and a `renderAll()` function that other tasks will extend. No interactions yet.

- [ ] **Step 1: Replace `app.js` content**

```js
import {
  createDefaultSlots,
  deepCloneSlots,
  slotsEqual,
  validateSlot,
  FACTORY_PRESETS,
  parseScaleFile,
  serializeScaleFile,
  applyToSlot,
  clearSlot,
} from './core.js';

// --- State -------------------------------------------------------------

const state = {
  slots: createDefaultSlots(),
  currentSlotIndex: 0,
  undoStack: [],          // { snapshot, reason }
  redoStack: [],
  savedSnapshot: null,    // set by Load/Save; null means "never loaded/saved"
};
state.savedSnapshot = deepCloneSlots(state.slots);

// --- DOM refs ----------------------------------------------------------

const $ = (id) => document.getElementById(id);
const els = {
  dirty:      $('dirty-indicator'),
  errorBanner:$('error-banner'),
  btnLoad:    $('btn-load'),
  btnSave:    $('btn-save'),
  btnUndo:    $('btn-undo'),
  btnRedo:    $('btn-redo'),
  btnCopy:    $('btn-copy'),
  btnPreset:  $('btn-preset'),
  btnClear:   $('btn-clear'),
  fileInput:  $('file-input'),
  slotStrip:  $('slot-strip'),
  editorTitle:$('editor-title'),
  piano:      $('piano'),
  led1:       $('led1-input'),
  led2:       $('led2-input'),
  ledPreview: $('led-preview'),
  rootEmph:   $('root-emphasize-input'),
  validation: $('validation-strip'),
  dialogBackdrop: $('dialog-backdrop'),
  dialog:         $('dialog'),
  dialogTitle:    $('dialog-title'),
  dialogLead:     $('dialog-lead'),
  dialogPicker:   $('dialog-picker'),
  dialogCbNotes:  $('dialog-cb-notes'),
  dialogCbColors: $('dialog-cb-colors'),
  dialogCbNotesLabel:  $('dialog-cb-notes-label'),
  dialogCbColorsLabel: $('dialog-cb-colors-label'),
  dialogWarning: $('dialog-warning'),
  dialogCancel:  $('dialog-cancel'),
  dialogConfirm: $('dialog-confirm'),
};

// --- Helpers -----------------------------------------------------------

function isDirty() {
  return !slotsEqual(state.slots, state.savedSnapshot);
}

function rgbToHex(c) {
  const cl = (n) => Math.max(0, Math.min(255, n));
  return '#' + [cl(c.r), cl(c.g), cl(c.b)]
    .map(x => x.toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function rgbCss(c) { return `rgb(${c.r}, ${c.g}, ${c.b})`; }
function slotGradient(s) {
  return `linear-gradient(180deg, ${rgbCss(s.led1)}, ${rgbCss(s.led2)})`;
}

// --- Renderers (filled in by later tasks) ------------------------------

function renderSlotStrip() { /* Task 16 */ }
function renderPiano()     { /* Task 17 */ }
function renderLedEditor() { /* Task 19 */ }
function renderValidation(){ /* Task 21 */ }
function renderToolbar()   { /* Task 24+27 */ }
function renderDirty() {
  els.dirty.hidden = !isDirty();
}
function renderAll() {
  renderSlotStrip();
  renderPiano();
  renderLedEditor();
  renderValidation();
  renderToolbar();
  renderDirty();
  els.editorTitle.textContent = `Slot ${String(state.currentSlotIndex).padStart(2, '0')}`;
}

renderAll();
console.log('[WebScaleEditor] booted, 16 default slots');
```

- [ ] **Step 2: Reload the page and check DevTools console**

Expected: `[WebScaleEditor] booted, 16 default slots`. No JS errors. UI looks the same as Task 14 (empty piano, default-color LED swatches).

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: app.js bootstrap with state and render skeleton

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Slot strip render + click to switch

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Replace the `renderSlotStrip` stub with**

```js
function renderSlotStrip() {
  els.slotStrip.innerHTML = '';
  for (let i = 0; i < state.slots.length; i++) {
    const s = state.slots[i];
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'slot-pill' + (i === state.currentSlotIndex ? ' active' : '');
    pill.style.background = slotGradient(s);
    pill.style.backgroundOrigin = 'border-box';
    pill.style.backgroundRepeat = 'no-repeat';
    pill.textContent = String(i).padStart(2, '0');
    pill.title = `Slot ${i} · ${s.notes.size} note${s.notes.size === 1 ? '' : 's'}`;
    pill.addEventListener('click', () => {
      state.currentSlotIndex = i;
      renderAll();
    });
    els.slotStrip.appendChild(pill);
  }
}
```

- [ ] **Step 2: Reload page; verify**

You should see 16 black/dark pills (LEDs default to off so the gradient is black-to-black). The first pill (00) has the active ring. Clicking any pill moves the ring to it.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: slot strip renders + click switches active slot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Piano keyboard render

**Files:**
- Modify: `WebScaleEditor/app.js`

Renders 28 white + 20 black keys for 4 octaves (semitones 0–47). Root keys (0, 12, 24, 36) get the `.root` class.

White key semitones (0-indexed grid column → semitone): C D E F G A B per octave:
- Octave o (0..3) white positions: `[0+12o, 2+12o, 4+12o, 5+12o, 7+12o, 9+12o, 11+12o]`

Black keys positioned at white-boundary % offsets, half-width left of the boundary. With 28 white columns, each boundary `N` is at `(N * 100/28)%` from the left. With black-key width 2.3%, the left position is `(N * 100/28 - 1.15)%`.

The 5 black keys per octave are at white-key boundaries 1, 2, 4, 5, 6 (zero-indexed within the octave), with semitones 1, 3, 6, 8, 10.

- [ ] **Step 1: Replace the `renderPiano` stub with**

```js
const WHITE_SEMITONES_PER_OCTAVE = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEY_OFFSETS = [
  // [white boundary within octave (1..6), semitone offset within octave]
  [1, 1], [2, 3], [4, 6], [5, 8], [6, 10],
];
const BLACK_WIDTH_PCT = 2.3;
const BLACK_HALF_PCT = BLACK_WIDTH_PCT / 2;

function isRootSemitone(n) { return n % 12 === 0; }

function renderPiano() {
  els.piano.innerHTML = '';
  const slot = state.slots[state.currentSlotIndex];

  // White keys, 28 of them.
  for (let oct = 0; oct < 4; oct++) {
    for (let i = 0; i < WHITE_SEMITONES_PER_OCTAVE.length; i++) {
      const n = WHITE_SEMITONES_PER_OCTAVE[i] + 12 * oct;
      const k = document.createElement('div');
      k.className = 'pk-white'
        + (slot.notes.has(n) ? ' on' : '')
        + (isRootSemitone(n) ? ' root' : '');
      k.textContent = String(n);
      k.dataset.note = String(n);
      k.addEventListener('click', () => togglePianoNote(n));
      els.piano.appendChild(k);
    }
  }

  // Black keys, 20 of them, absolutely positioned.
  for (let oct = 0; oct < 4; oct++) {
    const whiteBase = oct * 7;
    for (const [boundaryWithinOct, semWithinOct] of BLACK_KEY_OFFSETS) {
      const boundaryN = whiteBase + boundaryWithinOct;
      const semitone = 12 * oct + semWithinOct;
      const leftPct = (boundaryN * 100 / 28) - BLACK_HALF_PCT;
      const k = document.createElement('div');
      k.className = 'pk-black' + (slot.notes.has(semitone) ? ' on' : '');
      k.style.left = leftPct.toFixed(3) + '%';
      k.textContent = String(semitone);
      k.dataset.note = String(semitone);
      k.addEventListener('click', () => togglePianoNote(semitone));
      els.piano.appendChild(k);
    }
  }
}

// Stub — implemented in Task 18.
function togglePianoNote(_n) { /* Task 18 */ }
```

- [ ] **Step 2: Reload, verify visually**

You should see a 4-octave piano keyboard with 28 white keys and 20 black keys properly aligned. No "on" highlights yet (current slot is empty). Numbers 0, 12, 24, 36 should have the warm root tint.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: render 4-octave piano keyboard

28 white + 20 black keys with verified math for black-key positions.
Root semitones (0/12/24/36) highlighted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Piano click toggles notes (with `commit()` helper)

**Files:**
- Modify: `WebScaleEditor/app.js`

Introduce the `commit(reason)` helper that pushes the *current* slots snapshot to `undoStack` BEFORE the mutation happens. Then mutate. This is how every state-changing operation in later tasks will work.

- [ ] **Step 1: Above the renderers, add the `commit` helper**

```js
const UNDO_LIMIT = 100;

function commit(reason) {
  state.undoStack.push({ snapshot: deepCloneSlots(state.slots), reason });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  state.redoStack.length = 0;
}
```

- [ ] **Step 2: Replace the `togglePianoNote` stub with the real implementation**

```js
function togglePianoNote(n) {
  const slot = state.slots[state.currentSlotIndex];
  commit(`toggle note ${n} in slot ${state.currentSlotIndex}`);
  // Replace slot with a new object so undo snapshots remain correct.
  const newSlot = {
    led1: { ...slot.led1 }, led2: { ...slot.led2 },
    rootEmphasize: slot.rootEmphasize,
    notes: new Set(slot.notes),
  };
  if (newSlot.notes.has(n)) newSlot.notes.delete(n);
  else newSlot.notes.add(n);
  state.slots[state.currentSlotIndex] = newSlot;
  renderAll();
}
```

- [ ] **Step 3: Reload page, click some keys**

Verify: clicking a white key adds the orange "on" highlight; clicking it again removes it. Clicking a black key adds a brown "on" highlight (visually distinct from white "on"). Hovering the slot pill tooltip should update its note count.

- [ ] **Step 4: Switch slots and verify isolation**

Click 4–5 notes on slot 00, click slot 03, the piano clears (slot 03 is empty). Click back to slot 00 — the notes you set are still there.

- [ ] **Step 5: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: piano click toggles notes + commit() helper

Each toggle pushes a snapshot to the undo stack.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: LED editor wiring + gradient preview

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Replace the `renderLedEditor` stub**

```js
function renderLedEditor() {
  const slot = state.slots[state.currentSlotIndex];
  els.led1.value = rgbToHex(slot.led1);
  els.led2.value = rgbToHex(slot.led2);
  els.rootEmph.checked = slot.rootEmphasize;
  els.ledPreview.style.background = slotGradient(slot);
}
```

- [ ] **Step 2: Add change handlers below `renderAll()`** (at the bottom of the file, before the final `renderAll()` call)

```js
// Use 'change' (fires once on picker dismiss), NOT 'input' (fires while
// dragging — would flood the undo stack).
els.led1.addEventListener('change', (e) => {
  commit('change LED 1 color');
  const slot = state.slots[state.currentSlotIndex];
  state.slots[state.currentSlotIndex] = { ...slot, led1: hexToRgb(e.target.value) };
  renderAll();
});
els.led2.addEventListener('change', (e) => {
  commit('change LED 2 color');
  const slot = state.slots[state.currentSlotIndex];
  state.slots[state.currentSlotIndex] = { ...slot, led2: hexToRgb(e.target.value) };
  renderAll();
});
els.rootEmph.addEventListener('change', (e) => {
  commit('toggle root emphasize');
  const slot = state.slots[state.currentSlotIndex];
  state.slots[state.currentSlotIndex] = { ...slot, rootEmphasize: e.target.checked };
  renderAll();
});
```

- [ ] **Step 3: Reload, manually test**

Pick a color for LED 1; the LED gradient preview updates, the slot pill in the strip turns that color (at top, with LED 2's color at bottom). Toggle Root Emphasize — checkbox state persists when switching slots.

- [ ] **Step 4: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: LED color pickers, gradient preview, root emphasize

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Validation strip

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Replace the `renderValidation` stub**

```js
function renderValidation() {
  const slot = state.slots[state.currentSlotIndex];
  const warns = validateSlot(slot);
  els.validation.innerHTML = '';
  if (warns.length === 0) {
    const ok = document.createElement('span');
    ok.className = 'ok';
    ok.textContent = '✓ OK';
    els.validation.appendChild(ok);
  } else {
    for (const w of warns) {
      const div = document.createElement('div');
      div.className = 'warn';
      div.textContent = '⚠ ' + w;
      els.validation.appendChild(div);
    }
  }
}
```

- [ ] **Step 2: Reload, verify**

Empty slot → "⚠ Scale is empty". Add a note 0 → still empty? No, "Scale is empty" goes away. Enable Root Emphasize with only notes < 12 → silence warning appears. Add note 12 → silence warning disappears.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: validation strip surfaces per-slot warnings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Clear button

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add handler at the bottom of `app.js`**

```js
els.btnClear.addEventListener('click', () => {
  const slot = state.slots[state.currentSlotIndex];
  if (slot.notes.size > 0) {
    const ok = confirm(`Clear all ${slot.notes.size} note${slot.notes.size === 1 ? '' : 's'} from slot ${state.currentSlotIndex}? (LED colors and Root Emphasize will be preserved.)`);
    if (!ok) return;
  }
  commit(`clear notes in slot ${state.currentSlotIndex}`);
  state.slots = clearSlot(state.slots, state.currentSlotIndex);
  renderAll();
});
```

- [ ] **Step 2: Reload, test**

Click a few notes on a slot → click Clear → confirm dialog → notes cleared. LED colors and Root Emphasize unchanged. Clear button on already-empty slot just runs without a confirm prompt and is effectively a no-op.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: Clear button (with confirm when notes exist)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Save button (download `scale.txt`)

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add at the bottom of `app.js`**

```js
els.btnSave.addEventListener('click', () => {
  const text = serializeScaleFile(state.slots);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scale.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  state.savedSnapshot = deepCloneSlots(state.slots);
  renderAll();
});
```

- [ ] **Step 2: Manual test**

Click Save with the default empty state → `scale.txt` downloads. Open it in a text editor — should contain 16 lines, each `0 0 0 0 0 0 0` followed by a newline.

Click a piano note → dirty indicator appears. Click Save → indicator disappears.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: Save downloads scale.txt and updates savedSnapshot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: Load button (file picker → parse → state replace) + error banner

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add at the bottom of `app.js`**

```js
function showErrorBanner(messages) {
  els.errorBanner.hidden = false;
  els.errorBanner.textContent = messages.join('\n');
}
function clearErrorBanner() {
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = '';
}

els.btnLoad.addEventListener('click', () => {
  if (isDirty()) {
    const ok = confirm('You have unsaved changes. Discard them and load a new file?');
    if (!ok) return;
  }
  els.fileInput.value = '';
  els.fileInput.click();
});

els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const { slots, errors } = parseScaleFile(text);
  if (errors.length > 0 || !slots) {
    showErrorBanner(['Could not load file:', ...errors]);
    return;
  }
  clearErrorBanner();
  state.slots = slots;
  state.savedSnapshot = deepCloneSlots(slots);
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  state.currentSlotIndex = 0;
  renderAll();
});
```

- [ ] **Step 2: Manual test**

Click Load → file picker opens. Select `factoryPreset/scale.txt` from the repo. 16 slots appear with the factory's gradients and the first slot (Major(R)) loads into the editor with its 9 notes highlighted.

Now try loading a deliberately broken file: in a terminal, run `echo "garbage" > /tmp/bad.txt`, then load it. Error banner should appear with "Could not load file: Expected 16 lines, got 1". State unchanged.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: Load file + error banner

Replaces state on success, surfaces parser errors on failure without
mutating state, warns before discarding unsaved changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: Undo and Redo

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Replace the `renderToolbar` stub**

```js
function renderToolbar() {
  els.btnUndo.disabled = state.undoStack.length === 0;
  els.btnRedo.disabled = state.redoStack.length === 0;

  const undoTop = state.undoStack[state.undoStack.length - 1];
  els.btnUndo.title = undoTop
    ? (state.savedSnapshot && slotsEqual(undoTop.snapshot, state.savedSnapshot)
        ? 'Undo to last saved state'
        : `Undo: ${undoTop.reason}`)
    : 'Nothing to undo';

  const redoTop = state.redoStack[state.redoStack.length - 1];
  els.btnRedo.title = redoTop
    ? (state.savedSnapshot && slotsEqual(redoTop.snapshot, state.savedSnapshot)
        ? 'Redo to last saved state'
        : `Redo: ${redoTop.reason}`)
    : 'Nothing to redo';

  // "Return to saved" indicator
  const undoLeadsToSaved = undoTop && state.savedSnapshot && slotsEqual(undoTop.snapshot, state.savedSnapshot);
  const redoLeadsToSaved = redoTop && state.savedSnapshot && slotsEqual(redoTop.snapshot, state.savedSnapshot);
  els.btnUndo.classList.toggle('saved-hint', !!undoLeadsToSaved);
  els.btnRedo.classList.toggle('saved-hint', !!redoLeadsToSaved);
}
```

- [ ] **Step 2: Add the click handlers at the bottom of `app.js`**

```js
els.btnUndo.addEventListener('click', () => {
  if (state.undoStack.length === 0) return;
  const entry = state.undoStack.pop();
  state.redoStack.push({ snapshot: deepCloneSlots(state.slots), reason: entry.reason });
  state.slots = entry.snapshot;     // Already a deep clone from when it was pushed.
  renderAll();
});
els.btnRedo.addEventListener('click', () => {
  if (state.redoStack.length === 0) return;
  const entry = state.redoStack.pop();
  state.undoStack.push({ snapshot: deepCloneSlots(state.slots), reason: entry.reason });
  state.slots = entry.snapshot;
  renderAll();
});
```

- [ ] **Step 3: Manual test**

Make 3 piano-note changes → Undo button enables. Click Undo three times → all notes gone, Undo disabled, Redo button enabled. Hover the buttons — tooltips show the action reasons.

Load the factory file → make one change → the Undo button should have the green "saved-hint" outline (one undo leads back to the saved state).

- [ ] **Step 4: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: undo/redo with reason tooltips and "return to saved" indicator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 25: `beforeunload` guard

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add at the bottom of `app.js`**

```js
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
```

- [ ] **Step 2: Manual test**

Make any change → try to close the tab or navigate away → browser should warn. Save → try again → no warning.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: warn before discarding unsaved changes on tab close

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 26: Dialog framework (open, close, populate)

**Files:**
- Modify: `WebScaleEditor/app.js`

This task wires the shared dialog used by both Copy-to and Apply-preset. The function `openDialog(opts)` configures the modal and returns when the user confirms or cancels.

`opts` contains:
- `title` — string
- `lead` — short instruction string
- `cbNotesLabel` — label for the first checkbox (e.g. "Copy notes")
- `cbColorsLabel` — label for the second checkbox
- `pickerEntries` — array of `{ label, slot, disabled }` — slot is used for the gradient and `label` is shown if non-empty (used by preset dialog for names)
- `onSelectionChange(selectedIndex, { notes, colors })` — called whenever picker or checkboxes change; returns a warning string or empty
- `onConfirm(selectedIndex, { notes, colors })` — called on confirm; should return `true` to close the dialog

- [ ] **Step 1: Add to the bottom of `app.js`**

```js
let dialogState = null;   // active dialog session

function openDialog(opts) {
  dialogState = {
    selectedIndex: -1,
    opts,
  };
  els.dialogTitle.textContent = opts.title;
  els.dialogLead.textContent = opts.lead;
  els.dialogCbNotesLabel.textContent = opts.cbNotesLabel;
  els.dialogCbColorsLabel.textContent = opts.cbColorsLabel;
  els.dialogCbNotes.checked = true;
  els.dialogCbColors.checked = true;

  // Build picker.
  els.dialogPicker.innerHTML = '';
  opts.pickerEntries.forEach((entry, i) => {
    const p = document.createElement('button');
    p.type = 'button';
    p.className = 'dialog-pill' + (entry.disabled ? ' self' : '');
    p.style.background = slotGradient(entry.slot);
    p.style.backgroundOrigin = 'border-box';
    p.style.backgroundRepeat = 'no-repeat';
    p.textContent = entry.label || String(i).padStart(2, '0');
    if (entry.disabled) {
      p.disabled = true;
    } else {
      p.addEventListener('click', () => {
        dialogState.selectedIndex = i;
        for (const child of els.dialogPicker.children) {
          child.classList.toggle('selected', child === p);
        }
        refreshDialog();
      });
    }
    els.dialogPicker.appendChild(p);
  });

  refreshDialog();
  els.dialogBackdrop.hidden = false;
}

function refreshDialog() {
  const { selectedIndex, opts } = dialogState;
  const flags = { notes: els.dialogCbNotes.checked, colors: els.dialogCbColors.checked };
  const warning = (selectedIndex >= 0)
    ? (opts.onSelectionChange ? opts.onSelectionChange(selectedIndex, flags) : '')
    : '';
  els.dialogWarning.hidden = !warning;
  els.dialogWarning.textContent = warning;
  els.dialogConfirm.disabled = !(selectedIndex >= 0 && (flags.notes || flags.colors));
}

function closeDialog() {
  els.dialogBackdrop.hidden = true;
  dialogState = null;
}

els.dialogCbNotes.addEventListener('change', () => dialogState && refreshDialog());
els.dialogCbColors.addEventListener('change', () => dialogState && refreshDialog());
els.dialogCancel.addEventListener('click', closeDialog);
els.dialogConfirm.addEventListener('click', () => {
  if (!dialogState || dialogState.selectedIndex < 0) return;
  const { selectedIndex, opts } = dialogState;
  const flags = { notes: els.dialogCbNotes.checked, colors: els.dialogCbColors.checked };
  if (opts.onConfirm(selectedIndex, flags) !== false) closeDialog();
});

// Close on backdrop click or Escape.
els.dialogBackdrop.addEventListener('click', (e) => {
  if (e.target === els.dialogBackdrop) closeDialog();
});
window.addEventListener('keydown', (e) => {
  if (!els.dialogBackdrop.hidden && e.key === 'Escape') closeDialog();
});
```

- [ ] **Step 2: No manual visible behavior yet** — the next tasks invoke `openDialog`.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: shared dialog framework for copy-to and apply-preset

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 27: Flash helper for slot pills

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add at the bottom of `app.js`**

```js
function flashSlotPill(index) {
  // Find the pill in the strip by its child index after a render.
  const pill = els.slotStrip.children[index];
  if (!pill) return;
  pill.classList.remove('flash');
  // Force a reflow so the animation re-runs even if class was just removed.
  // eslint-disable-next-line no-unused-expressions
  pill.offsetWidth;
  pill.classList.add('flash');
}
```

- [ ] **Step 2: No manual test yet** (used by next task).

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: flashSlotPill helper for copy-to / preset confirmations

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 28: "Copy to…" dialog wired to applyToSlot

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add the click handler at the bottom of `app.js`**

```js
function describeReplacement(targetSlot, flags) {
  const bits = [];
  if (flags.notes && targetSlot.notes.size > 0) {
    bits.push(`${targetSlot.notes.size} note${targetSlot.notes.size === 1 ? '' : 's'}`);
  }
  if (flags.colors) {
    const hasColor = targetSlot.led1.r || targetSlot.led1.g || targetSlot.led1.b ||
                     targetSlot.led2.r || targetSlot.led2.g || targetSlot.led2.b;
    if (hasColor) bits.push('LED colors');
  }
  if (bits.length === 0) return '';
  return `⚠ Existing ${bits.join(' and ')} will be replaced.`;
}

els.btnCopy.addEventListener('click', () => {
  const sourceIdx = state.currentSlotIndex;
  const sourceSlot = state.slots[sourceIdx];
  openDialog({
    title: `Copy slot ${sourceIdx} to…`,
    lead: 'Pick a destination slot, then choose what to copy.',
    cbNotesLabel: 'Copy notes (includes the Root Emphasize flag)',
    cbColorsLabel: 'Copy LED colors',
    pickerEntries: state.slots.map((s, i) => ({
      label: String(i).padStart(2, '0'),
      slot: s,
      disabled: i === sourceIdx,
    })),
    onSelectionChange(targetIdx, flags) {
      return describeReplacement(state.slots[targetIdx], flags);
    },
    onConfirm(targetIdx, flags) {
      commit(`copy slot ${sourceIdx} to slot ${targetIdx}`);
      state.slots = applyToSlot(state.slots, sourceSlot, targetIdx, flags);
      renderAll();
      flashSlotPill(targetIdx);
      return true;
    },
  });
});
```

- [ ] **Step 2: Manual test**

Load factory file. Slot 00 (Major(R)) should be active. Click Copy to → dialog opens, slot 00 is grayed. Pick slot 11. Uncheck "Copy LED colors". Dynamic warning should update to mention only the notes. Confirm. Slot 11 should now have Major(R)'s notes but keep its own LED colors. The slot 11 pill in the strip flashes 3 times.

Try with both checkboxes off → confirm button stays disabled.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: Copy-to dialog with selective notes/colors and flash

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 29: "Apply preset…" dialog

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add at the bottom of `app.js`**

```js
els.btnPreset.addEventListener('click', () => {
  const targetIdx = state.currentSlotIndex;
  openDialog({
    title: `Apply preset to slot ${targetIdx}…`,
    lead: 'Pick a factory preset, then choose what to apply.',
    cbNotesLabel: 'Apply notes (includes the Root Emphasize flag)',
    cbColorsLabel: 'Apply LED colors',
    pickerEntries: FACTORY_PRESETS.map(p => ({
      label: p.name,
      slot: p.slot,
      disabled: false,
    })),
    onSelectionChange(_presetIdx, flags) {
      return describeReplacement(state.slots[targetIdx], flags);
    },
    onConfirm(presetIdx, flags) {
      commit(`apply preset "${FACTORY_PRESETS[presetIdx].name}" to slot ${targetIdx}`);
      state.slots = applyToSlot(state.slots, FACTORY_PRESETS[presetIdx].slot, targetIdx, flags);
      renderAll();
      flashSlotPill(targetIdx);
      return true;
    },
  });
});
```

- [ ] **Step 2: Manual test**

With an empty state: select slot 03. Click Apply preset → dialog shows 16 preset pills with names. Pick "Major Pentatonic(R)". Confirm. Slot 03 picks up the preset's colors and notes; current slot pill flashes.

Undo. Notes restored to empty. Redo. Notes back.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: Apply preset dialog wired to FACTORY_PRESETS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 30: Keyboard shortcuts

**Files:**
- Modify: `WebScaleEditor/app.js`

- [ ] **Step 1: Add at the bottom of `app.js`**

```js
window.addEventListener('keydown', (e) => {
  // Skip when typing in a form field.
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    // Allow Ctrl/Cmd-S even in inputs.
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) return;
  }
  // Don't interfere when a dialog is open (it handles its own Escape).
  if (!els.dialogBackdrop.hidden) return;

  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    els.btnUndo.click();
  } else if (mod && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y')) {
    e.preventDefault();
    els.btnRedo.click();
  } else if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    els.btnSave.click();
  } else if (e.key === 'ArrowLeft' && !mod) {
    e.preventDefault();
    state.currentSlotIndex = (state.currentSlotIndex + 15) % 16;
    renderAll();
  } else if (e.key === 'ArrowRight' && !mod) {
    e.preventDefault();
    state.currentSlotIndex = (state.currentSlotIndex + 1) % 16;
    renderAll();
  }
});
```

- [ ] **Step 2: Manual test**

Press ←/→ to scroll through slots. Make a change, press Ctrl/⌘+Z to undo, Ctrl/⌘+Shift+Z to redo. Ctrl/⌘+S triggers Save.

- [ ] **Step 3: Commit**

```bash
git add WebScaleEditor/app.js
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: keyboard shortcuts (Ctrl/Cmd Z/Y/S, arrows)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 4 — Docs and integration

## Task 31: WebScaleEditor README

**Files:**
- Modify: `WebScaleEditor/README.md`

- [ ] **Step 1: Replace `WebScaleEditor/README.md` content with**

```markdown
# Helical Web Scale Editor

A browser-based editor for the Helical eurorack module's `scale.txt` SD-card file. Works on any modern browser (Chrome, Firefox, Safari, Edge) with no install required.

## Usage

1. Open `index.html` in any modern browser, or visit a hosted copy (see "Hosting" below).
2. Click **📂 Load** and pick your `scale.txt` (typically copied from the SD card). The editor will load all 16 slots.
3. Click any slot in the strip below the toolbar to edit it.
4. Click piano keys to toggle notes. Use the LED color pickers to set the slot's two colors. Toggle Root Emphasize as needed.
5. **⎘ Copy to…** copies the current slot's notes and/or LED colors to another slot.
6. **📚 Apply preset…** drops in one of the 16 factory scales (Major, Lydian, Whole tone, etc.).
7. **↶ Undo / ↷ Redo** revert and replay changes. When undoing once would return you to the last saved/loaded state, the Undo button has a green outline.
8. Click **💾 Save** to download an updated `scale.txt`. Copy it back to your SD card to use it on the module.

## Keyboard shortcuts

- **Ctrl/⌘ + Z** — Undo
- **Ctrl/⌘ + Shift + Z** (or **Ctrl/⌘ + Y**) — Redo
- **Ctrl/⌘ + S** — Save
- **← / →** — Previous / next slot

## Hosting

If you'd like a public link instead of opening the file locally, host this folder on any static web host (GitHub Pages, Netlify, Cloudflare Pages, etc.). The editor is one HTML file plus a few JS/CSS files — no build step, no server-side code.

If the parent repo has GitHub Pages enabled, the editor is automatically available at `<org>.github.io/Helical/WebScaleEditor/`.

## For developers

The editor is two ES modules:

- `core.js` — pure logic (parser, serializer, validation, state operations). No DOM.
- `app.js` — DOM wiring. Imports `core.js`.

Plus `index.html`, `style.css`, and `tests.js`.

### Running the test suite

Requires Node 18 or newer (no other dependencies, no `npm install`):

```bash
node --test WebScaleEditor/tests.js
```

The tests cover the pure functions in `core.js` — parsing, serializing, validation, and state operations — including a round-trip against the factory `scale.txt`.

### Manual UI test plan

Run after any change to `app.js`, `index.html`, or `style.css`:

- [ ] Open `index.html`. 16 black slot pills, empty piano, dirty indicator hidden.
- [ ] Load `../factoryPreset/scale.txt`. All 16 pills get gradients; slot 0 (Major(R)) shows its notes on the piano with the warm root tint on semitones 0/12/24/36.
- [ ] Click a piano key — note toggles, dirty indicator appears, Undo button enables.
- [ ] Switch slots via ←/→ — editor reflects the new slot, no state leaks between slots.
- [ ] Pick LED colors — slot pill gradient updates immediately; gradient-preview swatch in the LED row updates.
- [ ] Apply preset "Whole tone" to an empty slot — notes + colors land, current slot's pill flashes.
- [ ] Uncheck "Copy LED colors" before applying — only notes change.
- [ ] Copy slot 00 to slot 11 with both checkboxes — the warning lists what will be replaced; on confirm, slot 11 flashes.
- [ ] Click Save — `scale.txt` downloads. Diff it against the original; should differ only in whatever you changed (and possibly a trailing newline on the last line).
- [ ] Make a change, refresh the page — browser warns about unsaved changes.
```

- [ ] **Step 2: Commit**

```bash
git add WebScaleEditor/README.md
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
WebScaleEditor: README with usage, hosting, dev test plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 32: Link the new editor from the main repo README

**Files:**
- Modify: `README.md` (repo root)

- [ ] **Step 1: Update the `# Scale Editing` section**

Find the existing block (around line 166–168 of `README.md`):
```markdown
# Scale Editing
Use the [Scale Editor](https://github.com/SdkcInstruments/Helical/tree/main/ScaleEditor) on GitHub.
```

Replace it with:
```markdown
# Scale Editing

Two editors are available:

- **[Web Scale Editor](https://github.com/SdkcInstruments/Helical/tree/main/WebScaleEditor)** — runs in any modern browser, no install required. Open `index.html` directly or use a hosted copy.
- **[Scale Editor (Max)](https://github.com/SdkcInstruments/Helical/tree/main/ScaleEditor)** — the original Max-based editor. Requires Max 9 or the macOS `.app` build.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git -c user.email=Jan.Kaluza@gmx.de -c user.name="Jan Kaluza (via Claude Code)" commit -m "$(cat <<'EOF'
README: link the new web scale editor alongside the Max editor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Completion checks

After all tasks, run:

```bash
# All unit tests pass:
node --test WebScaleEditor/tests.js

# Full round-trip with the factory file works end-to-end:
# 1) Open WebScaleEditor/index.html in a browser
# 2) Load factoryPreset/scale.txt
# 3) Do NOT make changes
# 4) Click Save
# 5) Diff: the only acceptable difference is the trailing newline (factory has no
#    trailing newline; our serializer adds one). All values must match.
diff <(cat factoryPreset/scale.txt) <(printf '%s' "$(cat ~/Downloads/scale.txt)")

# Branch tip:
git log --oneline web-scale-editor | head -40
```

Acceptance: tests pass, diff shows at most a trailing-newline difference, and all manual checks from the WebScaleEditor README pass.
