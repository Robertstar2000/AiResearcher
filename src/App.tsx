import { useEffect } from 'react';
import AppRoutes from './routes';
import { initializeStoredAuth } from './services/authService';

function App() {
  useEffect(() => {
    // Initialize stored authentication state when app starts
    initializeStoredAuth().catch(console.error);
  }, []);

  return <AppRoutes />;
}

export default App;
