import { Definition, InflectionRuleEnum, YomichanSchemaV3 } from "./yomichan-types";

interface IYomichanDictionaryEntry {
  term: string;
  reading: string;
  definitionTag: string | null;
  inflectionRule: string;
  frequency: number;
  definitions: Definition[];
  sequence: number;
  tag: string;
}

const allowedInflectionValues = Object.values(InflectionRuleEnum) as string[];

export class YomichanEntry implements IYomichanDictionaryEntry {
  term: string;
  reading: string;
  definitionTag: string | null;
  inflectionRule: string;
  frequency: number;
  definitions: Definition[];
  sequence: number;
  tag: string;

  constructor(data: IYomichanDictionaryEntry) {
    this.term = data.term;
    this.reading = data.reading;
    this.definitionTag = data.definitionTag;
    this.inflectionRule = data.inflectionRule;
    this.frequency = data.frequency;
    this.definitions = data.definitions;
    this.sequence = data.sequence;
    this.tag = data.tag;
  }

  toJSON(): YomichanSchemaV3 {
    if (this.inflectionRule && !this.inflectionRule.split(' ').every((rule) => allowedInflectionValues.includes(rule))) {
      throw new Error(`"${this.inflectionRule}" invalid rule`);
    }

    return [
      this.term,
      this.reading,
      this.definitionTag,
      this.inflectionRule,
      this.frequency,
      this.definitions,
      this.sequence,
      this.tag,
    ];
  }
}