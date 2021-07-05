// Mostly from https://github.com/hexenq/kuroshiro/blob/master/src/util.js

const KATAKANA_HIRAGANA_SHIFT = '\u3041'.charCodeAt(0) - '\u30a1'.charCodeAt(0);
const HIRAGANA_KATAKANA_SHIFT = '\u30a1'.charCodeAt(0) - '\u3041'.charCodeAt(0);

export function toHiragana(str: string) {
  return [...str].map((ch) => {
    if (ch > '\u30a0' && ch < '\u30f7') {
      return String.fromCharCode(ch.charCodeAt(0) + KATAKANA_HIRAGANA_SHIFT);
    }
    return ch;
  }).join('');
};

export function toKatakana(str: string) {
  return [...str].map((ch) => {
    if (ch > '\u3040' && ch < '\u3097') {
      return String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_KATAKANA_SHIFT);
    }
    return ch;
  }).join('');
};