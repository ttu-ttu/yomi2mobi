type Term = string;
type Reading = string;
type DefinitionTag = string | null;
type InflectionRule = string;
export enum InflectionRuleEnum {
  Ichidan = 'v1',
  Godan = 'v5',
  Suru = 'vs',
  Kuru = 'vk',
  Zuru = 'vz',
  IAdjective = 'adj-i',
}
export const specialInflectionRule = '情報なし';
type Frequency = number;
export type Definition = string | TextDefinition | ImageDefinition | StructuredDefinition;
type SequenceNumber = number;  // same number = same entry if option is merge
type Tag = string;

export type YomichanSchemaV3 = [
  Term,
  Reading,
  DefinitionTag,
  InflectionRule,
  Frequency,
  Definition[],
  SequenceNumber,
  Tag,
];

interface TextDefinition {
  type: 'text';
  text: string;
}

interface ImageOptions {
  path: string;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  pixelated?: boolean; // Whether the image should scale to parent container
  imageRendering?: 'auto' | 'pixelated' | 'crisp-edges';
  appearance?: 'auto' | 'monochrome';
  background?: boolean;
  collapsed?: boolean;
  collapsible?: boolean;
}

export interface ImageDefinition extends ImageOptions {
  type: 'image';
}

export interface StructuredDefinition {
  type: 'structured-content';
  content: StructuredContentItem;
}

export type StructuredContentItem = string | StructuredContentItem[] | StructuredContentItemObject;

export type StructuredContentItemObject = StructuredContentItemObjectBr |
  StructuredContentItemObjectGeneric |
  StructuredContentItemObjectTableItem |
  StructuredContentItemObjectStylableGeneric |
  StructuredContentItemObjectImage;

interface StructuredContentItemObjectBr {
  tag: 'br';
}

interface StructuredContentItemObjectGeneric {
  tag: 'ruby' | 'rt' | 'rp' | 'table' | 'thead' | 'tbody' | 'tfoot' | 'tr';
  content: StructuredContentItem;
}

interface StructuredContentItemObjectTableItem {
  tag: 'td' | 'th';
  content: StructuredContentItem;
  colSpan?: number;
  rowSpan?: number;
  style?: StructuredContentItemStyle;
}

interface StructuredContentItemObjectStylableGeneric {
  tag: 'span' | 'div';
  content: StructuredContentItem;
  style?: StructuredContentItemStyle;
}

export interface StructuredContentItemObjectImage extends ImageOptions {
  tag: 'img';
  verticalAlign?: 'baseline' | 'sub' | 'super' | 'text-top' | 'text-bottom' | 'middle' | 'top' | 'bottom';
  sizeUnits?: 'px' | 'em';
}

export interface StructuredContentItemStyle {
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
  fontSize?: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large' | 'x-large' | 'xx-large' | 'xxx-large';
  textDecorationLine?: StyleTextDecorationLine | StyleTextDecorationLine[];
  verticalAlign?: 'baseline' | 'sub' | 'super' | 'text-top' | 'text-bottom' | 'middle' | 'top' | 'bottom';
}

type StyleTextDecorationLine = 'none' | 'underline' | 'overline' | 'line-through';
