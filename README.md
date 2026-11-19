# Sparkle MacSparkline, the SVG Sparkline Generator

[![npm version](https://img.shields.io/npm/v/sparklemacsparkline.svg)](https://www.npmjs.com/package/sparklemacsparkline) [![Build status](https://github.com/j9t/sparklemacsparkline/workflows/Tests/badge.svg)](https://github.com/j9t/sparklemacsparkline/actions) [![Socket](https://badge.socket.dev/npm/package/sparklemacsparkline)](https://socket.dev/npm/package/sparklemacsparkline) [![GitHub Sponsors](https://badgen.net/static/Support/Open%20Source/cyan)](https://github.com/sponsors/j9t)

Sparkle MacSparkline turns a series of numbers into a word-sized SVG sparkline—a small line without axes, meant to sit inside running text rather than to be studied on its own. It runs without dependencies and without a browser, which makes it a fit for build steps (like static site generators) and the command line.

Each sparkline describes itself to assistive technology, follows the surrounding text color (and with it dark mode and forced colors), and comes as compact markup ready to be inlined.

## Example

```shell
$ npx sparklemacsparkline --stdout --labels 2006,2007,2008,2009,2010 4,42,50,34,13
```

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 16" width="48" height="16" role="img" class="sparkline"><title>Sparkline of 5 values from 2006 to 2010: rising from 4 to a peak of 50 in 2008, then falling to 13</title><path class="sparkline-line" d="M1.44 13.51L12.72 3.54 24 1.44 35.28 5.64 46.56 11.15" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle class="sparkline-dot" cx="46.56" cy="11.15" r="1.44" fill="currentColor"/></svg>
```

## Usage

### Programmatic Use

Install Sparkle MacSparkline in your project, e.g., via `npm i -D sparklemacsparkline`, then import and use it:

```js
import { sparkline } from 'sparklemacsparkline';

const svg = sparkline([4, 42, 50, 34, 13], { title: 'Posts per year' });
```

`sparkline()` returns the markup as a string. It takes an array of at least two finite numbers, and an options object:

```js
{
  accent: 'red',              // color of the end dot (defaults to `foreground`)
  axis: true,                 // set to `false` to leave out the axis drawn where a series crosses zero
  background: '#fff',         // background color (none by default)
  classes: true,              // set to `false` to leave out class names
  decorative: false,          // set to `true` to hide the chart from assistive technology
  foreground: 'currentColor', // line color
  height: 16,                 // height
  labels: ['2006', …],        // one label per value, naming the range and the peak in the description
  style: 'inline',            // set to `external` to leave all presentation to a style sheet
  tight: false,               // set to `true` to scale to the data range instead of starting at zero
  title: 'Posts per year',    // lead of the description (none by default)
  width: 48                   // width (defaults to 4 per value, from 48 to 160)
}
```

Invalid input throws: a `RangeError` for too few values, mismatched labels, an unknown style, or a size that isn’t a positive number; a `TypeError` for values that aren’t finite numbers, colors that don’t look like CSS colors, or colors combined with the external style.

`describeSeries(values, { labels, title })` returns the description `sparkline()` uses as the accessible name—for a visible caption or an `img` element’s `alt` text, for example.

#### Example: Eleventy

As the work happens in memory, there’s no need for files or caching. A filter could look like this:

```js
import { sparkline } from 'sparklemacsparkline';

eleventyConfig.addFilter('sparkline', values => sparkline(values, { decorative: true, width: 160, height: 20 }));
```

### CLI

```shell
npx sparklemacsparkline [options] <values>
… | npx sparklemacsparkline [options]
```

Values are separated by commas or whitespace, so both `4,42,50` and a column of numbers piped in work. A series starting with a negative value needs `--` before it, after all options (`npx sparklemacsparkline --tight --stdout -- -10,5,-3,8`).

| Option | Description |
| --- | --- |
| `--labels <list>` | Comma-separated labels, one per value |
| `--title <text>` | Title (leads the description, names the default file) |
| `--tight` | Scale to the data range instead of starting at zero |
| `--no-axis` | Leave out the axis drawn where a series crosses zero |
| `--decorative` | Hide the chart from assistive technology |
| `--no-class` | Leave out class names |
| `--width <number>` | Width (defaults to 4 per value, from 48 to 160) |
| `--height <number>` | Height (defaults to 16) |
| `--style <style>` | `inline` (default) or `external` |
| `--foreground <css>` | Line color (defaults to `currentColor`) |
| `--background <css>` | Background color (none by default) |
| `--accent <css>` | Color of the end dot (defaults to the foreground color) |
| `--output <path>` | File to write, overwriting it |
| `--stdout` | Print the markup instead of writing a file |
| `--version` | Show the version |
| `--help` | Show usage information |

Without `--output` or `--stdout`, the sparkline is written to a file named after the title—“Posts per year” becomes posts-per-year.svg, and sparkline.svg stands in without a title. As that name is guessed rather than given, an existing file is never overwritten; the name gets a number instead. `--output` overwrites, so that regenerating into a fixed path stays idempotent.

Exit code is `0` on success, `1` without usable data (no values, or just one), and `2` on malformed input or options.

## How It Works

### Accessibility

Each sparkline carries `role="img"` and a `title` element describing the shape of the line—where it starts and ends, and the peak or low in between (e.g., “rising from 4 to a peak of 50 in 2008, then falling to 13”). That element serves as the accessible name and as the tooltip, so the description isn’t repeated in an `aria-label`. A title leads the description and (on the command line) names the file.

The description is in English, with numbers formatted accordingly (“1,234.57”).

The description only applies to inlined markup. Referenced as an image (`<img src="sparkline.svg">`), an SVG file’s own labeling is ignored, and the `img` element needs an `alt` attribute instead—`describeSeries()` can provide its text.

`decorative` replaces `role="img"` with `aria-hidden="true"`—the tooltip stays—for charts that repeat what the surrounding page already says—inside a heading, for example, where a description would otherwise become part of the heading’s accessible name. Use it only where the data is available elsewhere.

### Scale

The vertical scale starts at zero by default. Scaling to the range of the data instead makes every series fill the box, which exaggerates variation on a high floor—a run of 80 to 89 would look like the same mountain as a run of 4 to 89. Use `tight` when the shape matters more than the magnitude.

A series that crosses zero gets a faint axis at zero, as the sign of a value is otherwise invisible. An all-positive series doesn’t get one, as zero is the floor there already.

### Presentation

Presentation is inline by default: Colors are set as presentation attributes on the elements, which keeps the output valid as a standalone file and, unlike an embedded `style` element, cannot leak rules into a page it’s inlined in. As the default color is `currentColor`, an inlined sparkline still follows the surrounding text color, dark mode, and forced-colors mode. (Custom colors don’t adapt to forced-colors mode.)

With the external style, the elements carry class names only (`sparkline`, `sparkline-line`, `sparkline-dot`, `sparkline-axis`), leaving all presentation to a style sheet. Without classes, the elements can be selected by context, as in `h2 svg path`.

## Working on Sparkle MacSparkline

Note: This section assumes working with dependencies installed (`npm i`).

### Tests

```shell
npm test
```

Runs the type tests (`tsc`, against `test/types.test.ts`) and then the suites in `test/`: `sparkline.test.js` (the API) and `cli.test.js` (the command line, exit codes, file output).

`npm run lint` (or `lint:fix`) covers the rest.

### Layout

```text
bin/
  sparklemacsparkline.js  Executable entry point—wiring only

src/
  index.js                Public API (re-exports only)
  index.d.ts              Type definitions
  sparkline.js            Drawing and description
  cli.js                  The command line
```

***

You might like some of my other work:

* Optimization tools: [hihtml](https://github.com/j9t/hihtml) · [HTML Minifier](https://github.com/j9t/html-minifier) · [CSS Dedup](https://github.com/j9t/css-dedup) · [Image Guard](https://github.com/j9t/image-guard) · [more](https://github.com/j9t?tab=repositories)
* Defense tools: [AWAGAM TLD, Domain, and URL Blocker](https://iadefensa.com/solutions/awagam-chromium/) · [Middleman Alerter](https://iadefensa.com/solutions/middleman-alerter-chromium/) · [New Tab Traffic Randomizer](https://iadefensa.com/solutions/new-tab-traffic-randomizer-chromium/) · [Searcher](https://iadefensa.com/solutions/searcher-chromium/) · [more](https://iadefensa.com/solutions/)
* Resources for quality web development: [Articles](https://meiert.com/topics/development/) · [Books](https://meiert.com/topics/books/) · [News](https://dxsrc.org/) · [Terminology](https://webglossary.info/)