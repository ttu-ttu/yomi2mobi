import { fragment } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { YomichanEntry } from '../yomichan/yomichan-formatter';
import {
  Definition,
  ImageDefinition,
  InflectionRuleEnum,
  StructuredContentItem,
  StructuredContentItemObject,
  StructuredContentItemObjectImage,
  StructuredContentItemStyle,
} from '../yomichan/yomichan-types';
import { hasOwnProperty } from './hasOwnProperty';
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
  headwords: string[];
  boldHeadword: boolean;
  searchDataList: KindleSearchData[];
  definitions: XMLBuilder[];
  frequency: number;
}

function stringDefinitionToHtmlText(item: string, headword: boolean): [XMLBuilder, boolean] {
  let f = fragment();
  const lines = item.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (headword && i === 0) {
      f = f.ele('b').txt(lines[i]).up();
    } else {
      f = f.txt(lines[i]);
    }
    if (i < lines.length - 1) {
      f = f.ele('br').up();
    }
  }
  return [f, !/\n/.test(item) && headword];
}

function structuredContentItemToHtmlText(item: StructuredContentItem, headword: boolean, filePathMap: Record<string, string>): [XMLBuilder, boolean] {
  let f = fragment();
  if (typeof item === 'string') {
    return stringDefinitionToHtmlText(item, headword);
  } else if (Array.isArray(item)) {
    let currentHeadword = headword;
    for (const subItem of item) {
      const [subF, subHeadword] = structuredContentItemToHtmlText(subItem, currentHeadword, filePathMap);
      f.import(subF.doc());
      currentHeadword = subHeadword;
    }
    return [f, currentHeadword];
  } else if (item.tag == 'img' && hasOwnProperty(item, 'path')) {
    return [imgToXML(item, filePathMap), headword]
  } else {
    return tagToXML(item, headword, filePathMap);
  }
}

function imgToXML(s: ImageDefinition | StructuredContentItemObjectImage, filePathMap: Record<string, string>): XMLBuilder {
  let f = fragment();
  let conf :{[x:string] : any} = {
    'src': filePathMap[s.path] || s.path,
    'alt': s.title,
  };

  const unit = (s as StructuredContentItemObjectImage).sizeUnits || 'px'
  let style: any = {};
  if (s.width)
    style = {...style, width: s.width.toString() + unit}
  if (s.height)
    style = {...style, height: s.height.toString() + unit}
  if (s.imageRendering)
    style = {...style, imageRendering: s.imageRendering}
  if ('verticalAlign' in s)
    style = {...style, verticalAlign: s.verticalAlign}

  if (Object.keys(style).length) {
    const sstyle = flatten_css(style)
    if (sstyle.length > 0)
      conf['style'] = sstyle
  }

  f.ele('img', conf)
  return f;
}
function flatten_css(obj_style: Record<string, any>) : string{
  let style = Object.entries(obj_style).
    map(([k, v]) =>
      `${k.replace(/[A-Z]/g,match => `-${match.toLowerCase()}`)}:${v}`).join(';');
  if (style.length > 0)
    style += ';';
  return style.replace(/;$/, '');
}
const tag_saved_prop = ['tag', 'style', 'content']
function tagToXML(item: StructuredContentItemObject & {
  content?: StructuredContentItem;
  style?: StructuredContentItemStyle;
}, headword: boolean, filePathMap: Record<string, string>): [XMLBuilder, boolean] {
  const handledStyles: (keyof StructuredContentItemStyle)[] = [
    'fontStyle',
    'fontWeight',
    'textDecorationLine',
    'verticalAlign',
  ];
  let f = fragment()
  let conf: {[x: string]: any} = {}
  for (const k of Object.keys(item)) {
    if (tag_saved_prop.filter(x => x == k).length > 0)
       continue
    // @ts-ignore
    conf[k] = item[k]
  }

  if (item.style) {
    const filteredStyle = Object.entries(item.style)
      .filter(([k]) => !handledStyles.includes(k as any))
      .reduce<Record<string, string>>((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});
    const style = flatten_css(filteredStyle);
    if (style.length > 0) {
      conf['style'] = style;
    }
  }

  let addedTags: string[] = [];
  if (item.style) {
    for (const handledStyle of handledStyles) {
      const propVal = item.style[handledStyle];
      if (propVal) {
        switch (handledStyle) {
          case 'fontStyle':
            if (propVal === 'italic') {
              addedTags.push('i');
            }
            break;
          case 'fontWeight':
            if (propVal === 'bold') {
              addedTags.push('b');
            }
            break;
          case 'textDecorationLine':
            switch (propVal) {
              case 'underline':
                addedTags.push('u');
                break;
              case 'line-through':
                addedTags.push('s');
                break;
            }
            break;
          case 'verticalAlign':
            switch (propVal) {
              case 'super':
                addedTags.push('sup');
                break;
              case 'sub':
                addedTags.push('sub');
                break;
            }
            break;
        }
      }
    }
  }

  if (item.tag === 'span' && addedTags.length) {
    f = f.ele(addedTags[0], conf);
    addedTags = addedTags.slice(1);
  } else {
    f = f.ele(item.tag, conf)
  }

  for (const addedTag of addedTags) {
    f = f.ele(addedTag);
  }

  let currentHeadword = headword;
  if (item.content) {
    const [subF, subHeadword] = structuredContentItemToHtmlText(item.content, currentHeadword, filePathMap);
    f = f.import(subF.doc());
    currentHeadword = subHeadword;
  }
  return [f, item.tag !== 'br' && currentHeadword];
}

function yomichanDefinitionToHtmlText(definition: Definition, headword: boolean, filePathMap: Record<string, string>): [XMLBuilder, boolean] {
  if (typeof definition === 'string') {
    return stringDefinitionToHtmlText(definition, headword);
  } else if (definition.type === 'text') {
    return stringDefinitionToHtmlText(definition.text, headword);
  } else if (definition.type === 'image') {
    let f = imgToXML(definition, filePathMap);
    f = f.ele('br').up();
    if (definition.description) {
      f = f.txt(definition.description);
    }
    return [f, headword];
  }
  return structuredContentItemToHtmlText(definition.content, headword, filePathMap);
}

function convertToDan(changingKana: string, newDan: '???' | '???' | '???' | '???' | '???') {
  if (changingKana.length !== 1) {
    return;
  }
  const kanaTable =  `
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????
    ???????????????`
    .replace(/\s/g, '')
    .match(/.{1,5}/g)!;
  const matchingRow = kanaTable.find((row) => row.includes(changingKana));
  if (matchingRow) {
    switch (newDan) {
      case '???':
        return matchingRow.charAt(0);
      case '???':
        return matchingRow.charAt(1);
      case '???':
        return matchingRow.charAt(2);
      case '???':
        return matchingRow.charAt(3);
      case '???':
        return matchingRow.charAt(4);
    }
  }
}



function generateJiruZuruInflections(term: string) {
  const inflections: KindleInflection[] = [];
  inflections.push({
    name: '?????????????????????',
    value: term.replace(/[??????]???$/u, '???'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '???'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '???'),
  });
  inflections.push({
    name: '?????????????????????',
    value: term.replace(/[??????]???$/u, '??????'),
  });
  inflections.push({
    name: '?????????????????????',
    value: term.replace(/[??????]???$/u, '??????'),
  });
  inflections.push({
    name: '?????????????????????',
    value: term.replace(/[??????]???$/u, '???'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '??????'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '??????'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '??????'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '??????'),
  });
  inflections.push({
    name: '?????????',
    value: term.replace(/[??????]???$/u, '??????'),
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
        if (/[???????????????????????????????????????]$/.test(term)) {
          const pushGodanGeneralInflections = (word: string) => {
            if (word.length === 0) {
              return;
            }
            const wordBrokenDown = Array.from(word);

            const aForm = convertToDan(wordBrokenDown.slice(-1)[0], '???');
            if (aForm) {
              inflections.push({
                name: '?????????',
                value: word.replace(/.$/u, aForm),
              });
            }

            const oForm = convertToDan(wordBrokenDown.slice(-1)[0], '???');
            if (oForm) {
              inflections.push({
                name: '?????????',
                value: word.replace(/.$/u, oForm),
              });
            }

            const eForm = convertToDan(wordBrokenDown.slice(-1)[0], '???');
            if (eForm) {
              inflections.push({
                name: '?????????????????????',
                value: word.replace(/.$/u, eForm),
              });
            }
          };


          const termBrokenDown = Array.from(term);
          const iForm = convertToDan(termBrokenDown.slice(-1)[0], '???');
          if (iForm) {
            inflections.push({
              name: '?????????',
              value: term.replace(/.$/u, iForm),
            });
          }

          if (/[??????]$/.test(term)) {
            inflections.push({
              name: '?????????',
              value: term.replace(/.$/u, '???'),
            });

          } else if (/[?????????]$/.test(term) || /??????$/.test(origTerm)) {
            inflections.push({
              name: '?????????',
              value: term.replace(/.$/u, '???'),
            });
          } else if (/[?????????]$/.test(term)) {
            inflections.push({
              name: '?????????',
              value: term.replace(/.$/u, '???'),
            });
          }
          pushGodanGeneralInflections(term);
        }
        break;
      }
      case InflectionRuleEnum.Ichidan: {
        const pushIchidanGeneralInflections = (word: string) => {
          inflections.push({
            name: '?????????????????????',
            value: word.replace(/???$/u, ''),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/???$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/???$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/???$/u, '???'),
          });
        };
        pushIchidanGeneralInflections(term);
        break;
      }
      case InflectionRuleEnum.Kuru: {
        const pushKuruGeneralInflections = (word: string) => {
          // Handle all cases as term may be in hiragana form
          inflections.push({
            name: '?????????????????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '??????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '??????',
            value: word.replace(/??????$/u, '??????'),
          });
        };
        pushKuruGeneralInflections(term);
        break;
      }
      case InflectionRuleEnum.Suru: {
        const pushSuruGeneralInflections = (word: string) => {
          inflections.push({
            name: '?????????????????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????????????????',
            value: word.replace(/??????$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/??????$/u, '??????'),
          });
          inflections.push({
            name: '??????',
            value: word.replace(/??????$/u, '??????'),
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
            name: '?????????',
            value: word.replace(/???$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/???$/u, '??????'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/???$/u, '???'),
          });
          inflections.push({
            name: '?????????',
            value: word.replace(/???$/u, '??????'),
          });
          // Need this if the original contains ???/?????? entry but we want modern usage
          inflections.push({
            name: '??????',
            value: word.replace(/???$/u, ''),
          });
        };
        pushIAdjectiveGeneralInflections(term);
        break;
      }
    }

    // Custom inflections
    if (/??????$/.test(term)) {
      // ????????? -> ?????????
      switch (yomiInflection) {
        case InflectionRuleEnum.Ichidan:
        case InflectionRuleEnum.Godan:
        case InflectionRuleEnum.Zuru: {
          inflections.push(...generateJiruZuruInflections(term));
          break;
        }
      }
    } else if (/??????$/.test(term)) {
      // ????????? -> ?????????
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

export function yomichanEntryToKindle(yomiEntry: YomichanEntry, firstLineAsHeadword: boolean, filePathMap: Record<string, string>): KindleDictEntry {
  let headword = yomiEntry.term;
  let updatedDefinitions = yomiEntry.definitions;

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
      term[i + 1] = '???';
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
  let definitions: XMLBuilder[] = []
  let boldHeadword = true
  if (updatedDefinitions.length > 0) {
    const [head, ...tail] = updatedDefinitions
    const [firstDef, stat] = yomichanDefinitionToHtmlText(head, firstLineAsHeadword, filePathMap)
    boldHeadword = stat;
    definitions.push(firstDef)
    definitions.push(...tail.map((d) => yomichanDefinitionToHtmlText(d, false, filePathMap)[0]))
  }
  return {
    headwords: [headword],
    boldHeadword,
    searchDataList: _.uniqBy(searchDataList, (x) => x.term),
    definitions,
    frequency: yomiEntry.frequency,
  }
}

export function combineDefinitions(definitions: XMLBuilder[]) {
  let result = fragment();
  for (let i = 0; i < definitions.length; i += 1) {
    if (i > 0)
      result = result.ele('br').up();
    result = result.import(definitions[i].doc());
  }
  return result;
}

export function kindleEntriesToXHtml(kindleEntries: KindleDictEntry[]): XMLBuilder {
  const xmlEntries: XMLBuilder[] = [];
  for (const kindleEntry of kindleEntries) {
    let xmlEntry = fragment()
      .ele('idx:entry', {
        name: 'j',
        scriptable: 'yes',
      })
      .ele('idx:short');

    const possibleForms: string[] = [];
    for (const searchData of kindleEntry.searchDataList) {
      possibleForms.push(searchData.term);
      // Treat inflections as new writing as idx:infl doesn't deinflect ?????? -> ?????????
      for (const inflection of searchData.inflections) {
        possibleForms.push(inflection.value);
      }
    }

    for (const value of _.uniq(possibleForms)) {
      xmlEntry = xmlEntry.ele('idx:orth', {
        value: value,
      }).up();
    }

    if (kindleEntry.boldHeadword) {
      xmlEntry = xmlEntry.ele('b').txt(_.uniq(kindleEntry.headwords).join('???')).up();
    }

    xmlEntry = xmlEntry.ele('div')
      .import(combineDefinitions(kindleEntry.definitions).doc())
      .up();
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
