import { ArgumentParser } from 'argparse';
import * as easyImage from 'easyimage';
import fsExtra from 'fs-extra';
import htmlMinifier from 'html-minifier';
import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import * as _ from 'lodash';
import mime from 'mime-types';
import path from 'path';
import { fragment } from 'xmlbuilder2';
import { loadDict } from './utils/load-dict';
import { mergeDictData } from './utils/merge-dict-data';
import {
  combineDefinitions,
  KindleDictEntry,
  kindleEntriesToXHtml,
  yomichanEntryToKindle,
} from './utils/kindle-dict-entry';
import { YomichanEntry } from './yomichan/yomichan-formatter';
import { Definition, StructuredContentItem } from './yomichan/yomichan-types';
import { FilenameGenerator } from './utils/filename-generator';


function getFilePaths(definitions: Definition[]): string[] {
  const copySingleDef = (def: Definition | StructuredContentItem): string[] => {
    if (typeof def !== 'object') {
      return [];
    }
    if ('content' in def) {
      if (Array.isArray(def.content)) {
        return def.content.flatMap(copySingleDef);
      }
      return copySingleDef(def.content);
    }
    if ('path' in def) {
      return [def.path];
    }
    return [];
  }
  return definitions.flatMap(copySingleDef);
}

async function copyAndConvertFormats(input: string, output: string, yomiEntries: YomichanEntry[], imageQuality: number) {
  const filePathMap: Record<string, string> = {};
  let allFilePaths: string[] = [];
  for (const yomiEntry of yomiEntries) {
    allFilePaths.push(...getFilePaths(yomiEntry.definitions));
  }
  allFilePaths = _.uniq(allFilePaths);
  const chunkedFilePaths = _.chunk(allFilePaths, 30);
  const filenameGenerator = new FilenameGenerator();
  const outputRelativeDir = 'i';
  for (let i = 0; i < chunkedFilePaths.length; i += 1) {
    const sysPathToRelativePath: Record<string, string> = {};
    const inputFiles = await Promise.all(chunkedFilePaths[i]
      .map(async (filePath) => {
        const inputPath = path.join(input, filePath);
        let outputPath: string;
        const supportedTypeRegex = /\.((gif)|(jpe?g)|(png))$/i;
        if (!supportedTypeRegex.test(filePath)) {
          outputPath = path.join(
            output,
            outputRelativeDir,
            filenameGenerator.generate() + '.jpg',
          );
        } else {
          outputPath = path.join(
            output,
            outputRelativeDir,
            filePath.replace(/[^.]+/, filenameGenerator.generate()),
          );
        }

        fsExtra.mkdirpSync(path.dirname(outputPath));
        // moz has better (quality-based) compression, ignore for this step
        await easyImage.convert({
          src: inputPath,
          dst: outputPath,
          background: 'white',
        });

        const imageminInputPathFixed = outputPath.replace(/\\/g, '/');
        sysPathToRelativePath[imageminInputPathFixed] = filePath;
        return imageminInputPathFixed;
      })
    );

    const conversionResults = await imagemin(inputFiles, {
      destination: `${output}/.tmp`,
      plugins: [
        imageminMozjpeg({
          quality: imageQuality,
        }),
      ],
    });
    await Promise.all(conversionResults.map((conversionResult) => {
      const originalRelativePath = sysPathToRelativePath[conversionResult.sourcePath];
      const newFilename = path.basename(conversionResult.sourcePath);
      const newRelativePath = path.join(outputRelativeDir, newFilename);
      filePathMap[originalRelativePath] = newRelativePath.replace(/\\/g, '/');

      const copyToPath = path.join(output, newRelativePath);
      fsExtra.mkdirpSync(path.dirname(copyToPath));
      return fsExtra.rename(
        conversionResult.destinationPath,
        copyToPath,
      );
    }));
    console.log(`Progress (Image): ${i}/${chunkedFilePaths.length} (${(i / chunkedFilePaths.length * 100).toFixed(2)}%)`);
  }
  return filePathMap;
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
  cover_image: string;
  main_dict: string;
  debug: boolean;
}> & {
  image_quality: number;
}) {
  if (!args.input || !args.output || !args.title) {
    parser.print_help();
    return;
  }
  const input: string = args.input;
  const output: string = args.output;
  let yomiEntries = await loadDict(args.input);
  console.log('loaded dict')
  if (args.main_dict) {
    yomiEntries = await mergeDictData(yomiEntries, args.main_dict);
  }

  let coverImageName: string | undefined;
  if (args.cover_image) {
    console.log('Copying cover image');
    coverImageName = 'cover';
    if (args.cover_image.includes('.')) {
      coverImageName += '.' + args.cover_image.replace(/.+\./, '');
    }
    fsExtra.copyFileSync(args.cover_image, path.join(args.output, coverImageName));
  }


  console.log(`Copying/converting images (Quality: ${args.image_quality})`);
  const filePathMap = await copyAndConvertFormats(input, output, yomiEntries, args.image_quality);

  let kindleEntries: KindleDictEntry[] = [];

  for (const yomiEntry of yomiEntries) {
    kindleEntries.push(yomichanEntryToKindle(yomiEntry, true, filePathMap));
  }

  const groupedKindleEntries = _.groupBy(kindleEntries, (kindleEntry): string => combineDefinitions(kindleEntry.definitions).end());
  kindleEntries = Object.values(groupedKindleEntries).map((similarKindleEntries): KindleDictEntry => {
    const mergedSearchDataList = similarKindleEntries.flatMap((x) => x.searchDataList);

    return {
      headwords: _.uniq(similarKindleEntries.flatMap((x) => x.headwords)),
      boldHeadword: similarKindleEntries[0].boldHeadword,
      searchDataList: _.uniqBy(mergedSearchDataList, (x) => x.term),
      definitions: similarKindleEntries[0].definitions,
      frequency: similarKindleEntries.map((x) => x.frequency).reduce((a, b) => Math.max(a, b)),
    };
  });

  kindleEntries = kindleEntries.sort((a, b) => b.frequency - a.frequency);

  const contents: {
    id: string;
    filename: string;
  }[] = [];

  const outputDir = args.output;
  fsExtra.mkdirpSync(outputDir);
  const chunkedKindleEntries = _.chunk(kindleEntries, 10000);
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
    value = htmlMinifier.minify(value);
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
        .ele('DefaultLookupIndex').txt('j').up()
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

  if (coverImageName) {
    opfXml = opfXml.ele('item', {
      id: 'cover',
      href: coverImageName,
      'media-type': mime.lookup(coverImageName),
      properties: 'cover-image',
    }).up();
  }

  let resourceCount = 0;
  for (const resourceFile of Object.values(filePathMap)) {
    opfXml = opfXml.ele('item', {
      id: `r-${resourceCount.toString(36)}`,
      href: resourceFile,
      'media-type': mime.lookup(resourceFile),
    }).up();
    resourceCount += 1;
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
parser.add_argument('-c', '--cover_image', { help: 'Image for the cover' });
parser.add_argument('-m', '--main_dict', { help: 'Main dictionary to use as reference (for alt writing and frequency)' });
parser.add_argument('--debug', { const: true, action: 'store_const', help: 'Print in a readable format' });
parser.add_argument('--image_quality', { default: 75, help: 'Quality of image' })
main(parser.parse_args());


