import { fragment } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { YomichanEntry } from '../yomichan/yomichan-formatter';
import { Definition, InflectionRuleEnum, StructuredContentItem } from '../yomichan/yomichan-types';
import { toHiragana, toKatakana } from './kana-transformations';
import * as _ from 'lodash';

export interface KindleInflection {
  name: string;
  value: string;
}

export interface KindleSearchData {
  term: string;
  inflections: KindleInflection[];
}

export interface KindleDictEntry {
  headword: string;
  searchDataList: KindleSearchData[];
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

function generateJiruZuruInflections(term: string) {
  const inflections: KindleInflection[] = [];
  inflections.push({
    name: '未然形・連用形',
    value: term.replace(/[ずじ]る$/u, 'じ'),
  });
  inflections.push({
    name: '未然形',
    value: term.replace(/[ずじ]る$/u, 'ぜ'),
  });
  inflections.push({
    name: '未然形',
    value: term.replace(/[ずじ]る$/u, 'ざ'),
  });
  inflections.push({
    name: '終止形・連体形',
    value: term.replace(/[ずじ]る$/u, 'ずる'),
  });
  inflections.push({
    name: '終止形・連体形',
    value: term.replace(/[ずじ]る$/u, 'じる'),
  });
  inflections.push({
    name: '終止形・連体形',
    value: term.replace(/[ずじ]る$/u, 'ず'),
  });
  inflections.push({
    name: '仮定形',
    value: term.replace(/[ずじ]る$/u, 'ずれ'),
  });
  inflections.push({
    name: '仮定形',
    value: term.replace(/[ずじ]る$/u, 'じれ'),
  });
  inflections.push({
    name: '命令形',
    value: term.replace(/[ずじ]る$/u, 'じろ'),
  });
  inflections.push({
    name: '命令形',
    value: term.replace(/[ずじ]る$/u, 'じよ'),
  });
  inflections.push({
    name: '命令形',
    value: term.replace(/[ずじ]る$/u, 'ぜよ'),
  });
  return inflections.filter((inf) => inf.value !== term);
}

function generateInflections(data: { term: string; inflectionRule: string; origTerm: string }) {
  const { term, inflectionRule, origTerm } = data;
  const inflections: KindleInflection[] = [];
  
  for (const yomiInflection of inflectionRule.split(' ')) {
    // Common inflections
    switch (yomiInflection) {
      case InflectionRuleEnum.Godan: {
        if (/[うくすつぬふむるぐずづぶぷ]$/.test(term)) {
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
          
          const termBrokenDown = Array.from(term);
          const iForm = convertToDan(termBrokenDown.slice(-1)[0], 'い');
          if (iForm) {
            inflections.push({
              name: '連用形',
              value: term.replace(/.$/u, iForm),
            });
          }
          
          if (/[くぐ]$/.test(term)) {
            inflections.push({
              name: '連用形',
              value: term.replace(/.$/u, 'い'),
            });
          } else if (/[うつる]$/.test(term) || /行く$/.test(origTerm)) {
            inflections.push({
              name: '連用形',
              value: term.replace(/.$/u, 'っ'),
            });
          } else if (/[ぬぶむ]$/.test(term)) {
            inflections.push({
              name: '連用形',
              value: term.replace(/.$/u, 'ん'),
            });
          }
          pushGodanGeneralInflections(term);
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
        pushIchidanGeneralInflections(term);
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
        pushKuruGeneralInflections(term);
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
        pushSuruGeneralInflections(term);
        break;
      }
      case InflectionRuleEnum.Zuru: {
        inflections.push(...generateJiruZuruInflections(term));
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
          // Need this if the original contains し/しく entry but we want modern usage
          inflections.push({
            name: '派生',
            value: word.replace(/い$/u, ''),
          });
        };
        pushIAdjectiveGeneralInflections(term);
        break;
      }
    }

    // Custom inflections
    if (/じる$/.test(term)) {
      // 投じる -> 投ずる
      switch (yomiInflection) {
        case InflectionRuleEnum.Ichidan:
        case InflectionRuleEnum.Godan:
        case InflectionRuleEnum.Zuru: {
          inflections.push(...generateJiruZuruInflections(term));
          break;
        }
      }
    } else if (/ずる$/.test(term)) {
      // 投ずる -> 投じる
      switch (yomiInflection) {
        case InflectionRuleEnum.Ichidan:
        case InflectionRuleEnum.Godan:
        case InflectionRuleEnum.Zuru: {
          inflections.push(...generateJiruZuruInflections(term));
          break;
        }
      }
    }
  }

  return _.uniqBy(inflections, (inf) => inf.value)
    .filter((inf) => inf.value !== term && inf.value.length);
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

  let searchDataList: KindleSearchData[] = [
    yomiEntry.term,
    yomiEntry.reading,
  ].filter((term) => !!term)
  .map((term) => ({
    term,
    inflections: [],
  }));

  for (let i = 0; i < yomiEntry.term.length - 1; i++) {
    let term = Array.from(yomiEntry.term);
    if (yomiEntry.term[i] === yomiEntry.term[i + 1] && /(\p{Unified_Ideograph})/u.test(yomiEntry.term[i])) {
      term[i + 1] = '々';
      searchDataList.push({
        term: term.join(''),
        inflections: [],
      });
    }
  }

  for (const searchData of searchDataList) {
    searchData.inflections = generateInflections({
      term: searchData.term,
      inflectionRule: yomiEntry.inflectionRule,
      origTerm: yomiEntry.term,
    });
  }

  return {
    headword: headword,
    searchDataList: _.uniqBy(searchDataList, (x) => x.term),
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
      .ele('idx:short');

    const possibleForms: string[] = [];
    for (const searchData of kindleEntry.searchDataList) {
      possibleForms.push(searchData.term);

      // Treat inflections as new writing as idx:infl doesn't deinflect 敗北 -> 敗北る
      for (const inflection of searchData.inflections) {
        possibleForms.push(inflection.value);
      }
    }

    for (const value of _.uniq(possibleForms)) {
      xmlEntry = xmlEntry.ele('idx:orth', {
        value: value,
      }).up();
    }

    xmlEntry = xmlEntry.ele('b').txt(kindleEntry.headword).up();

    xmlEntry = xmlEntry.ele('div');
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
