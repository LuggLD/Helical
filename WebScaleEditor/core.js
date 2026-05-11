// Pure logic for the Helical scale editor. No DOM, no globals.
export const VERSION = '0.1.0';

export function parseScaleFile(text) {
  const errors = [];
  const warnings = [];

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
      errors.push(`line ${lineNum}: too few values (expected at least 7, got ${toks.length})`);
      continue;
    }

    const nums = [];
    let lineHadError = false;
    for (const tok of toks) {
      const n = parseInt(tok, 10);
      if (!Number.isFinite(n) || String(n) !== tok) {
        errors.push(`line ${lineNum}: non-numeric token "${tok}"`);
        lineHadError = true;
        break;
      }
      nums.push(n);
    }
    if (lineHadError) continue;

    for (let c = 0; c < 6; c++) {
      if (nums[c] < 0 || nums[c] > 255) {
        warnings.push(`line ${lineNum}: LED channel value ${nums[c]} is outside 0-255`);
      }
    }
    if (nums[6] !== 0 && nums[6] !== 1) {
      warnings.push(`line ${lineNum}: rootEmphasize flag ${nums[6]} is not 0 or 1`);
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
