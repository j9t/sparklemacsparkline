import { describe, test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sparkline } from '../src/index.js';
import { parseSeries, slugify } from '../src/cli.js';

const pathScript = fileURLToPath(new URL('../bin/sparklemacsparkline.js', import.meta.url));

function run(args, { cwd, input } = {}) {
  return spawnSync(process.execPath, [pathScript, ...args], { cwd, encoding: 'utf8', input: input ?? '' });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sparklemacsparkline-'));
}

describe('CLI', () => {
  test('Shows help with `--help`', () => {
    const { stdout, status } = run(['--help']);
    assert.ok(stdout.includes('Usage:'));
    assert.strictEqual(status, 0);
  });

  test('Shows the version with `--version`', () => {
    const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.strictEqual(run(['--version']).stdout.trim(), version);
  });

  test('Prints the same markup as the API with `--stdout`', () => {
    const { stdout, status } = run(['--stdout', '--no-class', '--decorative', '--title', 'Posts', '--width', '160', '--height', '20', '3,0,7']);
    assert.strictEqual(stdout, sparkline([3, 0, 7], { classes: false, decorative: true, title: 'Posts', width: 160, height: 20 }) + '\n');
    assert.strictEqual(status, 0);
  });

  test('Reads values from STDIN', () => {
    const { stdout, status } = run(['--stdout'], { input: '1\n2\n3\n' });
    assert.strictEqual(stdout, sparkline([1, 2, 3]) + '\n');
    assert.strictEqual(status, 0);
  });

  test('Accepts negative values after `--`', () => {
    const { stdout, status } = run(['--stdout', '--tight', '--', '-10,5,-3,8']);
    assert.strictEqual(stdout, sparkline([-10, 5, -3, 8], { tight: true }) + '\n');
    assert.strictEqual(status, 0);
  });

  test('Writes a file named after the title, without overwriting', () => {
    const dirTemp = makeTempDir();
    try {
      run(['--title', 'Posts per year', '1,2'], { cwd: dirTemp });
      run(['--title', 'Posts per year', '1,2'], { cwd: dirTemp });
      assert.deepStrictEqual(fs.readdirSync(dirTemp).sort(), ['posts-per-year-2.svg', 'posts-per-year.svg']);
      assert.strictEqual(fs.readFileSync(path.join(dirTemp, 'posts-per-year.svg'), 'utf8'), sparkline([1, 2], { title: 'Posts per year' }));
    } finally {
      fs.rmSync(dirTemp, { recursive: true, force: true });
    }
  });

  test('Overwrites the file named by `--output`', () => {
    const dirTemp = makeTempDir();
    try {
      run(['--output', 'chart.svg', '1,2'], { cwd: dirTemp });
      run(['--output', 'chart.svg', '2,1'], { cwd: dirTemp });
      assert.deepStrictEqual(fs.readdirSync(dirTemp), ['chart.svg']);
      assert.strictEqual(fs.readFileSync(path.join(dirTemp, 'chart.svg'), 'utf8'), sparkline([2, 1]));
    } finally {
      fs.rmSync(dirTemp, { recursive: true, force: true });
    }
  });

  test('Exits with 1 without usable data', () => {
    assert.strictEqual(run([]).status, 1);
    assert.strictEqual(run(['5']).status, 1);
  });

  test('Exits with 2 on malformed input or options', () => {
    assert.strictEqual(run(['--stdout', '1,a']).status, 2);
    assert.strictEqual(run(['--stdout', '--width', 'wide', '1,2']).status, 2);
    assert.strictEqual(run(['--stdout', '--style', 'external', '--foreground', 'red', '1,2']).status, 2);
    assert.strictEqual(run(['--stdout', '--output', 'chart.svg', '1,2']).status, 2);
    assert.strictEqual(run(['--unknown', '1,2']).status, 2);
  });
});

describe('parseSeries()', () => {
  test('Splits on commas and whitespace', () => {
    assert.deepStrictEqual(parseSeries('1, 2,3\n4 5'), [1, 2, 3, 4, 5]);
  });
});

describe('slugify()', () => {
  test('Folds diacritics and German characters', () => {
    assert.strictEqual(slugify('Beiträge pro Jahr (Größe)'), 'beitraege-pro-jahr-groesse');
    assert.strictEqual(slugify('Café “Crème”'), 'cafe-creme');
  });

  test('Falls back to “sparkline”', () => {
    assert.strictEqual(slugify('…'), 'sparkline');
  });
});