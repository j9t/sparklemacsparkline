const heightDefault = 16; // One rem at a typical root size
const stepDefault = 4; // Horizontal distance per data point
const widthMin = 48;
const widthMax = 160; // Past roughly this a sparkline wants to be a real chart
const widthStroke = 1.25; // Hairline at any size, which is the point of a sparkline
const radiusDotMin = 1.25;
const radiusDotMax = 4;
const ratioDot = .09; // Dot radius as a share of the height
const widthZero = .5; // The zero line stays recessive against the data
const opacityZero = .35;

export const styles = ['inline', 'external'];

// Permissive enough for hex, functional notation, keywords, and `var(…)`, while
// keeping out the quotes and angle brackets that could break out of an attribute
const patternColor = /^[\w#(),.%/ +*-]+$/;

// Trim the leading zero of a decimal, the way a minifier would: `0.5` → `.5`
function format(number) {
  return String(number).replace(/^(-?)0\./, '$1.');
}

function round(number) {
  return Math.round(number * 100) / 100;
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

  const { min: valueMin, max: valueMax } = findExtent(values);
  const valueFirst = values[0];
  const valueLast = values.at(-1);
  const span = valueMax - valueMin;

  const namePeak = labels?.[values.indexOf(valueMax)];
  const nameFirst = labels?.[0];
  const nameLast = labels?.at(-1);

  // Call a change worth mentioning only once it covers part of the spread
  let trend = 'roughly steady';
  if (span > 0 && (valueLast - valueFirst) / span > .05) trend = 'overall rising';
  if (span > 0 && (valueFirst - valueLast) / span > .05) trend = 'overall falling';

  const scope = nameFirst && nameLast
    ? `${values.length} values from ${nameFirst} to ${nameLast}`
    : `${values.length} values`;
  const peak = namePeak
    ? `from ${valueMin} to a peak of ${valueMax} in ${namePeak}`
    : `from ${valueMin} to ${valueMax}`;

  const lead = title ? `${title.replace(/[.\s]+$/, '')}. ` : '';
  return `${lead}Sparkline of ${scope}, ${peak}, ending at ${valueLast}; ${trend}.`;
}

export function sparkline(values, options = {}) {
  checkValues(values);

  const {
    accent,
    background,
    classes = true,
    decorative = false,
    foreground = 'currentColor',
    height = heightDefault,
    labels,
    style = 'inline',
    tight = false,
    title,
    width = Math.min(widthMax, Math.max(widthMin, (values.length - 1) * stepDefault)),
    zeroLine = true
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

  // After one “L”, further coordinate pairs are implicit linetos, so the
  // command letter is only needed once
  const [pointHead, ...pointsRest] = points.map(([x, y]) => `${format(x)} ${format(y)}`);
  const d = `M${pointHead}L${pointsRest.join(' ')}`;

  const attributesPath = isInline
    ? ` fill="none" stroke="${escapeAttribute(foreground)}" stroke-width="${format(widthStroke)}"` +
      ' stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"'
    : '';
  const attributesDot = isInline ? ` fill="${escapeAttribute(colorAccent)}"` : '';
  const attributesZero = isInline
    ? ` stroke="${escapeAttribute(foreground)}" stroke-width="${format(widthZero)}" opacity="${format(opacityZero)}"`
    : '';

  const markupBackground = background
    ? `<rect width="100%" height="100%" fill="${escapeAttribute(background)}"/>`
    : '';

  // Only worth drawing where the series actually crosses zero—with an
  // all-positive series zero is the floor already
  const crossesZero = domainMin < 0 && domainMax > 0;
  const yZero = toY(0);
  const markupZero = zeroLine && crossesZero
    ? `<line${naming('-zero')} x1="0" y1="${format(yZero)}" x2="${width}" y2="${format(yZero)}"${attributesZero}/>`
    : '';

  const markupPath = `<path${naming('-line')} d="${d}"${attributesPath}/>`;
  const markupDot = `<circle${naming('-dot')} cx="${format(pointLastX)}" cy="${format(pointLastY)}" r="${format(radiusDot)}"${attributesDot}/>`;
  const markupTitle = title ? `<title>${escapeAttribute(title)}</title>` : '';

  // A decorative chart is hidden from assistive technology rather than
  // described, which is what a heading needs: A descendant label would
  // otherwise be folded into the heading’s own accessible name
  const attributesRole = decorative
    ? ' aria-hidden="true"'
    : ` role="img" aria-label="${escapeAttribute(describeSeries(values, { labels, title }))}"`;

  return `<svg${naming('')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"` +
    ` width="${width}" height="${height}"${attributesRole}>` +
    `${markupTitle}${markupBackground}${markupZero}${markupPath}${markupDot}</svg>`;
}