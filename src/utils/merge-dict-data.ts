import * as _ from 'lodash';
import { YomichanEntry } from "../yomichan/yomichan-formatter";
import { loadDict } from "./load-dict";

function generateTermMap(entries: YomichanEntry[]): {
  [term: string]: {
    [reading: string]: YomichanEntry[];
  };
} {
  const result: {
    [term: string]: {
      [reading: string]: YomichanEntry[];
    };
  } = {};
  for (const yomiEntry of entries) {
    const termObj = result[yomiEntry.term] || {};
    result[yomiEntry.term] = termObj;
    const readingList = termObj[yomiEntry.reading] || [];
    termObj[yomiEntry.reading] = readingList;

    readingList.push(yomiEntry);
  }
  return result;
}

function generateMapBySequence(entries: YomichanEntry[]): {
  [sequence: number]: YomichanEntry[];
} {
  const result: {
    [sequence: number]: YomichanEntry[];
  } = {};
  for (const yomiEntry of entries) {
    const sequenceList = result[yomiEntry.sequence] || [];
    result[yomiEntry.sequence] = sequenceList;
    sequenceList.push(yomiEntry);
  }
  return result;
}

export async function mergeDictData(currentEntries: YomichanEntry[], dictPath: string) {
  const data = await loadDict(dictPath);
  const refDictEntryMap = generateTermMap(data);
  const refDictSequenceMap = generateMapBySequence(data);
  const currentEntryMap = generateTermMap(currentEntries);

  const newValues: YomichanEntry[] = [];

  const processRefDictInfo = (currentEntry: YomichanEntry, refDictEntryList: YomichanEntry[]) => {
    currentEntry.frequency = refDictEntryList
      .map((x) => x.frequency)
      .reduce((a, b) => Math.max(a, b));

    if (!currentEntry.inflectionRule) {
      currentEntry.inflectionRule = _.uniq(
        refDictEntryList
          .flatMap((x) => x.inflectionRule.split(' '))
          .filter(x => !!x)
      ).join(' ');
    }

    for (const refDictEntry of refDictEntryList) {
      const possibleTerms = refDictSequenceMap[refDictEntry.sequence];
      
      for (const refDictAltTerm of possibleTerms) {
        if (refDictAltTerm.term !== currentEntry.term && !currentEntryMap[refDictAltTerm.term]) {
          newValues.push(new YomichanEntry({
            term: refDictAltTerm.term,
            reading: currentEntry.reading,
            definitionTag: currentEntry.definitionTag,
            inflectionRule: currentEntry.inflectionRule,
            frequency: currentEntry.frequency,
            definitions: currentEntry.definitions,
            sequence: currentEntry.sequence,
            tag: currentEntry.tag,
          }));
        }
      }
    }
  };

  for (const yomiEntry of currentEntries) {
    const refDictTermObj = refDictEntryMap[yomiEntry.term];
    if (refDictTermObj) {
      if (yomiEntry.reading) {
        const refDictEntryList = refDictTermObj[yomiEntry.reading];
        if (refDictEntryList) {
          processRefDictInfo(yomiEntry, refDictEntryList);
        }
      } else {
        const firstList = Object.values(refDictTermObj)[0];
        processRefDictInfo(yomiEntry, firstList);
      }
    }
  }

  return currentEntries.concat(newValues);
}