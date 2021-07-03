import { ArgumentParser } from 'argparse';
import fsExtra from 'fs-extra';
import * as _ from 'lodash';
import path from 'path';
import { fragment } from 'xmlbuilder2';
import { loadDict } from './utils/load-dict';
import { KindleDictEntry, kindleEntriesToXHtml, yomichanEntryToKindle } from './utils/kindle-dict-entry';


async function main(args: Partial<{
  input: string;
  output: string;
  title: string;
  author: string;
}>) {
  if (!args.input || !args.output || !args.title) {
    parser.print_help();
    return;
  }
  const yomiEntries = await loadDict(args.input);

  const contents: {
    id: string;
    filename: string;
    content: string;
  }[] = [];

  const chunkedYomiEntries = _.chunk(yomiEntries, 100);
  for (let i = 0; i < chunkedYomiEntries.length; i += 1) {
    const kindleEntries: KindleDictEntry[] = [];

    for (const yomiEntry of chunkedYomiEntries[i]) {
      kindleEntries.push(yomichanEntryToKindle(yomiEntry));
    }

    const doc = kindleEntriesToXHtml(kindleEntries);
    contents.push({
      id: `entries-${i}`,
      filename: `entries-${i}.html`,
      content: doc.end(),
    });
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

  const outputDir = args.output;
  fsExtra.mkdirpSync(outputDir);
  fsExtra.writeFileSync(path.join(outputDir, `${args.title}.opf`), opfXml.end());

  for (const content of contents) {
    fsExtra.writeFileSync(path.join(outputDir, content.filename), content.content);
  }

}


const parser = new ArgumentParser({
  description: 'Argparse example'
});
 
parser.add_argument('-i', '--input', { help: 'Input directory' });
parser.add_argument('-o', '--output', { help: 'Output directory' });
parser.add_argument('-t', '--title', { help: 'Title of the dictionary' });
parser.add_argument('-a', '--author', { help: 'Author' });

main(parser.parse_args());
