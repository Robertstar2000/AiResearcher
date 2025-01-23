import { researchApi } from './api';
import { ResearchSection, ResearchMode, ResearchType } from '../types/research';

class ResearchErrorType {
  static VALIDATION_ERROR = 'VALIDATION_ERROR';
  static GENERATION_ERROR = 'GENERATION_ERROR';
}

// Function to create research outline
async function createResearchOutline(
  topic: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<ResearchSection[]> {
  try {
    const outline = await generateOutline(topic, mode, type);
    return parseOutline(outline);
  } catch (error) {
    console.error('Error creating research outline:', error);
    throw error;
  }
}

// Utility function to parse outline
function parseOutline(outline: string): ResearchSection[] {
  const lines = outline.split('\n').filter(line => line.trim());
  const sections: ResearchSection[] = [];
  let currentSection: ResearchSection | null = null;
  let currentSubsection: ResearchSection | null = null;

  for (const line of lines) {
    const mainSectionMatch = line.match(/^(\d+\.)\s+(.+)/);
    const subSectionMatch = line.match(/^(\d+\.\d+)\s+(.+)/);

    if (mainSectionMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        number: mainSectionMatch[1].slice(0, -1),
        title: mainSectionMatch[2].trim(),
        content: '',
        subsections: []
      };
      currentSubsection = null;
    } else if (subSectionMatch && currentSection) {
      currentSubsection = {
        number: subSectionMatch[1].slice(0, -1),
        title: subSectionMatch[2].trim(),
        content: ''
      };
      if (!currentSection.subsections) {
        currentSection.subsections = [];
      }
      currentSection.subsections.push(currentSubsection);
    } else if (line.trim()) {
      // Add content to either the current subsection or main section
      if (currentSubsection) {
        currentSubsection.content = (currentSubsection.content || '') + (currentSubsection.content ? '\n' : '') + line.trim();
      } else if (currentSection) {
        currentSection.content = (currentSection.content || '') + (currentSection.content ? '\n' : '') + line.trim();
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

// Function to generate sections with numbers
async function generateSectionsWithNumbers(
  sections: ResearchSection[]
): Promise<ResearchSection[]> {
  const numberedSections: ResearchSection[] = sections.map((section, index) => ({
    ...section,
    number: (index + 1).toString(),
    content: section.content || ''
  }));

  return numberedSections;
}

// Generate content for a single research section
async function generateResearchSection(
  sectionTitle: string,
  sectionDescription: string,
  topic: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<string> {
  try {
    const apiSection = {
      title: sectionTitle,
      content: sectionDescription || '',
    };

    const content = await researchApi.generateSectionBatch(
      [apiSection],
      topic,
      mode,
      type
    );

    return content[0]?.content || '';
  } catch (error) {
    console.error('Error generating section:', error);
    throw error;
  }
}

async function generateResearchContent(
  sections: ResearchSection[],
  researchTarget: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<ResearchSection[]> {
  try {
    const apiSections = sections.map(section => ({
      title: section.title,
      content: section.content
    }));

    const content = await researchApi.generateSectionBatch(
      apiSections,
      researchTarget,
      mode,
      type
    );

    return content.map((apiSection, index) => ({
      ...sections[index],
      content: apiSection.content || sections[index].content
    }));
  } catch (error) {
    console.error('Error generating research content:', error);
    throw error;
  }
}

async function generateOutline(
  researchTarget: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<string> {
  try {
    return await researchApi.generateOutline(researchTarget, researchTarget, mode, type);
  } catch (error) {
    console.error('Error generating outline:', error);
    throw error;
  }
}

function transformApiResponse(sections: ResearchSection[]): ResearchSection[] {
  return sections.map(section => ({
    ...section,
    content: section.content || '',
    number: section.number
  }));
}

export {
  generateResearchContent,
  generateOutline,
  transformApiResponse,
  createResearchOutline,
  generateSectionsWithNumbers,
  generateResearchSection,
  ResearchErrorType
};
