import fsExtra from 'fs-extra';
import path from 'path';
import { YomichanEntry } from '../yomichan/yomichan-formatter';
import { YomichanSchemaV3 } from '../yomichan/yomichan-types';

export async function loadDict(dictPath: string) {
  const yomiEntries: YomichanEntry[] = [];
  const files = fsExtra.readdirSync(dictPath);
  for (const file of files.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}))) {
    if (!file.startsWith('term_bank')) {
      continue;
    }

    const data: YomichanSchemaV3[] = JSON.parse(fsExtra.readFileSync(path.join(dictPath, file), 'utf-8'));
  
    for (const entry of data) {
      yomiEntries.push(new YomichanEntry({
        term: entry[0],
        reading: entry[1],
        definitionTag: entry[2],
        inflectionRule: entry[3],
        frequency: entry[4],
        definitions: entry[5],
        sequence: entry[6],
        tag: entry[7],
      }));
    }
  }
  return yomiEntries;
}
