import { ArgumentParser } from 'argparse';
import fsExtra, { copy, mkdirSync } from 'fs-extra';
import * as _ from 'lodash';
import path from 'path';
import { fragment } from 'xmlbuilder2';
import { loadDict } from './utils/load-dict';
import { KindleDictEntry, kindleEntriesToXHtml, KindleInflection, yomichanEntryToKindle } from './utils/kindle-dict-entry';
import { Definition, } from './yomichan/yomichan-types';
import { hasOwnProperty } from './utils/hasOwnProperty';
import { path_fix } from './utils/kindle-dict-entry';


import { mergeDictData } from './utils/merge-dict-data';
import util from 'util';
import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';

function spawna(cmd: string, args: string[] = []): Promise<any> {
  return new Promise(function (resolve, reject) {
    const process = spawn(cmd, args);
    process.on('close', function (code) { // Should probably be 'exit', not 'close'
      resolve(code);
    });
    process.on('error', function (err) {
      reject(err);
    });
  })
}
function copyPath(input: string, output: string, opath: string, convert: boolean, cache: Set<string>): Promise<any>{
  const fixed_path = path_fix(opath)
  const ip = path.join(input, opath)
  let op = path.join(output, opath)
  const root_dir = path.dirname(op)
  console.log(ip)
  if (!cache.has(root_dir)){
    mkdirSync(root_dir, { recursive: true })
    console.log(root_dir)
    cache.add(root_dir)
  } 
  if (convert && fixed_path != opath) {
    op = path.join(output, fixed_path)
    
    return spawna('convert', [ip, '-background', 'white', '-alpha', 'remove', op])
  } else {
    return fsExtra.copy(ip, op);
  }
}

function copyDef(input:string, output: string, def: Definition | Definition[], convert:boolean, cache: Set<string>): Promise<any>[]{
  if (Array.isArray(def)) {
    return def.map(i => copyDef(input, output, i, convert, cache)).flat()
  } else if (typeof def === 'string') { 
    return []
  } else if (hasOwnProperty(def, 'content')) {
    return copyDef(input, output, def.content, convert, cache)
  } else if (hasOwnProperty(def, 'path')) {
    if (!cache.has(def.path)){
      const a = copyPath(input, output, def.path, convert, cache)
      cache.add(def.path)
      return [a]
    }
  } 
  return []
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
  let backlog : Promise<any>[] = [];
  for (const yomiEntry of yomiEntries) {
    kindleEntries.push(yomichanEntryToKindle(yomiEntry, true));
    const res = yomiEntry.definitions.map(x => copyDef(input, output, x, convert_img, cache));
    backlog.push(...res.flat())
    if (backlog.length > 100){
      await Promise.all(backlog)
      backlog = []
    }
  }
  await Promise.all(backlog)

  const groupedKindleEntries = _.groupBy(kindleEntries, (kindleEntry) => `${kindleEntry.headword}|${kindleEntry.definition}`);
  kindleEntries = Object.values(groupedKindleEntries).map((similarKindleEntries): KindleDictEntry => {
    const mergedSearchDataList = similarKindleEntries.flatMap((x) => x.searchDataList);

    return {
      headword: similarKindleEntries[0].headword,
      boldHeadWord: similarKindleEntries[0].boldHeadWord,
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
  const chunkedKindleEntries = _.chunk(kindleEntries, 1000);
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


