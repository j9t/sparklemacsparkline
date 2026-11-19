/**
 * TypeScript type definition tests
 *
 * This file is compiled by TypeScript during testing to verify that the
 * declaration files are valid and types are correctly exported and usable.
 *
 * This file is not executed—it only needs to type-check successfully.
 */

import { describeSeries, sparkline } from '../src/index.js';
import type { DescribeOptions, SparklineOptions } from '../src/index.js';

const options: SparklineOptions = {
  accent: 'red',
  axis: false,
  background: '#fff',
  classes: false,
  decorative: true,
  foreground: 'currentColor',
  height: 20,
  labels: ['2025', '2026'],
  style: 'inline',
  tight: true,
  title: 'Posts per year',
  width: 160,
};
const svg: string = sparkline([1, 2], options);

const optionsDescribe: DescribeOptions = { labels: ['2025', '2026'], title: 'Posts per year' };
const description: string = describeSeries([1, 2], optionsDescribe);

// @ts-expect-error: `style` only accepts `inline` or `external`
sparkline([1, 2], { style: 'fancy' });

// @ts-expect-error: values are numbers
sparkline(['1', '2']);

void svg;
void description;