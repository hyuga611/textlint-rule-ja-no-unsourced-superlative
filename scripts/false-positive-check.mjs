/**
 * 広告ではない日本語の文章に当てて、何件鳴るかを数える。
 *
 * このルールが壊れる壊れ方は「見逃す」ではなく「鳴りすぎる」である。誤検知が
 * 続けば .textlintrc から消され、以後どの本物も止められない。だから語彙を
 * 足すたびに、まずここを通す。技術記事・日記・議事録のような非広告文書で
 * 鳴った分は、そのまま誤検知とみなしてよい。
 *
 *   node scripts/false-positive-check.mjs <ディレクトリ|ファイル> ...
 */
import { TextlintKernel } from '@textlint/kernel';
import * as mp from '@textlint/textlint-plugin-markdown';
import rule from '../dist/src/index.js';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const markdown = mp.default.default;
const kernel = new TextlintKernel();

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('使い方: node scripts/false-positive-check.mjs <ディレクトリ|ファイル> ...');
  process.exit(2);
}

function collect(p) {
  const st = statSync(p);
  if (st.isFile()) return p.endsWith('.md') ? [p] : [];
  return readdirSync(p).flatMap((f) => collect(join(p, f)));
}

let files = 0;
let chars = 0;
const hits = [];
for (const t of targets) {
  for (const p of collect(t)) {
    const text = readFileSync(p, 'utf8');
    files++;
    chars += text.length;
    const r = await kernel.lintText(text, {
      filePath: p,
      ext: '.md',
      plugins: [{ pluginId: 'markdown', plugin: markdown }],
      rules: [{ ruleId: 'r', rule, options: true }],
    });
    for (const m of r.messages) {
      hits.push({ p, line: (text.split('\n')[m.loc.start.line - 1] ?? '').trim().slice(0, 90) });
    }
  }
}

console.log(`対象: ${files} ファイル / ${chars.toLocaleString()} 文字`);
console.log(`検出: ${hits.length} 件`);
for (const h of hits) console.log(`\n  ${h.p}\n    ${h.line}`);
process.exit(hits.length === 0 ? 0 : 1);
