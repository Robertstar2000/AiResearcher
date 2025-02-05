import { ResearchError, ResearchException } from './researchErrors';
import { sqliteService } from './sqliteService';

// Types for research data
export interface ResearchEntry {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  content: ResearchContent;
  references: string[];
}

interface Section {
  title: string;
  content: string;
  number: string;
  subsections?: Section[];
}

interface ResearchContent {
  sections: Section[];
}

export interface ResearchEntryData {
  userId: string;
  title: string;
  content: ResearchContent;
  references: string[];
  created_at?: string;
  updated_at?: string;
}

// Research operations
export const saveResearchEntry = async (data: ResearchEntryData): Promise<{ id: string }> => {
  try {
    return await sqliteService.saveResearchEntry({
      user_id: data.userId,
      title: data.title,
      content: data.content,
      references: data.references
    });
  } catch (error) {
    console.error('Error saving research entry:', error);
    throw new ResearchException(
      ResearchError.DATABASE_ERROR,
      'Failed to save research entry',
      { originalError: error }
    );
  }
};

export const getResearchEntries = async (userId: string): Promise<ResearchEntry[]> => {
  try {
    return await sqliteService.getResearchByUserId(userId);
  } catch (error) {
    console.error('Error getting research entries:', error);
    throw new ResearchException(
      ResearchError.DATABASE_ERROR,
      'Failed to get research entries',
      { originalError: error }
    );
  }
};

export const updateResearchEntry = async (
  id: string,
  updates: Partial<Omit<ResearchEntry, 'id' | 'created_at'>>
): Promise<void> => {
  try {
    await sqliteService.updateResearchEntry(id, updates);
  } catch (error) {
    console.error('Error updating research entry:', error);
    throw new ResearchException(
      ResearchError.DATABASE_ERROR,
      'Failed to update research entry',
      { originalError: error }
    );
  }
};

export const deleteResearchEntry = async (id: string): Promise<void> => {
  try {
    await sqliteService.deleteResearchEntry(id);
  } catch (error) {
    console.error('Error deleting research entry:', error);
    throw new ResearchException(
      ResearchError.DATABASE_ERROR,
      'Failed to delete research entry',
      { originalError: error }
    );
  }
};

export async function createUser(userData: any): Promise<void> {
  try {
    await sqliteService.createUser({
      email: userData.email,
      password: userData.password,
      name: userData.metadata.name,
      occupation: userData.metadata.occupation,
      location: userData.metadata.geolocation
    });
  } catch (error) {
    throw new ResearchException(
      ResearchError.DATABASE_ERROR,
      error instanceof Error ? error.message : 'Failed to create user',
      { error }
    );
  }
}

export async function authenticateUser(credentials: any): Promise<any> {
  try {
    const user = await sqliteService.authenticateUser(credentials.email, credentials.password);
    
    if (!user) {
      throw new ResearchException(
        ResearchError.DATABASE_ERROR,
        'Invalid email or password'
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      occupation: user.occupation,
      geolocation: user.location
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw new ResearchException(
      ResearchError.DATABASE_ERROR,
      error instanceof Error ? error.message : 'Authentication failed',
      { error }
    );
  }
}
