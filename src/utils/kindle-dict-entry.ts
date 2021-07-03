import { fragment } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { YomichanEntry } from '../yomichan/yomichan-formatter';
import { Definition, InflectionRuleEnum, StructuredContentItem } from '../yomichan/yomichan-types';

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

  const inflections: KindleInflection[] = [];

  const pushGodanGeneralInflections = (word: string) => {
    const wordBrokenDown = Array.from(word);

    const aForm = convertToDan(wordBrokenDown.slice(-1)[0], 'あ');
    if (aForm) {
      inflections.push({
        name: '未然形',
        value: [
          ...wordBrokenDown.slice(0, -1),
          aForm,
        ].join(''),
      });
    }

    const oForm = convertToDan(wordBrokenDown.slice(-1)[0], 'お');
    if (oForm) {
      inflections.push({
        name: '未然形',
        value: [
          ...wordBrokenDown.slice(0, -1),
          oForm,
        ].join(''),
      });
    }

    const eForm = convertToDan(wordBrokenDown.slice(-1)[0], 'え');
    if (eForm) {
      inflections.push({
        name: '仮定形/命令形',
        value: [
          ...wordBrokenDown.slice(0, -1),
          eForm,
        ].join(''),
      });
    }
  };

  for (const yomiInflection of yomiEntry.inflectionRule.split(' ')) {
    switch (yomiInflection) {
      case InflectionRuleEnum.Godan:
        if (/[うくすつぬふむるぐずづぶぷ]$/.test(yomiEntry.term)) {
          if (/[うつる]|(行く)$/.test(yomiEntry.term)) {
            inflections.push({
              name: '連用形',
              value: [
                ...Array.from(yomiEntry.term).slice(0, -1),
                'っ',
              ].join(''),
            });
            inflections.push({
              name: '連用形',
              value: [
                ...Array.from(yomiEntry.reading).slice(0, -1),
                'っ',
              ].join(''),
            });
          } else if (/[ぬぶ]$/.test(yomiEntry.term)) {
            inflections.push({
              name: '連用形',
              value: [
                ...Array.from(yomiEntry.term).slice(0, -1),
                'ん',
              ].join(''),
            });
            inflections.push({
              name: '連用形',
              value: [
                ...Array.from(yomiEntry.reading).slice(0, -1),
                'ん',
              ].join(''),
            });
          } else {
            const termBrokenDown = Array.from(yomiEntry.term);
            const iForm = convertToDan(termBrokenDown.slice(-1)[0], 'い');
            if (iForm) {
              inflections.push({
                name: '連用形',
                value: [
                  ...termBrokenDown.slice(0, -1),
                  iForm,
                ].join(''),
              });
              inflections.push({
                name: '連用形',
                value: [
                  ...Array.from(yomiEntry.reading).slice(0, -1),
                  iForm,
                ].join(''),
              });
            }
          }
          pushGodanGeneralInflections(yomiEntry.term);
          pushGodanGeneralInflections(yomiEntry.reading);
        }
        break;
      // case InflectionRuleEnum.Ichidan:
    }
  }

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
