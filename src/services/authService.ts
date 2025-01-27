import { store } from '../store';
import { logout, setUser } from '../store/slices/authSlice';
import { ResearchError, ResearchException } from './researchErrors';
import { sqliteService } from './sqliteService';

interface UserMetadata {
  name?: string;
  occupation?: string;
  geolocation?: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  occupation?: string;
  geolocation?: string;
}

interface AuthCredentials {
  email: string;
  password: string;
  metadata?: UserMetadata;
}

export async function createUser(credentials: AuthCredentials): Promise<AuthUser> {
  try {
    // Normalize email and trim password
    const normalizedEmail = credentials.email.toLowerCase().trim();
    const trimmedPassword = credentials.password.trim();

    // Create user in SQLite database
    const user = await sqliteService.createUser({
      email: normalizedEmail,
      password: trimmedPassword,
      name: credentials.metadata?.name || '',
      occupation: credentials.metadata?.occupation,
      location: credentials.metadata?.geolocation,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      occupation: user.occupation,
      geolocation: user.location,
    };
  } catch (error) {
    console.error('User creation error:', error);
    throw new ResearchException(
      ResearchError.AUTH_ERROR,
      'Failed to create user',
      { error }
    );
  }
}

export async function authenticateUser(credentials: AuthCredentials): Promise<AuthUser> {
  try {
    // Normalize email and trim password
    const normalizedEmail = credentials.email.toLowerCase().trim();
    const trimmedPassword = credentials.password.trim();

    // Authenticate using SQLite database
    const user = await sqliteService.authenticateUser(normalizedEmail, trimmedPassword);

    if (!user) {
      throw new ResearchException(
        ResearchError.AUTH_ERROR,
        'Invalid email or password'
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      occupation: user.occupation,
      geolocation: user.location,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw new ResearchException(
      ResearchError.AUTH_ERROR,
      'Failed to authenticate user',
      { error }
    );
  }
}

// Just clear local state
export async function signOut(): Promise<void> {
  try {
    store.dispatch(logout());
  } catch (error) {
    console.error('Sign out error:', error);
    throw new ResearchException(
      ResearchError.AUTH_ERROR,
      'Failed to sign out',
      { error }
    );
  }
}

// Initialize stored auth state
export async function initializeStoredAuth(): Promise<void> {
  try {
    const storedAuth = localStorage.getItem('ai_researcher_auth');
    if (storedAuth) {
      const parsedAuth = JSON.parse(storedAuth);
      if (parsedAuth.user) {
        // Verify the stored user still exists in SQLite
        const user = await sqliteService.authenticateUserById(parsedAuth.user.id);
        if (user) {
          store.dispatch(setUser({
            id: user.id,
            email: user.email,
            name: user.name,
            occupation: user.occupation,
            geolocation: user.location,
          }));
        } else {
          // User no longer exists in DB, clear stored auth
          localStorage.removeItem('ai_researcher_auth');
        }
      }
    }
  } catch (error) {
    console.error('Error initializing stored auth:', error);
    localStorage.removeItem('ai_researcher_auth');
  }
}
