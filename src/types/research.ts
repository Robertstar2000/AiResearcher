import { ResearchMode as ApiMode, ResearchType as ApiType } from '../services/api';

export type ResearchMode = ApiMode;
export type ResearchType = ApiType;

export interface ResearchSection {
  number: string;
  title: string;
  content: string;
  subsections?: ResearchSection[];
  markupContent?: string;
  description?: string;
}
