import { researchApi } from './api';
import { ResearchSection, ResearchMode, ResearchType } from '../types/research';

// Define ResearchSection interface
interface ResearchSection {
  number: string;
  title: string;
  content?: string;
  subsections?: ResearchSection[];
}

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
    // Set number of sections based on mode (basic/advanced only, article is handled separately)
    let sectionCount = 10;  // default for basic
    if (mode.toLowerCase() === 'advanced') {
      sectionCount = 30;
    }
    
    // Then generate the outline
    const outline = await researchApi.generateDetailedOutline(topic, mode, type, sectionCount);
    
    // Parse the outline into ResearchSection array
    const parsedSections: ResearchSection[] = parseOutline(outline);
    
    // Ensure we don't exceed the section count based on mode
    return parsedSections.slice(0, sectionCount);
  } catch (error) {
    if (error instanceof Error) {
      // Handle unexpected errors
      throw new Error('An unexpected error occurred while creating the research outline.');
    }
    throw error;
  }
}

// Utility function to parse outline
function parseOutline(outline: string): ResearchSection[] {
  const lines = outline.split('\n').filter(line => line.trim());
  const sections: ResearchSection[] = [];
  let currentSection: ResearchSection | null = null;

  for (const line of lines) {
    // Check if line starts with a number (section header)
    const match = line.match(/^(\d+\.?(?:\d+)?)\s*(.*)/);
    if (match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        number: match[1],
        title: match[2].trim(),
        content: ''
      };
    } else if (currentSection) {
      // Add non-header lines as content
      currentSection.content += (currentSection.content ? '\n' : '') + line.trim();
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

// Example of another function utilizing researchApi
async function generateResearchSection(
  sectionTitle: string,
  sectionDescription: string,
  topic: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<string> {
  try {
    const content = await researchApi.generateSectionBatch(
      [{
        title: sectionTitle,
        description: sectionDescription,
        number: "1.0" // Default section number for single section generation
      }],
      topic,
      mode,
      type
    );
    return content[0]?.content || '';
  } catch (error) {
    if (error instanceof Error) {
      // Handle unexpected errors
      throw new Error(`Failed to generate section: ${error.message}`);
    }
    throw error;
  }
}

// Function to generate sections with numbers
async function generateSectionsWithNumbers(
  sections: ResearchSection[],
  topic: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<ResearchSection[]> {
  try {
    if (!sections || sections.length === 0) {
      throw new Error('No sections provided');
    }

    const sectionInputs = sections.map(section => ({
      title: section.title,
      description: '',
      number: section.number
    }));

    const sectionContents = await researchApi.generateSectionBatch(
      sectionInputs,
      topic,
      mode,
      type
    );

    return sectionContents.map(content => ({
      number: content.number,
      title: content.title,
      content: content.content
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate sections: ${error.message}`);
    }
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
    if (!sections || sections.length === 0) {
      throw new Error('No sections provided for generation');
    }

    const sectionContents = await researchApi.generateSectionBatch(
      sections,
      researchTarget,
      mode,
      type
    );

    return transformApiResponse(sectionContents);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate research content: ${error.message}`);
    }
    throw error;
  }
}

async function generateOutline(
  researchTarget: string,
  mode: ResearchMode,
  type: ResearchType
): Promise<string> {
  try {
    return await researchApi.generateOutline(
      researchTarget,
      mode,
      type
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate outline: ${error.message}`);
    }
    throw error;
  }
}

function transformApiResponse(sections: ResearchSection[]): ResearchSection[] {
  return sections.map(section => ({
    ...section,
    content: section.content || '',
    title: section.title,
    number: section.number,
    subsections: section.subsections?.map(sub => ({
      ...sub,
      content: sub.content || ''
    }))
  }));
}

export {
  generateResearchContent,
  generateOutline,
  transformApiResponse
};
