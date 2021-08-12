import { ArgumentParser } from 'argparse';
import fsExtra, { copy } from 'fs-extra';
import * as _ from 'lodash';
import path from 'path';
import { fragment } from 'xmlbuilder2';
import { loadDict } from './utils/load-dict';
import { KindleDictEntry, kindleEntriesToXHtml, KindleInflection, yomichanEntryToKindle } from './utils/kindle-dict-entry';
import { Definition, } from './yomichan/yomichan-types';
import { hasOwnProperty } from './utils/hasOwnProperty';
import { path_fix } from './utils/kindle-dict-entry';
import { exec, spawn } from 'child_process';
import { mergeDictData } from './utils/merge-dict-data';

import util from 'util';

const execa = util.promisify(exec);
function copyPath(input: string, output: string, opath: string, convert: boolean): Promise<any>{
  const fixed_path = path_fix(opath)
  if (convert && fixed_path != opath) {
    const ip = path.join(input, opath)
    const op = path.join(output, fixed_path)
    const command = `convert ${ip} -background white -alpha remove ${op}`
    // TODO make the directory w/o copying anything
    return fsExtra.copy(path.join(input, opath), path.join(output, opath)).then(_ => execa(command))
  } else {
    return fsExtra.copy(path.join(input, opath), path.join(output, opath));
  }
}

function copyDef(input:string, output: string, def: Definition | Definition[], convert:boolean, cache: Set<string>) : Array<Promise<any>> {
  const ret: Array<Promise<any>> = [];
  if (Array.isArray(def)) {
    for (const i of def)
      ret.push(...copyDef(input, output, i, convert, cache))
  } else if (typeof def === 'string') { 

  } else if (hasOwnProperty(def, 'content')) {
    ret.push(...copyDef(input, output, def.content, convert, cache))
  } else if (hasOwnProperty(def, 'path')) {
    if (!cache.has(def.path)){
      ret.push(copyPath(input, output, def.path, convert))
      cache.add(def.path)
    }
  }
  return ret
}

// For unsupported characters (personal use)
function customReplacements(value: string) {
  value = value.replace(/1️⃣/g, '<b>[一]</b>');
  value = value.replace(/2️⃣/g, '<b>[二]</b>');
  value = value.replace(/3️⃣/g, '<b>[三]</b>');
  value = value.replace(/4️⃣/g, '<b>[四]</b>');
  value = value.replace(/5️⃣/g, '<b>[五]</b>');
  value = value.replace(/6️⃣/g, '<b>[六]</b>');
  return value;
}

async function main(args: Partial<{

  input: string;
  output: string;
  title: string;
  author: string;
  main_dict: string;
  debug: boolean;
  no_img_conv: boolean;
}>) {
  if (!args.input || !args.output || !args.title) {
    parser.print_help();
    return;
  }
  const input: string = args.input;
  const output: string = args.output;
  let yomiEntries = await loadDict(args.input);
  console.log('loaded dict')
  args.no_img_conv && console.log("image convertion: ", !args.no_img_conv)
  if (args.main_dict) {
    yomiEntries = await mergeDictData(yomiEntries, args.main_dict);
  }
  
  yomiEntries = yomiEntries.sort((a, b) => b.frequency - a.frequency);

  let kindleEntries: KindleDictEntry[] = [];
  const convert_img = args.no_img_conv === undefined ? true : !args.no_img_conv;
  const cache = new Set<string>()
  let waits: Promise<any>[] = []
  for (const yomiEntry of yomiEntries) {
    kindleEntries.push(yomichanEntryToKindle(yomiEntry, true));
    const res = yomiEntry.definitions.map(x => copyDef(input, output, x, convert_img, cache));
    waits.push(...res.flat())
    if (waits.length > 1000){
      await Promise.all(waits)
      waits = []
    }
  }
  await Promise.all(waits)
  waits = []

  const groupedKindleEntries = _.groupBy(kindleEntries, (kindleEntry) => `${kindleEntry.headword}|${kindleEntry.definition}`);
  kindleEntries = Object.values(groupedKindleEntries).map((similarKindleEntries): KindleDictEntry => {
    const mergedSearchDataList = similarKindleEntries.flatMap((x) => x.searchDataList);

    return {
      headword: similarKindleEntries[0].headword,
      searchDataList: _.uniqBy(mergedSearchDataList, (x) => x.term),
      definition: similarKindleEntries[0].definition,
    };
  });

  const contents: {
    id: string;
    filename: string;
  }[] = [];

  const outputDir = args.output;
  fsExtra.mkdirpSync(outputDir);
  const chunkedKindleEntries = _.chunk(kindleEntries, 50000);
  console.log("writing html files")
  for (let i = 0; i < chunkedKindleEntries.length; i += 1) {
    const doc = kindleEntriesToXHtml(chunkedKindleEntries[i]);
    const outputFilename = `entries-${i}.html`;
    contents.push({
      id: `entries-${i}`,
      filename: outputFilename,
    });
    let value = doc.end({ prettyPrint: args.debug });
    value = customReplacements(value);
    fsExtra.writeFileSync(path.join(outputDir, outputFilename), value);

    console.log(`Progress: ${i}/${chunkedKindleEntries.length} (${(i / chunkedKindleEntries.length * 100).toFixed(2)}%)`);
  }

  let opfXml = fragment()
    .ele('package', {
      version: '2.0',
      xmlns: 'http://www.idpf.org/2007/opf',
    })
    .ele('metadata')
      .ele('dc:title').txt(args.title).up();
  if (args.author) {
    opfXml = opfXml.ele('dc:creator', {
      'opf:role': 'aut',
    }).txt(args.author).up();
  }
  opfXml = opfXml
      .ele('dc:language').txt('ja').up()
      .ele('x-metadata')
        .ele('DictionaryInLanguage').txt('ja').up()
        .ele('DictionaryOutLanguage').txt('ja').up()
        .ele('DefaultLookupIndex').txt('japanese').up()
      .up()
    .up();
  
  opfXml = opfXml.ele('manifest');
  for (const content of contents) {
    opfXml = opfXml.ele('item', {
      id: content.id,
      href: content.filename,
      'media-type': 'application/xhtml+xml',
    }).up();
  }
  opfXml = opfXml.up();
  
  opfXml = opfXml.ele('spine');
  for (const content of contents) {
    opfXml = opfXml.ele('itemref', {
      idref: content.id,
    }).up();
  }
  opfXml = opfXml.up();

  fsExtra.writeFileSync(path.join(outputDir, `${args.title}.opf`), opfXml.end( {
    prettyPrint: args.debug,
  }));
  
}


const parser = new ArgumentParser({
  description: 'Argparse example'
});
 
parser.add_argument('-i', '--input', { help: 'Input directory' });
parser.add_argument('-o', '--output', { help: 'Output directory' });
parser.add_argument('-t', '--title', { help: 'Title of the dictionary' });
parser.add_argument('-a', '--author', { help: 'Author' });
parser.add_argument('-m', '--main_dict', { help: 'Main dictionary to use as reference (for alt writing and frequency)' });
parser.add_argument('--debug', { const: true, action: 'store_const', help: 'Print in a readable format' });
parser.add_argument('--no-img-conv', { const: true, action: 'store_const', help: 'Also include other conjugations' })
main(parser.parse_args());
