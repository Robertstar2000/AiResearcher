// @ts-ignore
import { z } from 'zod';
import { sqliteService } from './sqliteService';
import type { Request, Response } from 'express';

// Use dynamic import for groq-sdk
let Groq: any;

async function loadGroq() {
  try {
    const module = await import('groq-sdk');
    Groq = module.default || module.Groq;
    if (!Groq) {
      throw new Error('Failed to load Groq SDK');
    }
    console.log('Groq SDK loaded successfully');
  } catch (error) {
    console.error('Error loading Groq SDK:', error);
    throw error;
  }
}

// Utility functions
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRateLimitError(error: any): number {
  try {
    if (error?.error?.message) {
      const match = error.error.message.match(/Please try again in (\d+\.?\d*)s/);
      if (match && match[1]) {
        return Math.ceil(parseFloat(match[1]) * 1000); // Convert to milliseconds and round up
      }
    }
  } catch (e) {
    console.error('Error parsing rate limit message:', e);
  }
  return 5000; // Default to 5 seconds if we can't parse the wait time
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Retry ${retryCount + 1}/${maxRetries}`);

    if (retryCount >= maxRetries) {
      throw error;
    }

    let waitTime: number;
    
    if (error?.error?.code === 'rate_limit_exceeded') {
      waitTime = parseRateLimitError(error);
      console.log(`Rate limit exceeded. Waiting ${waitTime}ms before retry...`);
    } else {
      waitTime = Math.min(initialDelay * Math.pow(2, retryCount), 30000);
    }

    await delay(waitTime);
    return withRetry(operation, retryCount + 1, maxRetries, initialDelay);
  }
}

// Error handling
export enum ResearchErrorType {
  GENERATION_ERROR = 'GENERATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
}

export class ResearchError extends Error {
  constructor(
    public readonly type: ResearchErrorType,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ResearchError';
  }

  static fromError(error: unknown, type: ResearchErrorType = ResearchErrorType.GENERATION_ERROR): ResearchError {
    if (error instanceof ResearchError) return error;
    return new ResearchError(
      type,
      error instanceof Error ? error.message : 'Unknown error occurred',
      error instanceof Error ? { stack: error.stack } : {}
    );
  }
}

// Types
export enum ResearchMode {
  Basic = 'basic',
  Advanced = 'advanced',
  Expert = 'expert'
}

export enum ResearchType {
  General = 'general',
  Literature = 'literature',
  Experiment = 'experiment'
}

export interface ResearchSection {
  title: string;
  content: string;
  subsections?: ResearchSection[];
}

interface ValidatedConfig {
  mode: ResearchMode;
  type: ResearchType;
  topic: string;
  researchTarget: string;
}

// Configuration schema for validation
const ValidationSchema = z.object({
  mode: z.nativeEnum(ResearchMode),
  type: z.nativeEnum(ResearchType),
  topic: z.string().min(3),
  researchTarget: z.string().min(3)
});

// Full configuration schema including API keys
const ResearchConfigSchema = z.object({
  groqApiKey: z.string(),
  groqApiUrl: z.string(),
  mode: z.nativeEnum(ResearchMode),
  type: z.nativeEnum(ResearchType),
  topic: z.string().min(3).optional()
});

type ResearchConfig = z.infer<typeof ResearchConfigSchema>;

// Safe API call wrapper
async function safeApiCall<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn);
}

class ResearchAPI {
  private static instance: ResearchAPI;
  private config: ResearchConfig;
  private groq: any;

  private constructor(config: ResearchConfig) {
    this.config = config;
    if (!Groq) {
      throw new ResearchError(
        ResearchErrorType.AUTH_ERROR,
        'Groq SDK not initialized. Please ensure loadGroq() is called before creating a ResearchAPI instance.'
      );
    }
    try {
      this.groq = new Groq({ 
        apiKey: config.groqApiKey,
        dangerouslyAllowBrowser: true
      });
      console.log('Groq client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Groq client:', error);
      throw new ResearchError(
        ResearchErrorType.AUTH_ERROR,
        'Failed to initialize Groq client. Please check your API key and try again.'
      );
    }
  }

  public static async initialize(): Promise<ResearchAPI> {
    if (!ResearchAPI.instance) {
      await loadGroq();
      await loadDatabaseFromBlob();

      const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
      const groqApiUrl = import.meta.env.VITE_GROQ_API_URL;

      if (!groqApiKey) {
        throw new ResearchError(
          ResearchErrorType.AUTH_ERROR,
          'GROQ API key is required. Please set VITE_GROQ_API_KEY in your environment.'
        );
      }

      await sqliteService.initialize();

      const validatedData = ResearchConfigSchema.parse({
        groqApiKey,
        groqApiUrl: groqApiUrl || 'https://api.groq.com/openai/v1/chat/completions',
        mode: ResearchMode.Basic,
        type: ResearchType.General
      });

      ResearchAPI.instance = new ResearchAPI(validatedData);
    }

    return ResearchAPI.instance;
  }

  public getConfig(): ResearchConfig {
    return this.config;
  }

  async generateTitle(
    researchTarget: string,
    _userId?: string
  ): Promise<string> {
    return await safeApiCall(async () => {
      const prompt = `Generate a single-sentence academic title for a research paper about: ${researchTarget}. The title should be concise, clear, and not end with a period.`;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.5,
        max_tokens: 50,
        top_p: 1,
        stop: ['.', '\n'],
        stream: false
      });

      const title = completion.choices[0]?.message?.content?.trim() || '';
      return title.replace(/[.:]$/, ''); // Remove any trailing period or colon
    });
  }

  async generateOutline(
    title: string,
    researchTarget: string,
    mode: ResearchMode = ResearchMode.Basic,
    type: ResearchType = ResearchType.General
  ): Promise<string> {
    return await safeApiCall(async () => {
      const sectionCount = mode === ResearchMode.Basic ? 4 : mode === ResearchMode.Advanced ? 6 : 8;
      let typeSpecificInstructions = '';
      
      switch(type) {
        case ResearchType.General:
          typeSpecificInstructions = `
Structure Guidelines:
- Focus on comprehensive analysis and evaluation
- Include methodology and theoretical framework
- Emphasize research implications and future directions
- Balance between theoretical and practical aspects`;
          break;
        case ResearchType.Literature:
          typeSpecificInstructions = `
Structure Guidelines:
- Emphasize systematic review methodology
- Focus on critical analysis of existing literature
- Include gaps identification and research opportunities
- Address theoretical frameworks and their evolution`;
          break;
        case ResearchType.Experiment:
          typeSpecificInstructions = `
Structure Guidelines:
- Detail experimental design and methodology
- Include hypothesis development and testing
- Focus on data collection and analysis methods
- Address validity and reliability concerns`;
          break;
      }
      
      const prompt = `Generate a detailed academic outline for a research paper titled "${title}" about: ${researchTarget}

Key Requirements:
1. Create exactly ${sectionCount} main sections
2. Each main section MUST have 3-4 subsections
3. Use proper academic language and be specific to the research topic
4. Main sections should be comprehensive (4-8 words)
5. Subsections should be detailed (5-10 words)
6. Include brief descriptions [in brackets] for each section/subsection

${typeSpecificInstructions}

Mode-Specific Requirements:
${mode === ResearchMode.Basic ? `
- Focus on fundamental aspects
- Keep structure straightforward
- Emphasize core concepts` :
mode === ResearchMode.Advanced ? `
- Include advanced theoretical concepts
- Add detailed methodology sections
- Incorporate critical analysis components` : `
- Include expert-level analysis
- Add comprehensive theoretical frameworks
- Incorporate advanced research methodologies
- Include detailed future research directions`}

Format each section exactly like this:
1. Main Section Title
[Main section description in 2-3 lines]
1.1 Subsection Title
[Subsection description in 2-3 lines]
1.2 Subsection Title
[Subsection description in 2-3 lines]`;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1,
        stop: null,
        stream: false
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Failed to generate outline');

      return content;
    });
  }

  async generateDetailedOutline(
    topic: string, 
    mode: string, 
    type: string,
    _userId?: string
  ): Promise<string> {
    const validatedConfig = await this.validateConfig({ 
      topic, 
      mode, 
      type,
      researchTarget: topic
    });
    
    return await safeApiCall(async () => {
      const sectionCount = mode === 'basic' ? 4 : mode === 'advanced' ? 16 : 30;
      let typeSpecificInstructions = '';
      
      switch(type) {
        case 'general':
          typeSpecificInstructions = `
Example Sections Structure (each main section must have 3-4 detailed subsections):

1. Comprehensive Introduction and Research Context
[Detailed overview of the research landscape and significance]
1.1 Historical Evolution and Development of the Research Field
[Trace the progression and key developments]
1.2 Contemporary Challenges and Knowledge Gaps in Current Understanding
[Identify specific problems and missing knowledge]
1.3 Research Significance and Potential Impact on the Field
[Explain broader implications and contributions]
1.4 Theoretical Framework and Conceptual Foundations
[Establish the theoretical basis]

2. In-depth Analysis of Existing Literature and Current State of Knowledge
[Comprehensive review of current research landscape]
2.1 Critical Evaluation of Foundational Research Studies
[Analyze seminal works and their impact]
2.2 Emerging Trends and Recent Developments in the Field
[Examine latest research directions]
2.3 Contradictions and Debates in Current Literature
[Explore conflicting viewpoints]
2.4 Synthesis of Key Theoretical Frameworks
[Connect different theoretical approaches]

[Continue this pattern for remaining sections...]`;
          break;
        case 'literature':
          typeSpecificInstructions = `
Example Sections Structure (each main section must have 3-4 detailed subsections):

1. Comprehensive Overview of Literature Review Scope and Objectives
[Detailed framework of the review's purpose and methodology]
1.1 Historical Context and Evolution of Research Questions
[Trace development of key questions]
1.2 Current Debates and Theoretical Controversies
[Examine ongoing scholarly discussions]
1.3 Methodological Approaches in Existing Literature
[Analyze research methods used]
1.4 Gaps and Limitations in Current Understanding
[Identify knowledge gaps]

2. Critical Analysis of Theoretical Frameworks and Models
[In-depth examination of theoretical foundations]
2.1 Evolution of Theoretical Perspectives Over Time
[Track changes in theoretical understanding]
2.2 Competing Theoretical Models and Their Applications
[Compare different theoretical approaches]
2.3 Integration of Cross-disciplinary Theoretical Insights
[Explore interdisciplinary connections]
2.4 Emerging Theoretical Developments and Innovations
[Examine new theoretical directions]

[Continue this pattern for remaining sections...]`;
          break;
        case 'experiment':
          typeSpecificInstructions = `
Example Sections Structure (each main section must have 3-4 detailed subsections):

1. Comprehensive Experimental Framework and Research Context
[Detailed overview of experimental design and rationale]
1.1 Theoretical Foundations and Research Hypotheses Development
[Establish theoretical basis for experiments]
1.2 Innovation and Significance in Experimental Approach
[Explain unique aspects of methodology]
1.3 Integration with Existing Experimental Literature
[Connect to previous research]
1.4 Potential Impact and Applications of Experimental Findings
[Project broader implications]

2. Detailed Experimental Design and Methodological Framework
[Comprehensive explanation of experimental setup]
2.1 Advanced Variable Control and Measurement Techniques
[Detail precise control methods]
2.2 Novel Instrumentation and Technical Specifications
[Describe specialized equipment]
2.3 Innovative Data Collection Protocols and Procedures
[Explain unique data gathering]
2.4 Quality Assurance and Validation Mechanisms
[Detail accuracy measures]

[Continue this pattern for remaining sections...]`;
          break;
      }

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an expert academic research assistant creating a detailed, hierarchical outline. Your task is to create a comprehensive outline for a ${validatedConfig.mode} ${validatedConfig.type} research paper focused on the research target: "${validatedConfig.researchTarget}" with exactly ${sectionCount} total sections (including ALL subsections).

CRITICAL FORMATTING REQUIREMENTS:
1. EVERY main section MUST have 3-4 detailed subsections that explore different aspects
2. Main section titles must be unique, written in academic language, be long and descriptive (4-8 words), and incorporate aspects of the research target
3. Subsection titles must be detailed (5-10 words) and explore unique aspects
4. Each title must clearly indicate its specific content focus and not duplicate concepts from other sections
5. Use proper outline format: 1., 1.1, 1.2, 1.3, etc.
6. Each section AND subsection needs a detailed description (2-3 lines)
7. All descriptions must be unique and delve deep into the topic
8. Main sections should follow the structure below exactly
9. Never use generic words like "Section" or "Analysis" alone

TITLE FORMAT EXAMPLE:
1. Comprehensive Analysis of Neural Network Architecture Evolution
[Detailed examination of how neural network designs have progressed...]
1.1 Historical Development of Foundational Neural Network Models
[Traces the progression from early perceptrons through modern architectures...]
1.2 Critical Comparison of Contemporary Architecture Paradigms
[Analyzes differences between CNN, RNN, and transformer approaches...]
1.3 Impact of Hardware Advances on Architecture Innovation
[Examines how GPU/TPU developments influenced network design...]
1.4 Future Directions in Neural Architecture Development
[Projects emerging trends in architecture research...]

${typeSpecificInstructions}`
          }
        ],
        model: "llama-3.1-70b-versatile",
        temperature: 0.7,
        max_tokens: 8000,
        top_p: 1,
        stop: null
      });

      const outline = completion.choices[0]?.message?.content;
      if (!outline) {
        throw new ResearchError(
          ResearchErrorType.GENERATION_ERROR,
          'Failed to generate outline'
        );
      }

      return outline;
    });
  }

  async generateSectionBatch(
    sections: ResearchSection[],
    researchTarget: string,
    mode: ResearchMode,
    type: ResearchType
  ): Promise<ResearchSection[]> {
    // Use withRetry with 15 second delays
    return await withRetry(async () => {
      const batchSize = 1;
      const batches = [];
      let lastRequestTime = 0;
      
      for (let i = 0; i < sections.length; i += batchSize) {
        // Ensure minimum 15 second gap between requests
        const timeSinceLastRequest = Date.now() - lastRequestTime;
        if (timeSinceLastRequest < 15000) {
          await delay(15000 - timeSinceLastRequest);
        }

        const batch = sections.slice(i, i + batchSize);
        console.log(`Processing section ${i + 1} of ${sections.length}`);
        
        try {
          console.log(`Requesting content for section: ${batch[0].title}`);
          lastRequestTime = Date.now();
          
          const prompt = `Generate detailed academic content for each research section. The research topic is: ${researchTarget}

Research Parameters:
- Mode: ${mode}
- Type: ${type}

Sections to expand:
${batch.map((section, index) => {
  return `${index + 1}. ${section.title}
[Generate detailed academic content focused specifically on: ${section.title}]`;
}).join('\n\n')}

IMPORTANT FORMATTING REQUIREMENTS:
1. DO NOT add any section numbers for example 1.2 or 2. or 3.3 to the content
2. DO NOT create new section headings or titles
3. Write the content as continuous paragraphs without numbering or section markers
4. Focus purely on the content itself without any structural formatting
5. After each section's main content, add TWO blank lines followed by "References:" on its own line
6. List each reference on a new line in APA 7th edition format
7. After references, add TWO blank lines followed by "Citations:" on its own line
8. List each in-text citation on a new line in APA format (Author, Year)

Content Requirements:
1. Generate comprehensive, academically-styled content at post-graduate level
2. Maintain academic tone with proper citations throughout the text
3. Include relevant examples, data, and explanations
4. Ensure logical flow between ideas and concepts
5. Keep content focused on each section's specific topic
6. Include at least 3-5 relevant academic references per section
7. Use in-text citations when introducing key concepts, statistics, or quotes
8. Prefer recent academic sources (last 5-10 years) when available
9. Include a mix of reference types (journals, books, conference papers)
10. Ensure citations in the text match the references list

Reference and Citation Requirements:
1. Format all references in APA 7th edition style
2. Include DOI numbers when available
3. For journal articles include: authors, year, title, journal name, volume, issue, pages
4. For books include: authors/editors, year, title, publisher, location if applicable
5. For web resources include: author/organization, year, title, URL, access date
6. Sort references alphabetically by author's last name
7. Use proper capitalization in titles
8. Include all authors (don't use et al. in references)
9. Use proper italicization for journal names and book titles`;

          const completion = await this.groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'mixtral-8x7b-32768',
            temperature: 0.7,
            max_tokens: 1800,
            top_p: 1,
            stream: false
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            throw new Error('No content generated');
          }

          // Clean and parse the content
          const cleanContent = content
            .replace(/\[cite{.*?}\]/g, '')
            .replace(/\\\[/g, '[')
            .replace(/\\\]/g, ']')
            .replace(/\\"/g, '"')
            .trim();

          const processedContent = {
            ...batch[0],
            content: cleanContent
              .replace(/\\n/g, '\n')
              .trim()
          };

          batches.push(processedContent);

          // Add fixed 15 second delay between sections
          if (i + batchSize < sections.length) {
            console.log('Waiting 15 seconds before next section...');
            await delay(15000);
          }
        } catch (error) {
          console.error(`Error processing section ${i + 1}:`, error);
          throw error;
        }
      }

      return batches;
    }, 0, 12, 15000); // 15 second initial delay, 12 retries
  }

  public async validateConfig(config: {
    topic: string;
    mode: string;
    type: string;
    researchTarget: string;
    sections?: ResearchSection[];
  }): Promise<ValidatedConfig> {
    const { mode, type, topic, researchTarget } = config;
    
    try {
      const validatedData = ValidationSchema.parse({
        mode: mode.toLowerCase() as ResearchMode,
        type: type.toLowerCase() as ResearchType,
        topic,
        researchTarget
      });
      
      return validatedData;
    } catch (error) {
      throw new ResearchError(
        ResearchErrorType.VALIDATION_ERROR,
        'Invalid configuration',
        { error }
      );
    }
  }
}

async function loadDatabaseFromBlob(): Promise<void> {
  if (typeof window !== 'undefined') {
    console.log('Skipping loadDatabaseFromBlob in browser environment.');
    return;
  }
  const fs = require('fs');
  const { getBlob } = require('@netlify/blobs');
  try {
    const blob = await getBlob('sqlite.db');
    if (blob) {
      fs.writeFileSync('./sqlite.db', blob);
      console.log('Database loaded from Netlify Blob.');
    } else {
      console.log('No blob found for sqlite.db.');
    }
  } catch (error) {
    console.error('Error loading DB from blob:', error);
  }
}

async function saveDatabaseToBlob(): Promise<void> {
  if (typeof window !== 'undefined') {
    console.log('Skipping saveDatabaseToBlob in browser environment.');
    return;
  }
  const fs = require('fs');
  const { putBlob } = require('@netlify/blobs');
  try {
    const dbBuffer = fs.readFileSync('./sqlite.db');
    await putBlob('sqlite.db', dbBuffer);
    console.log('Database saved to Netlify Blob.');
  } catch (error) {
    console.error('Error saving DB to blob:', error);
  }
}

// Register server-only endpoints
if (typeof window === 'undefined') {
  const express = require('express');
  const app = express();
  app.use(express.json());

  // Signup endpoint
  app.post('/signup', async (req: Request, res: Response) => {
    try {
      console.log('Starting signup process...');
      console.log('Account data received:', req.body);

      console.log('Loading latest database...');
      await loadDatabaseFromBlob();
      console.log('Database loaded successfully');

      const accountData = req.body;
      
      // Validate required fields
      if (!accountData.email || !accountData.password) {
        console.error('Missing required fields:', { email: !!accountData.email, password: !!accountData.password });
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Check if email exists in the latest database
      console.log('Checking if email exists...');
      const existingUser = await sqliteService.getUserByEmail(accountData.email);
      
      if (existingUser) {
        console.log('Email already exists:', accountData.email);
        return res.status(409).json({ 
          success: false, 
          error: 'User account exists',
          details: {
            email: accountData.email,
            suggestion: 'Please try logging in instead'
          }
        });
      }

      console.log('Creating new user...');
      const user = await sqliteService.createUser(accountData);
      console.log('User created successfully:', user);

      console.log('Saving updated database to blob...');
      await saveDatabaseToBlob();
      console.log('Database saved successfully');

      res.status(200).json({ success: true, user });
    } catch (error: any) {
      console.error('Detailed signup error:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        errno: error.errno
      });
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: {
          code: error.code,
          errno: error.errno
        }
      });
    }
  });

  // Add a login endpoint that loads the latest database before authentication
  app.post('/login', async (req: Request, res: Response) => {
    try {
      console.log('Starting login process...');
      console.log('Login data received:', req.body);

      console.log('Loading latest database...');
      await loadDatabaseFromBlob();
      console.log('Database loaded successfully');

      const { email, password } = req.body;
      
      if (!email || !password) {
        console.error('Missing login credentials');
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      console.log('Attempting to authenticate user...');
      const user = await sqliteService.authenticateUser(email, password);
      
      if (user) {
        console.log('Authentication successful');
        res.status(200).json({ success: true, user });
      } else {
        console.log('Authentication failed');
        res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: {
          code: error.code,
          errno: error.errno
        }
      });
    }
  });

  // Start the Express server on a specified port
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

// Export functions for external use
export { saveDatabaseToBlob };

// Export a singleton instance that will be initialized when needed
let researchApiInstance: ResearchAPI | null = null;

export const getResearchApi = async () => {
  if (!researchApiInstance) {
    researchApiInstance = await ResearchAPI.initialize();
  }
  return researchApiInstance;
};

export const researchApi = {
  async generateTitle(...args: Parameters<ResearchAPI['generateTitle']>) {
    const api = await getResearchApi();
    return api.generateTitle(...args);
  },
  async generateOutline(...args: Parameters<ResearchAPI['generateOutline']>) {
    const api = await getResearchApi();
    return api.generateOutline(...args);
  },
  async generateDetailedOutline(...args: Parameters<ResearchAPI['generateDetailedOutline']>) {
    const api = await getResearchApi();
    return api.generateDetailedOutline(...args);
  },
  async generateSectionBatch(...args: Parameters<ResearchAPI['generateSectionBatch']>) {
    const api = await getResearchApi();
    return api.generateSectionBatch(...args);
  },
  async validateConfig(...args: Parameters<ResearchAPI['validateConfig']>) {
    const api = await getResearchApi();
    return api.validateConfig(...args);
  }
};