import { researchApi } from './api';
import { ResearchSection, ResearchMode, ResearchType } from '../types/research';

export class ResearchErrorType {
  static VALIDATION_ERROR = 'VALIDATION_ERROR';
  static GENERATION_ERROR = 'GENERATION_ERROR';
}

export async function generateOutline(
  researchTarget: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<string> {
  try {
    // Pass an empty string as title since we don't have one yet
    const outlineText = await researchApi.generateOutline('', researchTarget, mode, type);
    return outlineText;
  } catch (error) {
    console.error('Error generating outline:', error);
    throw error;
  }
}

export async function generateResearchSection(
  topic: string,
  sectionTitle: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<ResearchSection> {
  try {
    const content = await researchApi.generateOutline(
      sectionTitle,
      topic,
      mode,
      type
    );
    return {
      number: '',
      title: sectionTitle,
      content
    };
  } catch (error) {
    console.error('Error generating research section:', error);
    throw error;
  }
}

export function parseOutline(outline: string): ResearchSection[] {
  const sections: ResearchSection[] = [];
  let currentMainSection: ResearchSection | null = null;

  const lines = outline.split('\n').map(line => line.trim()).filter(line => line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const mainSectionMatch = line.match(/^(\d+)\.\s+(.+?)(?:\s*\[|$)/);
    if (mainSectionMatch) {
      if (currentMainSection) {
        sections.push(currentMainSection);
      }
      currentMainSection = {
        number: mainSectionMatch[1],
        title: mainSectionMatch[2].trim(),
        content: '',
        subsections: []
      };

      if (i + 1 < lines.length && lines[i + 1].startsWith('[')) {
        currentMainSection.content = lines[i + 1].slice(1, -1).trim();
        i++;
      }
      continue;
    }

    const subSectionMatch = line.match(/^(\d+\.\d+)\s+(.+?)(?:\s*\[|$)/);
    if (subSectionMatch && currentMainSection) {
      const subsection: ResearchSection = {
        number: subSectionMatch[1],
        title: subSectionMatch[2].trim(),
        content: ''
      };

      if (i + 1 < lines.length && lines[i + 1].startsWith('[')) {
        subsection.content = lines[i + 1].slice(1, -1).trim();
        i++;
      }

      currentMainSection.subsections?.push(subsection);
      continue;
    }
  }

  if (currentMainSection) {
    sections.push(currentMainSection);
  }

  return sections;
}

export async function generateResearchContent(
  sections: ResearchSection[],
  researchTarget: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<ResearchSection[]> {
  const updatedSections = [...sections];

  for (const section of updatedSections) {
    const sectionContent = await generateResearchSection(
      researchTarget,
      section.title,
      mode,
      type
    );
    section.content = sectionContent.content;

    if (section.subsections) {
      for (const subsection of section.subsections) {
        const subsectionContent = await generateResearchSection(
          researchTarget,
          subsection.title,
          mode,
          type
        );
        subsection.content = subsectionContent.content;
      }
    }
  }

  return updatedSections;
}
