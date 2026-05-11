// Pure logic for the Helical scale editor. No DOM, no globals.
export const VERSION = '0.1.0';

export function parseScaleFile(text) {
  const errors = [];
  const warnings = [];

  const lines = text
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
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
