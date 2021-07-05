import { ArgumentParser } from 'argparse';
import fsExtra from 'fs-extra';
import * as _ from 'lodash';
import path from 'path';
import { fragment } from 'xmlbuilder2';
import { loadDict } from './utils/load-dict';
import { KindleDictEntry, kindleEntriesToXHtml, KindleInflection, yomichanEntryToKindle } from './utils/kindle-dict-entry';


async function main(args: Partial<{
  input: string;
  output: string;
  title: string;
  author: string;
  debug: boolean;
}>) {
  if (!args.input || !args.output || !args.title) {
    parser.print_help();
    return;
  }
  let yomiEntries = await loadDict(args.input);

  yomiEntries = yomiEntries.sort((a, b) => b.frequency - a.frequency);

  let kindleEntries: KindleDictEntry[] = [];
  for (const yomiEntry of yomiEntries) {
    kindleEntries.push(yomichanEntryToKindle(yomiEntry));
  }
  const groupedKindleEntries = _.groupBy(kindleEntries, (kindleEntry) => `${kindleEntry.headword}|${kindleEntry.definition}`);
  kindleEntries = Object.values(groupedKindleEntries).map((similarKindleEntries): KindleDictEntry => {
    let mergedInflections: KindleInflection[] = [];
    for (const kindleEntry of similarKindleEntries) {
      if (kindleEntry.hiddenLabel) {
        mergedInflections.push({
          name: '書き方',
          value: kindleEntry.hiddenLabel,
        });
      }
      mergedInflections.push(...kindleEntry.inflections);
    }
    mergedInflections = _.uniqBy(mergedInflections, (inf) => inf.value)
      .filter((inf) => inf.value !== similarKindleEntries[0].hiddenLabel);

    return {
      headword: similarKindleEntries[0].headword,
      hiddenLabel: similarKindleEntries[0].hiddenLabel,
      inflections: mergedInflections,
      definition: similarKindleEntries[0].definition,
    };
  })


  const contents: {
    id: string;
    filename: string;
  }[] = [];

  const outputDir = args.output;
  fsExtra.mkdirpSync(outputDir);

  const chunkedKindleEntries = _.chunk(kindleEntries, 100);
  for (let i = 0; i < chunkedKindleEntries.length; i += 1) {
    const doc = kindleEntriesToXHtml(chunkedKindleEntries[i]);
    const outputFilename = `entries-${i}.html`;
    contents.push({
      id: `entries-${i}`,
      filename: outputFilename,
    });
    fsExtra.writeFileSync(path.join(outputDir, outputFilename), doc.end({ prettyPrint: args.debug }));

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
parser.add_argument('--debug', { const: true, action: 'store_const', help: 'Print in a readable format' });

main(parser.parse_args());
