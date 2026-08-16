/**
 * 根拠の併記がない最大級表現を報告する textlint ルール。
 *
 * 「No.1」「日本初」「業界最安値」——これらは景品表示法上、事実であっても
 * *根拠を示せる状態* でなければ不当表示になりうる。消費者庁の No.1 表示に
 * 関する実態調査報告書（令和6年9月26日）は、調査の対象・期間・出典が示されて
 * いない No.1 表示を繰り返し問題として挙げている。
 *
 * このルールが見るのは「本当に日本一か」ではない。それは文章からは決して
 * 分からない。見るのは **その主張のそばに出典が書かれているか** だけである。
 * 書かれていなければ、読者にも審査にも根拠は存在しないのと同じになる。
 *
 * 誤検知で切られないための設計:
 *
 *  1. 既定の語彙は「比較の主張」が動かしようのないものだけに絞ってある。
 *     「最高」「最大」「圧倒的」は既定では鳴らさない——「最高の一日」「最大化」
 *     のような非広告用法が日本語では普通にあり、そこで鳴らすルールは
 *     `.textlintrc` から消されて終わる。必要な人だけ `aggressive` で足す。
 *  2. 根拠が近くにあれば黙る。「※当社調べ」「2026年3月 自社調査」「n=1,200」など。
 *  3. 判定は文単位ではなく前後の距離で行う。根拠は脚注として直後や行末に
 *     置かれることが多く、文で切ると本文と脚注が別物になってしまう。
 *
 * 型だけ `@textlint/types` に依存する（devDependency）。公開されるパッケージに
 * 実行時依存はない。
 */
import type { TextlintRuleModule } from '@textlint/types';

export interface Options {
  /** 既定の語彙に加えて検出する語。 */
  readonly words?: readonly string[];
  /** 既定の語彙から外す語。 */
  readonly allow?: readonly string[];
  /**
   * 非広告用法と紛れやすい語（最高・最大・圧倒的・トップクラス等）も対象にする。
   * 誤検知が増えるので既定は false。
   */
  readonly aggressive?: boolean;
  /** 根拠を探す前後の文字数。既定 60。 */
  readonly evidenceWithin?: number;
  /** 根拠とみなす語を追加する。 */
  readonly evidenceWords?: readonly string[];
}

/**
 * 既定の語彙。「一番であること」を主張していると誰が読んでも取れるものだけ。
 * 迷ったら入れない——鳴りすぎるルールは、誤検知の数だけ信用を落とす。
 */
const DEFAULT_WORDS: readonly string[] = [
  'No.1',
  'No1',
  'NO.1',
  'ナンバーワン',
  'ナンバー1',
  '第1位',
  '第一位',
  '日本一',
  '世界一',
  '業界一',
  '日本初',
  '世界初',
  '業界初',
  '国内初',
  // 複合形を先に置く。「業界最安値」は「業界最安」と「最安値」のどちらでも
  // 部分一致するので、複合形が語彙に無いと長い方（業界最安）が当たり、指摘が
  // 「業界最安」と尻切れになる。報告としては読めるが、書き手が直すべき語を
  // 正確には指していない。
  '業界最安値',
  '最安値',
  '業界最安',
  // 同じく複合形が先。「業界最低価格」が「最低価格」で当たると尻切れになる。
  '業界最低価格',
  '地域最低価格',
  '最低価格',
  '最高峰',
  '唯一無二',
  // 「ナンバーワン」の表記ゆれ。中黒入りは別の文字列なので語彙に無いと素通りする。
  'ナンバー・ワン',
  // 「首位」単体は順位表・スポーツで普通に使うので入れない。「シェア首位」なら
  // 市場での一番を主張していると誰が読んでも取れる。
  'シェア首位',
];

/** `aggressive` のときだけ足す語。非広告用法が普通にあるもの。 */
const AGGRESSIVE_WORDS: readonly string[] = [
  '圧倒的',
  'トップクラス',
  // 既定側の「最高峰」と同じ理由で複合形を先に持つ。これが無いと
  // aggressive のときだけ「業界最高峰」が「業界最高」で尻切れになる。
  '業界最高峰',
  '業界最高',
  '業界最大',
  '最上級',
];

/**
 * 根拠が書かれていることを示す語。
 *
 * 「※」を入れてあるのは、日本語の広告では根拠がほぼ必ず米印の脚注に置かれる
 * ため。脚注の中身の妥当性はこのルールの守備範囲ではない——あるかないかだけ。
 */
const DEFAULT_EVIDENCE: readonly string[] = [
  '調べ',
  '調査',
  '出典',
  '引用',
  '当社比',
  '有効回答',
  '対象者',
  '※',
  'n=',
  'N=',
];

/**
 * 「2026年3月時点」のような調査時点の表記。
 *
 * 以前は `(19|20)\d{2}\s*年` で、**西暦4桁なら何でも**根拠とみなしていた。コメントが
 * 書いていた意図より実装がずっと緩く、「2026年春の新プラン」のような日付の言及だけで
 * 最大級表現が黙る。広告文は年号だらけなので、実際の LP ほど鳴らなくなっていた。
 * 「時点」「現在」を伴う場合だけに絞る（調査年の明示は 調査/調べ 側の語彙で拾う）。
 */
const DATE_EVIDENCE = /(19|20)\d{2}\s*年[^。、\n]{0,12}?(?:時点|現在)/;

/**
 * 全角英数字・記号を半角に寄せる（U+FF01–U+FF5E → U+0021–U+007E）。
 *
 * 日本語の広告は「Ｎｏ．１」「ｎ＝1,200」のように全角で書かれることが普通にあり、
 * 半角の語彙だけを見ていると素通りする。**1文字＝1文字の変換なので位置がずれない**——
 * 報告のインデックスは元テキストのものをそのまま使える。
 */
function toHalfWidth(s: string): string {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasEvidenceNear(text: string, at: number, len: number, within: number, words: readonly string[]): boolean {
  const from = Math.max(0, at - within);
  const to = Math.min(text.length, at + len + within);
  const around = text.slice(from, to);
  if (DATE_EVIDENCE.test(around)) return true;
  return words.some((w) => around.includes(w));
}

const rule: TextlintRuleModule<Options> = (context, options = {}) => {
  const { Syntax, RuleError, report, getSource } = context;

  const allow = new Set(options.allow ?? []);
  const words = [
    ...DEFAULT_WORDS,
    ...(options.aggressive === true ? AGGRESSIVE_WORDS : []),
    ...(options.words ?? []),
  ].filter((w) => !allow.has(w));

  const evidence = [...DEFAULT_EVIDENCE, ...(options.evidenceWords ?? [])];
  const within = options.evidenceWithin ?? 60;

  // 長い語から先に当てる。「業界最安」より先に「最安値」が当たると
  // 報告位置が語の途中になり、指摘としては読めるが直す場所がずれる。
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const pattern =
    sorted.length === 0 ? undefined : new RegExp(sorted.map(escapeRegExp).join('|'), 'g');

  return {
    [Syntax.Str](node) {
      if (pattern === undefined) return;
      const source = getSource(node);
      // 全角を寄せた写しの上で判定する。長さが変わらないので位置は元テキストと共通。
      const text = toHalfWidth(source);
      pattern.lastIndex = 0;
      const seen = new Set<number>();
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(text)) !== null) {
        const at = m.index;
        // 報告には書き手が実際に書いた形を出す（「Ｎｏ．１」を「No.1」と言い換えない）。
        const word = source.slice(at, at + m[0].length);
        if (seen.has(at)) continue;
        seen.add(at);
        if (hasEvidenceNear(text, at, m[0].length, within, evidence)) continue;
        report(
          node,
          new RuleError(
            `「${word}」は最大級表現です。根拠（調査の出典・対象・時点）が近くに書かれていないため、` +
              `事実であっても景品表示法上は不当表示とされうる場合があります。調査の出典を併記するか、表現を改めてください。`,
            { index: at },
          ),
        );
      }
    },
  };
}

export default rule;
