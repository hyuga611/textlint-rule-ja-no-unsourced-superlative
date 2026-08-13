/**
 * 本物の textlint カーネルに通す。
 *
 * context をモックすると「Str ノードにしか来ない」という前提そのものが
 * 検証されない——このルールがコードブロックや URL で鳴らないのは、自前で
 * 除外しているからではなく Markdown プラグインが Str を切り出すからで、
 * そこを差し替えたテストは一番大事なことを試していないことになる。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextlintKernel } from '@textlint/kernel';
import type { TextlintPluginCreator } from '@textlint/types';
import * as markdownPlugin from '@textlint/textlint-plugin-markdown';
import rule, { type Options } from '../src/index.js';

// CJS で書かれたプラグインを ESM から読むと `default` が二重に包まれ、
// `Processor` は `ns.default.default` に来る。カーネルは Processor を直に
// 探すので、ここで剥がしておく。素直に import しただけでは
// 「Plugin should have Processor property.」で全テストが落ちる。
const markdown = (markdownPlugin as { default: { default: unknown } }).default
  .default as TextlintPluginCreator;

const kernel = new TextlintKernel();

async function lint(text: string, options: Options | boolean = true): Promise<string[]> {
  const result = await kernel.lintText(text, {
    filePath: '/test.md',
    ext: '.md',
    plugins: [{ pluginId: 'markdown', plugin: markdown }],
    rules: [{ ruleId: 'ja-no-unsourced-superlative', rule, options }],
  });
  return result.messages.map((m) => m.message);
}

test('根拠のない No.1 は報告される', async () => {
  const msgs = await lint('当社の製品は顧客満足度No.1です。');
  assert.equal(msgs.length, 1);
  assert.match(msgs[0] ?? '', /No\.1/);
});

test('※当社調べ が近くにあれば黙る', async () => {
  assert.deepEqual(await lint('顧客満足度No.1（※2026年3月 当社調べ）'), []);
});

test('調査の時点だけでも根拠として扱う', async () => {
  // 「2026年」があるということは、少なくとも時点を書く意識がある。
  // ここで鳴らすと、脚注を書いている書き手ほど頻繁に怒られることになる。
  assert.deepEqual(await lint('2026年 顧客満足度調査で第1位を獲得しました。'), []);
});

test('既定では「最高」「圧倒的」は鳴らさない', async () => {
  // このルールが .textlintrc から消される一番の道がここ。
  // 「最高の一日」「圧倒的な作業量」は広告表現ではない。
  assert.deepEqual(await lint('最高の一日でした。圧倒的な作業量をこなした。品質を最大化する。'), []);
});

test('aggressive のときだけ、紛らわしい語も対象になる', async () => {
  const msgs = await lint('圧倒的な性能です。', { aggressive: true });
  assert.equal(msgs.length, 1);
  assert.match(msgs[0] ?? '', /圧倒的/);
});

test('allow に入れた語は既定の語彙からも外れる', async () => {
  assert.deepEqual(await lint('日本初の試みです。', { allow: ['日本初'] }), []);
});

test('words で語彙を足せる', async () => {
  const msgs = await lint('当地随一の品揃えです。', { words: ['随一'] });
  assert.equal(msgs.length, 1);
});

test('コードブロックの中では鳴らない', async () => {
  // 自前で除外しているのではなく、Markdown プラグインが Str を作らないため。
  assert.deepEqual(await lint('```\nconst label = "No.1";\n```'), []);
});

test('一文に複数あればその数だけ報告する', async () => {
  const msgs = await lint('日本初かつ業界最安値の唯一無二のサービスです。');
  assert.equal(msgs.length, 3);
});

test('根拠が遠すぎるときは鳴る', async () => {
  // 既定は前後 60 文字。脚注が別の段落の遠くにあるなら、読者は結び付けられない。
  const far = `世界一の品質です。${'あ'.repeat(120)}※当社調べ`;
  const msgs = await lint(far);
  assert.equal(msgs.length, 1);
});

test('evidenceWithin を広げれば同じ文章で黙る', async () => {
  const far = `世界一の品質です。${'あ'.repeat(120)}※当社調べ`;
  assert.deepEqual(await lint(far, { evidenceWithin: 200 }), []);
});

test('長い語が短い語より優先して当たる', async () => {
  // 「業界最安」と「最安値」が両方あるとき、重なりで二重報告しない。
  const msgs = await lint('業界最安をうたっています。');
  assert.equal(msgs.length, 1);
  assert.match(msgs[0] ?? '', /業界最安/);
});

test('「業界最安値」は尻切れにならず、その語のまま指摘される', async () => {
  // 0.1.0 はここで「業界最安」と報告していた。一件しか鳴らず位置も正しいので
  // 実害は無いが、書き手が直すべき語を正確には指していない。
  const msgs = await lint('業界最安値でご提供します。');
  assert.equal(msgs.length, 1);
  assert.match(msgs[0] ?? '', /「業界最安値」/);
});

test('aggressive の「業界最高峰」も尻切れにならない', async () => {
  const msgs = await lint('業界最高峰の品質です。', { aggressive: true });
  assert.equal(msgs.length, 1);
  assert.match(msgs[0] ?? '', /「業界最高峰」/);
});
