const heightDefault = 16; // One rem at a typical root size
const stepDefault = 4; // Horizontal distance per data point
const widthMin = 48;
const widthMax = 160; // Past roughly this a sparkline wants to be a real chart
const widthStroke = 1.25; // Hairline at any size, which is the point of a sparkline
const radiusDotMin = 1.25;
const radiusDotMax = 4;
const ratioDot = .09; // Dot radius as a share of the height
const widthAxis = .5; // The axis stays recessive against the data
const opacityAxis = .35;

export const styles = ['inline', 'external'];

// Permissive enough for hex, functional notation, keywords, and `var(…)`, while
// keeping out the quotes and angle brackets that could break out of an attribute
const patternColor = /^[\w#(),.%/ +*-]+$/;

// Trim the leading zero of a decimal, the way a minifier would: `0.5` → `.5`
function format(number) {
  return String(number).replace(/^(-?)0\./, '$1.');
}

// For the description: `1234.567` → “1,234.57”, without float artifacts
// like `0.30000000000000004`
function formatNumber(number) {
  return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function round(number) {
  return Math.round(number * 100) / 100;
}

// A minus sign or a second decimal point already separates two numbers
function needsSpace(previous, next) {
  return !(next.startsWith('-') || (next.startsWith('.') && previous.includes('.')));
}

// The shortest path data through the points: per segment, the shortest of
// absolute and relative lineto (and their horizontal and vertical forms),
// repeating command letters only where the command changes. Relative coordinates
// come from the rounded points, so they add up to exactly the same positions.
function makePath(points) {
  // Per state—the current command and whether the last number has a decimal
  // point—the shortest path so far, as its length and its last part, which
  // links back to the ones before (no nested arrays, as series can be long)
  let states = new Map();
  const [xStart, yStart] = points[0].map(format);
  const textStart = `${xStart}${needsSpace(xStart, yStart) ? ' ' : ''}${yStart}`;
  // `m` from the origin is absolute, too, but makes the coordinates after it relative
  for (const command of ['L', 'l']) {
    const text = `${command === 'L' ? 'M' : 'm'}${textStart}`;
    states.set(command + yStart.includes('.'), { command, last: yStart, length: text.length, part: { text } });
  }

  for (let index = 1; index < points.length; index++) {
    const [x0, y0] = points[index - 1];
    const [x1, y1] = points[index];
    const dx = round(x1 - x0);
    const dy = round(y1 - y0);
    const options = [['L', [x1, y1]], ['l', [dx, dy]]];
    if (dy === 0) options.push(['H', [x1]], ['h', [dx]]);
    // Only in dense or narrow charts, where neighboring points round to the same x
    if (dx === 0) options.push(['V', [y1]], ['v', [dy]]);

    const statesNext = new Map();
    for (const state of states.values()) {
      for (const [command, numbers] of options) {
        let text = command === state.command ? '' : command;
        let last = text ? null : state.last;
        for (const number of numbers.map(format)) {
          if (last !== null && needsSpace(last, number)) text += ' ';
          text += number;
          last = number;
        }
        const key = command + last.includes('.');
        const length = state.length + text.length;
        if (!statesNext.has(key) || length < statesNext.get(key).length) {
          statesNext.set(key, { command, last, length, part: { previous: state.part, text } });
        }
      }
    }
    states = statesNext;
  }

  const parts = [];
  let { part } = [...states.values()].reduce((a, b) => (b.length < a.length ? b : a));
  for (; part; part = part.previous) parts.push(part.text);
  return parts.reverse().join('');
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function checkValues(values) {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('Every value has to be a finite number.');
  }
  if (values.length < 2) {
    throw new RangeError('A sparkline needs at least two values.');
  }
}

function checkLabels(labels, values) {
  if (labels === undefined) return;
  if (!Array.isArray(labels)) {
    throw new TypeError('`labels` has to be an array.');
  }
  if (labels.length !== values.length) {
    throw new RangeError(`Got ${labels.length} labels for ${values.length} values—they have to match.`);
  }
}

function checkColor(value, name) {
  if (value === undefined) return;
  if (typeof value !== 'string' || !patternColor.test(value)) {
    throw new TypeError(`\`${value}\` does not look like a CSS color (\`${name}\`).`);
  }
}

function checkSize(value, name) {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`\`${value}\` is not a positive number (\`${name}\`).`);
  }
}

// One pass rather than `Math.min(...values)`, which overflows the argument
// stack somewhere past 100,000 values
function findExtent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

// Describes the shape of the line for anyone who cannot see it; a title says
// what the data is, which the shape alone never conveys, so it leads
export function describeSeries(values, { labels, title } = {}) {
  checkValues(values);
  checkLabels(labels, values);

  const { min, max } = findExtent(values);
  const first = values[0];
  const last = values.at(-1);
  const span = max - min;

  // A turn is worth mentioning only once it covers part of the spread
  const exceeds = difference => difference > span * .05;
  const hasPeak = exceeds(max - first) && exceeds(max - last);
  const hasLow = exceeds(first - min) && exceeds(last - min);
  const at = value => {
    const label = labels?.[values.indexOf(value)];
    return label ? ` in ${label}` : '';
  };

  let shape;
  if (span === 0) {
    shape = `steady at ${formatNumber(first)}`;
  } else if (hasPeak && hasLow) {
    shape = `ranging from ${formatNumber(min)}${at(min)} to ${formatNumber(max)}${at(max)}, ending at ${formatNumber(last)}`;
  } else if (hasPeak) {
    shape = `rising from ${formatNumber(first)} to a peak of ${formatNumber(max)}${at(max)}, then falling to ${formatNumber(last)}`;
  } else if (hasLow) {
    shape = `falling from ${formatNumber(first)} to a low of ${formatNumber(min)}${at(min)}, then rising to ${formatNumber(last)}`;
  } else {
    // Without a turn between them, the ends are the extremes
    shape = `${last > first ? 'rising' : 'falling'} from ${formatNumber(first)} to ${formatNumber(last)}`;
  }

  const scope = labels ? ` from ${labels[0]} to ${labels.at(-1)}` : '';
  const lead = title ? `${title.replace(/[.\s]+$/, '')}—sparkline` : 'Sparkline';
  return `${lead} of ${values.length} values${scope}: ${shape}`;
}

export function sparkline(values, options = {}) {
  checkValues(values);

  const {
    accent,
    axis = true,
    background,
    classes = true,
    decorative = false,
    foreground = 'currentColor',
    height = heightDefault,
    labels,
    style = 'inline',
    tight = false,
    title,
    width = Math.min(widthMax, Math.max(widthMin, (values.length - 1) * stepDefault))
  } = options;

  checkLabels(labels, values);
  checkSize(height, 'height');
  checkSize(width, 'width');
  checkColor(foreground, 'foreground');
  checkColor(background, 'background');
  checkColor(accent, 'accent');
  if (!styles.includes(style)) {
    throw new RangeError(`Unknown style “${style}”—expected ${styles.map(name => `“${name}”`).join(' or ')}.`);
  }

  // A style sheet owns every color in external mode, so a color passed here
  // would silently do nothing
  const isInline = style === 'inline';
  const colorsPassed = ['foreground', 'background', 'accent'].filter(name => options[name] !== undefined);
  if (!isInline && colorsPassed.length) {
    throw new TypeError(`\`${colorsPassed[0]}\` has no effect with the “external” style—colors come from the style sheet there.`);
  }
  const colorAccent = accent ?? foreground;

  // Without class names the elements are addressed by type, e.g., “h2 svg path”
  const naming = suffix => classes ? ` class="sparkline${suffix}"` : '';

  // A zero baseline keeps the domain anchored, so a series on a high floor
  // reads as high rather than as filling the box
  const extent = findExtent(values);
  const domainMin = tight ? extent.min : Math.min(0, extent.min);
  const domainMax = tight ? extent.max : Math.max(0, extent.max);
  const span = domainMax - domainMin || 1; // A flat series draws flat, not NaN

  // The dot tracks the height, so that it stays visible on a tall chart without
  // swelling on a short one; the stroke stays hairline either way
  const radiusDot = round(Math.min(radiusDotMax, Math.max(radiusDotMin, height * ratioDot)));

  const padding = Math.max(widthStroke, radiusDot); // Room for the stroke and the dot
  const step = (width - padding * 2) / (values.length - 1);
  const toY = value => round(height - padding - (value - domainMin) / span * (height - padding * 2));

  const points = values.map((value, index) => [round(padding + index * step), toY(value)]);
  const [pointLastX, pointLastY] = points.at(-1);

  const d = makePath(points);

  const attributesPath = isInline
    ? ` fill="none" stroke="${escapeAttribute(foreground)}" stroke-width="${format(widthStroke)}"` +
      ' stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"'
    : '';
  const attributesDot = isInline ? ` fill="${escapeAttribute(colorAccent)}"` : '';
  const attributesAxis = isInline
    ? ` stroke="${escapeAttribute(foreground)}" stroke-width="${format(widthAxis)}" opacity="${format(opacityAxis)}"`
    : '';

  const markupBackground = background
    ? `<rect width="100%" height="100%" fill="${escapeAttribute(background)}"/>`
    : '';

  // Only worth drawing where the series actually crosses zero—with an
  // all-positive series zero is the floor already
  const crossesZero = domainMin < 0 && domainMax > 0;
  const yZero = toY(0);
  const markupAxis = axis && crossesZero
    ? `<line${naming('-axis')} y1="${format(yZero)}" x2="${format(width)}" y2="${format(yZero)}"${attributesAxis}/>`
    : '';

  const markupPath = `<path${naming('-line')} d="${d}"${attributesPath}/>`;
  const markupDot = `<circle${naming('-dot')} cx="${format(pointLastX)}" cy="${format(pointLastY)}" r="${format(radiusDot)}"${attributesDot}/>`;
  // The title element names the chart and doubles as the tooltip, so the
  // description isn’t repeated in `aria-label`. A decorative chart keeps the
  // tooltip but is hidden from assistive technology, which is what a heading
  // needs: A descendant name would otherwise be folded into the heading’s own.
  const markupTitle = `<title>${escapeAttribute(describeSeries(values, { labels, title }))}</title>`;
  const attributesRole = decorative ? ' aria-hidden="true"' : ' role="img"';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${format(width)} ${format(height)}"` +
    ` width="${format(width)}" height="${format(height)}"${attributesRole}${naming('')}>` +
    `${markupTitle}${markupBackground}${markupAxis}${markupPath}${markupDot}</svg>`;
}