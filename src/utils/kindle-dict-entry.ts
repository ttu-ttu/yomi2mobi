import { fragment } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { YomichanEntry } from '../yomichan/yomichan-formatter';
import { Definition, InflectionRuleEnum, StructuredContentItem } from '../yomichan/yomichan-types';
import { toHiragana, toKatakana } from './kana-transformations';
import * as _ from 'lodash';

interface KindleInflection {
  name: string;
  value: string;
}

export interface KindleDictEntry {
  headword: string;
  hiddenLabel?: string;
  inflections: KindleInflection[];
  definition: string;
}

function structuredContentItemToHtmlText(item: StructuredContentItem): string {
  if (typeof item === 'string') {
    return item;
  } else if (Array.isArray(item)) {
    return item.map((subItem) => structuredContentItemToHtmlText(subItem)).join('');
  }
  switch (item.tag) {
    case 'img':
      return '(Image)';
  }
  return structuredContentItemToHtmlText(item.content);
}

function yomichanDefinitionToHtmlText(definition: Definition): string {
  if (typeof definition === 'string') {
    return definition;
  } else if (definition.type === 'text') {
    return definition.text;
  } else if (definition.type === 'image') {
    return '(Image)';
  }

  return structuredContentItemToHtmlText(definition.content);
}

function convertToDan(changingKana: string, newDan: 'あ' | 'い' | 'う' | 'え' | 'お') {
  if (changingKana.length !== 1) {
    return;
  }
  const kanaTable =  `
    あいうえお
    かきくけこ
    さしすせそ
    たちつてと
    なにぬねの
    はひふへほ
    まみむめも
    やいゆえよ
    らりるれろ
    わゐうゑを
    がぎぐげご
    ざじずぜぞ
    だぢづでど
    ばびぶべぼ
    ぱぴぷぺぽ`
    .replace(/\s/g, '')
    .match(/.{1,5}/g)!;
  const matchingRow = kanaTable.find((row) => row.includes(changingKana));
  if (matchingRow) {
    switch (newDan) {
      case 'あ':
        return matchingRow.charAt(0);
      case 'い':
        return matchingRow.charAt(1);
      case 'う':
        return matchingRow.charAt(2);
      case 'え':
        return matchingRow.charAt(3);
      case 'お':
        return matchingRow.charAt(4);
    }
  }
}

export function yomichanEntryToKindle(yomiEntry: YomichanEntry, firstLineAsHeadword = true): KindleDictEntry {
  let headword = yomiEntry.term;
  const processedDefinitions: string[] = [];
  let updatedDefinitions = yomiEntry.definitions;

  if (firstLineAsHeadword && yomiEntry.definitions[0]) {
    const firstDefinition = yomichanDefinitionToHtmlText(yomiEntry.definitions[0]);
    const firstDefinitionSplit = firstDefinition.split('\n');
    const headerString = firstDefinitionSplit[0];
    headword = headerString;
    processedDefinitions.push(firstDefinitionSplit.slice(1).join('\n'))
    updatedDefinitions = yomiEntry.definitions.slice(1);
  }

  let inflections: KindleInflection[] = [];

  inflections.push({
    name: '読み方',
    value: toHiragana(yomiEntry.term),
  });
  inflections.push({
    name: '読み方',
    value: toKatakana(yomiEntry.term),
  });
  inflections.push({
    name: '読み方',
    value: toHiragana(yomiEntry.reading),
  });
  inflections.push({
    name: '読み方',
    value: toKatakana(yomiEntry.reading),
  });
  for (const yomiInflection of yomiEntry.inflectionRule.split(' ')) {
    switch (yomiInflection) {
      case InflectionRuleEnum.Godan: {
        if (/[うくすつぬふむるぐずづぶぷ]$/.test(yomiEntry.term)) {
          const pushGodanGeneralInflections = (word: string) => {
            if (word.length === 0) {
              return;
            }
            const wordBrokenDown = Array.from(word);
        
            const aForm = convertToDan(wordBrokenDown.slice(-1)[0], 'あ');
            if (aForm) {
              inflections.push({
                name: '未然形',
                value: word.replace(/.$/u, aForm),
              });
            }
        
            const oForm = convertToDan(wordBrokenDown.slice(-1)[0], 'お');
            if (oForm) {
              inflections.push({
                name: '未然形',
                value: word.replace(/.$/u, oForm),
              });
            }
        
            const eForm = convertToDan(wordBrokenDown.slice(-1)[0], 'え');
            if (eForm) {
              inflections.push({
                name: '仮定形・命令形',
                value: word.replace(/.$/u, eForm),
              });
            }
          };
        
          if (/[うつる]|(行く)$/.test(yomiEntry.term)) {
            inflections.push({
              name: '連用形',
              value: yomiEntry.term.replace(/.$/u, 'っ'),
            });
            inflections.push({
              name: '連用形',
              value: yomiEntry.reading.replace(/.$/u, 'っ'),
            });
          } else if (/[ぬぶ]$/.test(yomiEntry.term)) {
            inflections.push({
              name: '連用形',
              value: yomiEntry.term.replace(/.$/u, 'ん'),
            });
            inflections.push({
              name: '連用形',
              value: yomiEntry.reading.replace(/.$/u, 'ん'),
            });
          } else {
            const termBrokenDown = Array.from(yomiEntry.term);
            const iForm = convertToDan(termBrokenDown.slice(-1)[0], 'い');
            if (iForm) {
              inflections.push({
                name: '連用形',
                value: yomiEntry.term.replace(/.$/u, iForm),
              });
              inflections.push({
                name: '連用形',
                value: yomiEntry.reading.replace(/.$/u, iForm),
              });
            }
          }
          pushGodanGeneralInflections(yomiEntry.term);
          pushGodanGeneralInflections(yomiEntry.reading);
        }
        break;
      }
      case InflectionRuleEnum.Ichidan: {
        const pushIchidanGeneralInflections = (word: string) => {
          inflections.push({
            name: '未然形・連用形',
            value: word.replace(/る$/u, ''),
          });
          inflections.push({
            name: '仮定形',
            value: word.replace(/る$/u, 'れ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/る$/u, 'ろ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/る$/u, 'よ'),
          });
        };
        pushIchidanGeneralInflections(yomiEntry.term);
        pushIchidanGeneralInflections(yomiEntry.reading);
        break;
      }
      case InflectionRuleEnum.Kuru: {
        const pushKuruGeneralInflections = (word: string) => {
          // Handle all cases as term may be in hiragana form
          inflections.push({
            name: '未然形・連用形',
            value: word.replace(/来る$/u, '来'),
          });
          inflections.push({
            name: '仮定形',
            value: word.replace(/来る$/u, '来れ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/来る$/u, '来い'),
          });
          inflections.push({
            name: '未然形',
            value: word.replace(/くる$/u, 'こ'),
          });
          inflections.push({
            name: '連用形',
            value: word.replace(/くる$/u, 'き'),
          });
          inflections.push({
            name: '仮定形',
            value: word.replace(/くる$/u, 'くれ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/くる$/u, 'こい'),
          });
        };
        pushKuruGeneralInflections(yomiEntry.term);
        pushKuruGeneralInflections(yomiEntry.reading);
        break;
      }
      case InflectionRuleEnum.Suru: {
        const pushSuruGeneralInflections = (word: string) => {
          inflections.push({
            name: '未然形・連用形',
            value: word.replace(/する$/u, 'し'),
          });
          inflections.push({
            name: '未然形',
            value: word.replace(/する$/u, 'せ'),
          });
          inflections.push({
            name: '未然形',
            value: word.replace(/する$/u, 'さ'),
          });
          inflections.push({
            name: '終止形・連体形',
            value: word.replace(/する$/u, 'す'),
          });
          inflections.push({
            name: '仮定形',
            value: word.replace(/する$/u, 'すれ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/する$/u, 'しろ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/する$/u, 'せよ'),
          });
        };
        pushSuruGeneralInflections(yomiEntry.term);
        pushSuruGeneralInflections(yomiEntry.reading);
        break;
      }
      case InflectionRuleEnum.Zuru: {
        const pushSuruGeneralInflections = (word: string) => {
          inflections.push({
            name: '未然形・連用形',
            value: word.replace(/ずる$/u, 'じ'),
          });
          inflections.push({
            name: '未然形',
            value: word.replace(/ずる$/u, 'ぜ'),
          });
          inflections.push({
            name: '未然形',
            value: word.replace(/ずる$/u, 'ざ'),
          });
          inflections.push({
            name: '終止形・連体形',
            value: word.replace(/ずる$/u, 'ず'),
          });
          inflections.push({
            name: '仮定形',
            value: word.replace(/ずる$/u, 'ずれ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/ずる$/u, 'じろ'),
          });
          inflections.push({
            name: '命令形',
            value: word.replace(/ずる$/u, 'ぜよ'),
          });
        };
        pushSuruGeneralInflections(yomiEntry.term);
        pushSuruGeneralInflections(yomiEntry.reading);
        break;
      }
      case InflectionRuleEnum.IAdjective: {
        const pushIAdjectiveGeneralInflections = (word: string) => {
          inflections.push({
            name: '未然形',
            value: word.replace(/い$/u, 'かろ'),
          });
          inflections.push({
            name: '連用形',
            value: word.replace(/い$/u, 'かっ'),
          });
          inflections.push({
            name: '連用形',
            value: word.replace(/い$/u, 'く'),
          });
          inflections.push({
            name: '仮定形',
            value: word.replace(/い$/u, 'けれ'),
          });
        };
        pushIAdjectiveGeneralInflections(yomiEntry.term);
        pushIAdjectiveGeneralInflections(yomiEntry.reading);
        break;
      }
    }
  }

  inflections = _.uniqBy(inflections, (inf) => inf.value)
    .filter((inf) => inf.value !== yomiEntry.term && inf.value.length);

  return {
    headword: headword,
    hiddenLabel: yomiEntry.term,
    inflections,
    definition: [
      ...processedDefinitions,
      ...updatedDefinitions.map((d) => yomichanDefinitionToHtmlText(d)),
    ].join('\n'),
  }
}

export function kindleEntriesToXHtml(kindleEntries: KindleDictEntry[]): XMLBuilder {
  const xmlEntries: XMLBuilder[] = [];
  for (const kindleEntry of kindleEntries) {
    let xmlEntry = fragment()
      .ele('idx:entry', {
        name: 'japanese',
        scriptable: 'yes',
      })
      .ele('idx:short')
      .ele('idx:orth', {
        value: kindleEntry.hiddenLabel,
      }).ele('b').txt(kindleEntry.headword).up().up();

    if (kindleEntry.inflections.length) {
      xmlEntry = xmlEntry.ele('idx:infl');
      for (const inflection of kindleEntry.inflections) {
        xmlEntry = xmlEntry.ele('idx:iform', {
          name: inflection.name,
          value: inflection.value, 
        }).up();
      }
      xmlEntry = xmlEntry.up();
    }

    xmlEntry = xmlEntry.ele('p');
    const rows = kindleEntry.definition.split('\n');
    for (let i = 0; i < rows.length; i += 1) {
      xmlEntry = xmlEntry.txt(rows[i]);
      if (i !== rows.length - 1) {
        xmlEntry = xmlEntry.ele('br').up();
      }
    }
    xmlEntry = xmlEntry.up();
    xmlEntries.push(xmlEntry);
  }
  let finalResult = fragment()
    .ele('html', {
      'xmlns:math': 'http://exslt.org/math',
      'xmlns:svg': 'http://www.w3.org/2000/svg',
      'xmlns:tl': 'https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf',
      'xmlns:saxon': 'http://saxon.sf.net/',
      'xmlns:xs': 'http://www.w3.org/2001/XMLSchema',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xmlns:cx': 'https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:mbp': 'https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf',
      'xmlns:mmc': 'https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf',
      'xmlns:idx': 'https://kindlegen.s3.amazonaws.com/AmazonKindlePublishingGuidelines.pdf',
    })
    .ele('head').ele('meta', {
      'http-equiv': 'Content-Type',
      'content': 'text/html; charset=utf-8',
    }).up().up()
    .ele('body')
    .ele('mbp:frameset');
  for (const xmlEntry of xmlEntries) {
    finalResult = finalResult.import(xmlEntry.doc());
  }
  return finalResult;
}
