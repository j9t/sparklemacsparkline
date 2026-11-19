export interface DescribeOptions {
  /** One label per value, e.g., years; names the range and the peak */
  labels?: string[];
  /** What the data is; leads the description */
  title?: string;
}

export interface SparklineOptions extends DescribeOptions {
  /** Color of the end dot (defaults to `foreground`) */
  accent?: string;
  /** Background color (none by default) */
  background?: string;
  /** Set to `false` to leave out class names (defaults to `true`) */
  classes?: boolean;
  /** Set to `true` to hide the chart from assistive technology instead of describing it */
  decorative?: boolean;
  /** Line color (defaults to `currentColor`) */
  foreground?: string;
  /** Height (defaults to 16) */
  height?: number;
  /** `inline` (default) for presentation attributes, `external` for class names only */
  style?: 'inline' | 'external';
  /** Set to `true` to scale to the data range instead of starting at zero */
  tight?: boolean;
  /** Width (defaults to 4 per value, from 48 to 160) */
  width?: number;
  /** Set to `false` to leave out the line drawn where a series crosses zero (defaults to `true`) */
  zeroLine?: boolean;
}

/** Returns the sparkline as SVG markup */
export function sparkline(values: number[], options?: SparklineOptions): string;

/** Returns the text description used as the sparkline’s accessible name */
export function describeSeries(values: number[], options?: DescribeOptions): string;