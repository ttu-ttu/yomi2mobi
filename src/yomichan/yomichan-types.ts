import _ from "lodash";
import { hasOwnProperty } from "../utils/hasOwnProperty";

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

export interface ImageOptions {
  path: string;
  width?: number;
  height?: number;
  title?: string;
  sizeUnits?: "px"| "em";
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
  content: HTMLContent;
}
interface BaseHTMLTag {
  tag: string;
  style?: Record<string, any>;
  content?: HTMLContent;
  [x: string]: any
}



export interface ImageOptions extends BaseHTMLTag{
  tag: 'img';
  path: string;
  width?: number;
  height?: number;
  title?: string;
  sizeUnits?: "px"| "em";
  description?: string;
  pixelated?: boolean; // Whether the image should scale to parent container
  imageRendering?: 'auto' | 'pixelated' | 'crisp-edges';
  appearance?: 'auto' | 'monochrome';
  background?: boolean;
  collapsed?: boolean;
  collapsible?: boolean;
}
export type HTMLTag = ImageOptions | BaseHTMLTag
export type HTMLContent = string | HTMLTag | HTMLContent[];
export type Definition = HTMLContent | StructuredDefinition;
