import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { sparkline } from './sparkline.js';

const help = `Usage:
  sparklemacsparkline [options] <values>
  … | sparklemacsparkline [options]

Turns a comma- or whitespace-separated series of numbers into an SVG sparkline.
A series starting with a negative value needs \`--\` before it, after all options.

Options:
  --labels <list>     Comma-separated labels, one per value, for the description
  --title <text>      Title (tooltip, description lead, and default file name)
  --tight             Scale to the data range instead of starting at zero
  --no-zero-line      Leave out the line drawn where a series crosses zero
  --decorative        Hide the chart from assistive technology
  --no-class          Leave out class names
  --width <number>    Width (defaults to 4 per value, from 48 to 160)
  --height <number>   Height (defaults to 16)
  --style <style>     “inline” (default) or “external” (class names only)
  --foreground <css>  Line color (defaults to currentColor)
  --background <css>  Background color (none by default)
  --accent <css>      Color of the end dot (defaults to the foreground)
  --output <path>     File to write, overwriting it
  --stdout            Print the markup instead of writing a file
  --version           Show the version
  --help              Show this help

Without \`--output\` or \`--stdout\`, the file is named after the title
(“sparkline.svg” without one), and a number is added rather than overwriting.

Exit codes: 0 success, 1 no usable data, 2 error`;

const options = {
  accent: { type: 'string' },
  background: { type: 'string' },
  decorative: { type: 'boolean', default: false },
  foreground: { type: 'string' },
  height: { type: 'string' },
  help: { type: 'boolean', default: false },
  labels: { type: 'string' },
  'no-class': { type: 'boolean', default: false },
  'no-zero-line': { type: 'boolean', default: false },
  output: { type: 'string' },
  stdout: { type: 'boolean', default: false },
  style: { type: 'string' },
  tight: { type: 'boolean', default: false },
  title: { type: 'string' },
  version: { type: 'boolean', default: false },
  width: { type: 'string' }
};

// German umlauts and the sharp s spell themselves out rather than losing the
// letter—“ß” has no decomposition, so stripping marks alone would drop it
const foldingsGerman = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };

// “Posts per year” → “posts-per-year”
export function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[äöüß]/g, character => foldingsGerman[character])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'sparkline';
}

// “chart.svg” taken becomes “chart-2.svg”, then “chart-3.svg”
function findFreePath(base) {
  if (!existsSync(`${base}.svg`)) return `${base}.svg`;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}.svg`;
    if (!existsSync(candidate)) return candidate;
  }
}

// Split on commas or whitespace, so both `4,42,50` and a column of numbers work
export function parseSeries(input) {
  return input
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
}

// Reading fd 0 synchronously fails with EAGAIN on a non-blocking pipe, so
// consume the stream instead
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Strings stay strings so that `sparkline()` rejects them with its own message
function toNumber(value) {
  return value === undefined || value.trim() === '' ? value : Number(value);
}

// Returns the exit code rather than exiting, so that output gets flushed
export async function runCli(args) {
  const fail = (message, code = 2) => {
    console.error(`❌ ${message}`);
    return code;
  };

  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, options });
  } catch (err) {
    return fail(err.message);
  }
  const { values: flags, positionals } = parsed;

  if (flags.help) {
    console.log(help);
    return 0;
  }
  if (flags.version) {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(version);
    return 0;
  }
  if (flags.stdout && flags.output !== undefined) {
    return fail('`--stdout` and `--output` ask for different things—pick one.');
  }

  const input = positionals.length
    ? positionals.join(',')
    : (process.stdin.isTTY ? '' : await readStdin());
  const series = parseSeries(input);
  if (!series.length) {
    return fail('No data—pass a comma-separated list of values, or pipe them in.', 1);
  }
  if (series.some(Number.isNaN)) {
    return fail('Every value has to be a number.');
  }
  if (series.length < 2) {
    return fail('A sparkline needs at least two values.', 1);
  }

  let svg;
  try {
    svg = sparkline(series, {
      accent: flags.accent,
      background: flags.background,
      classes: !flags['no-class'],
      decorative: flags.decorative,
      foreground: flags.foreground,
      height: toNumber(flags.height),
      labels: flags.labels?.split(',').map(label => label.trim()),
      style: flags.style,
      tight: flags.tight,
      title: flags.title,
      width: toNumber(flags.width),
      zeroLine: !flags['no-zero-line']
    });
  } catch (err) {
    return fail(err.message);
  }

  if (flags.stdout) {
    process.stdout.write(svg + '\n');
    return 0;
  }

  // An explicit path is taken as given, overwriting included—only the guessed
  // name steps aside for an existing file. No trailing newline, since the byte
  // would become stray whitespace wherever the markup is inlined.
  const pathOutput = flags.output ?? findFreePath(slugify(flags.title ?? 'sparkline'));
  try {
    writeFileSync(pathOutput, svg);
  } catch (err) {
    return fail(`Could not write to “${pathOutput}”.\n   ${err.message}`);
  }
  console.error(`✅ Wrote “${pathOutput}”.`);
  return 0;
}