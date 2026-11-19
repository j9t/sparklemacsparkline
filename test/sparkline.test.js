import { describe, test } from 'node:test';
import assert from 'node:assert';
import { describeSeries, sparkline } from '../src/index.js';

describe('sparkline()', () => {
  test('Returns inline-styled markup with a description by default', () => {
    assert.strictEqual(
      sparkline([4, 42, 50, 34, 13]),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 16" width="48" height="16" role="img" class="sparkline"><title>Sparkline of 5 values: rising from 4 to a peak of 50, then falling to 13</title>' +
      '<path class="sparkline-line" d="M1.44 13.51L12.72 3.54 24 1.44 35.28 5.64 46.56 11.15" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle class="sparkline-dot" cx="46.56" cy="11.15" r="1.44" fill="currentColor"/></svg>'
    );
  });

  test('Returns bare, hidden markup with `decorative` and without `classes`', () => {
    assert.strictEqual(
      sparkline([3, 0, 7], { classes: false, decorative: true, title: 'Posts per year', width: 160, height: 20 }),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 20" width="160" height="20" aria-hidden="true">' +
      '<title>Posts per year—sparkline of 3 values: falling from 3 to a low of 0, then rising to 7</title>' +
      '<path d="M1.8 11.17L80 18.2 158.2 1.8" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="158.2" cy="1.8" r="1.8" fill="currentColor"/></svg>'
    );
  });

  test('Leaves presentation to the style sheet with the “external” style', () => {
    const svg = sparkline([1, 2], { style: 'external' });
    assert.ok(svg.includes('<path class="sparkline-line" d="M1.44 8L46.56 1.44"/>'));
    assert.ok(!svg.includes('stroke='));
    assert.ok(!svg.includes('fill='));
  });

  test('Draws an axis only for a series crossing zero', () => {
    assert.ok(sparkline([-10, 5, -3, 8]).includes('<line class="sparkline-axis" x1="0" y1="7.27" x2="48" y2="7.27" stroke="currentColor" stroke-width=".5" opacity=".35"/>'));
    assert.ok(!sparkline([0, 5, 3, 8]).includes('<line'));
    assert.ok(!sparkline([-10, 5, -3, 8], { axis: false }).includes('<line'));
  });

  test('Starts the scale at zero unless `tight` is set', () => {
    const yFirst = svg => Number(svg.match(/ d="M[\d.]+ ([\d.]+)/)[1]);
    assert.ok(yFirst(sparkline([80, 89])) < 3);
    assert.strictEqual(yFirst(sparkline([80, 89], { tight: true })), 14.56);
  });

  test('Draws a flat series flat', () => {
    assert.ok(sparkline([1, 1, 1], { tight: true }).includes('d="M1.44 14.56L24 14.56 46.56 14.56"'));
  });

  test('Applies colors and a background', () => {
    const svg = sparkline([1, 2], { foreground: 'red', background: '#fff', accent: 'var(--accent)' });
    assert.ok(svg.includes('<rect width="100%" height="100%" fill="#fff"/>'));
    assert.ok(svg.includes('stroke="red"'));
    assert.ok(svg.includes('<circle class="sparkline-dot" cx="46.56" cy="1.44" r="1.44" fill="var(--accent)"/>'));
  });

  test('Leads the description with the escaped title', () => {
    assert.ok(sparkline([1, 2], { title: 'A & B' }).includes('<title>A &amp; B—sparkline of 2 values: rising from 1 to 2</title>'));
  });

  test('Names the chart through the title element only', () => {
    assert.ok(!sparkline([1, 2]).includes('aria-label'));
  });

  test('Derives the width from the number of values, within bounds', () => {
    const width = svg => Number(svg.match(/ width="([\d.]+)"/)[1]);
    assert.strictEqual(width(sparkline([1, 2])), 48);
    assert.strictEqual(width(sparkline(Array.from({ length: 21 }, (_, index) => index))), 80);
    assert.strictEqual(width(sparkline(Array.from({ length: 100 }, (_, index) => index))), 160);
  });

  test('Fails on fewer than two values', () => {
    assert.throws(() => sparkline([1]), RangeError);
    assert.throws(() => sparkline([]), RangeError);
  });

  test('Fails on values that aren’t finite numbers', () => {
    assert.throws(() => sparkline([1, NaN]), TypeError);
    assert.throws(() => sparkline([1, Infinity]), TypeError);
    assert.throws(() => sparkline(['1', '2']), TypeError);
    assert.throws(() => sparkline('1,2'), TypeError);
  });

  test('Fails on invalid options', () => {
    assert.throws(() => sparkline([1, 2], { width: 0 }), RangeError);
    assert.throws(() => sparkline([1, 2], { height: '16' }), RangeError);
    assert.throws(() => sparkline([1, 2], { style: 'fancy' }), RangeError);
    assert.throws(() => sparkline([1, 2], { foreground: 'red" onload="x' }), TypeError);
    assert.throws(() => sparkline([1, 2], { labels: ['a'] }), RangeError);
  });

  test('Fails on colors with the “external” style', () => {
    assert.throws(() => sparkline([1, 2], { style: 'external', foreground: 'red' }), /`foreground` has no effect/);
  });
});

describe('describeSeries()', () => {
  test('Describes rising, falling, and flat series', () => {
    assert.strictEqual(describeSeries([1, 5, 9]), 'Sparkline of 3 values: rising from 1 to 9');
    assert.strictEqual(describeSeries([9, 5, 1]), 'Sparkline of 3 values: falling from 9 to 1');
    assert.strictEqual(describeSeries([2, 2]), 'Sparkline of 2 values: steady at 2');
  });

  test('Describes a peak or a low between the ends', () => {
    assert.strictEqual(describeSeries([4, 42, 50, 34, 13]), 'Sparkline of 5 values: rising from 4 to a peak of 50, then falling to 13');
    assert.strictEqual(describeSeries([3, 0, 7]), 'Sparkline of 3 values: falling from 3 to a low of 0, then rising to 7');
    assert.strictEqual(describeSeries([5, 9, 1, 5]), 'Sparkline of 4 values: ranging from 1 to 9, ending at 5');
  });

  test('Leaves out turns that don’t cover part of the spread', () => {
    assert.strictEqual(describeSeries([0, 100, 100.2]), 'Sparkline of 3 values: rising from 0 to 100.2');
  });

  test('Names the span, the peak, and the low from labels, led by the title', () => {
    assert.strictEqual(
      describeSeries([4, 50, 13], { labels: ['2006', '2007', '2008'], title: 'Posts per year.' }),
      'Posts per year—sparkline of 3 values from 2006 to 2008: rising from 4 to a peak of 50 in 2007, then falling to 13'
    );
    assert.strictEqual(
      describeSeries([5, 9, 1, 5], { labels: ['a', 'b', 'c', 'd'] }),
      'Sparkline of 4 values from a to d: ranging from 1 in c to 9 in b, ending at 5'
    );
  });

  test('Formats numbers', () => {
    assert.strictEqual(describeSeries([1234.567, 0.1 + 0.2]), 'Sparkline of 2 values: falling from 1,234.57 to 0.3');
  });
});