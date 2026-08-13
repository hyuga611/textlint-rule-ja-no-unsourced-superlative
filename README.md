# textlint-rule-ja-no-unsourced-superlative

> A textlint rule for Japanese: report superlative claims (`No.1`, `日本初`, `業界最安値`) that have no source cited nearby. It never judges whether the claim is true — only whether a reader can find the evidence. Zero runtime dependencies.

**「No.1」と書いてあるのに、その根拠がどこにも書かれていない箇所を報告します。**

景品表示法では、最大級表現は*事実であっても*根拠を示せる状態でなければ不当表示になりえます。消費者庁の[No.1表示に関する実態調査報告書（令和6年9月26日）](https://www.caa.go.jp/policies/policy/representation/fair_labeling/survey/assets/representation_cms216_240926_02.pdf)は、調査の対象・期間・出典が示されないNo.1表示を繰り返し問題として挙げています。

このルールが見るのは**「本当に日本一か」ではありません**。それは文章からは絶対に分かりません。見るのは「その主張のそばに出典が書かれているか」だけです。書かれていなければ、読者にとっても審査にとっても根拠は無いのと同じになります。

## 使い方

```bash
npm install --save-dev textlint textlint-rule-ja-no-unsourced-superlative
```

```json
{
  "rules": {
    "ja-no-unsourced-superlative": true
  }
}
```

```
✘ 「No.1」は最大級表現です。根拠（調査の出典・対象・時点）が近くに書かれて
  いないため、事実であっても景品表示法上は不当表示とされうる場合があります。
  調査の出典を併記するか、表現を改めてください。
```

根拠が近くにあれば黙ります。

```markdown
顧客満足度No.1（※2026年3月 当社調べ）   → 鳴らない
2026年 顧客満足度調査で第1位            → 鳴らない
当社の製品は顧客満足度No.1です。         → 鳴る
```

## 誤検知で消されないための設計

このルールが壊れる壊れ方は「見逃す」ではなく「**鳴りすぎる**」です。誤検知が続けば `.textlintrc` から消され、以後どの本物も止められません。なので既定の語彙は、比較の主張が動かしようのないものだけに絞ってあります。

**既定では鳴らない語**: 「最高」「最大」「圧倒的」「トップクラス」。日本語では「最高の一日」「品質を最大化する」のような非広告用法が普通にあるためです。必要なら `aggressive` で足せます。

非広告の日本語文書（技術記事・ドラフト計 155,004 文字）に当てた結果は **検出 0 件** でした。語彙を足すときは同じ検査を通してください。

```bash
node scripts/false-positive-check.mjs <ディレクトリ>
```

## オプション

| オプション | 既定 | 内容 |
|---|---|---|
| `words` | `[]` | 既定の語彙に加えて検出する語 |
| `allow` | `[]` | 既定の語彙から外す語 |
| `aggressive` | `false` | 「圧倒的」「トップクラス」等、非広告用法と紛れやすい語も対象にする |
| `evidenceWithin` | `60` | 根拠を探す前後の文字数 |
| `evidenceWords` | `[]` | 根拠とみなす語を追加する |

```json
{
  "rules": {
    "ja-no-unsourced-superlative": {
      "aggressive": true,
      "allow": ["日本初"],
      "evidenceWords": ["自社調査"]
    }
  }
}
```

根拠として既定で認識するもの: `調べ` `調査` `出典` `引用` `当社比` `有効回答` `対象者` `※` `n=` と、`20XX年` のような時点表記。

## このルールが**しない**こと

- **法令準拠の判定はしません。** 根拠が併記されていれば黙りますが、その根拠が景品表示法上妥当かどうかは判断していません。調査設計の適否は人と専門家の仕事です
- **ステマ規制（PR表記）は見ません。** 広告であることの明示は文章単体ではなく掲載形態の問題で、textlint の守備範囲外です
- **薬機法は対象外です。** 効能効果の表現は別ルールの領分です

**このルールが黙ったことは、その表現が適法であることを意味しません。** 出典が近くに書かれている、それだけです。

## ライセンス

MIT
