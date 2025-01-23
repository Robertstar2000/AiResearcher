import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
} from '@mui/material';
import SignUpDialog from '../components/SignUpDialog';
import SignInDialog from '../components/SignInDialog';

export default function AuthPage() {
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <Container component="main" maxWidth="sm">
      <Paper 
        elevation={3} 
        sx={{ 
          mt: 8,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)'
        }}
      >
        <Typography component="h1" variant="h4" sx={{ mb: 4 }}>
          AI Researcher Assistant
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center' }}>
          Your personal AI-powered research assistant. Sign up to get started or sign in to continue your research.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setSignUpOpen(true)}
            sx={{
              py: 1.5,
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1976D2 30%, #00BCD4 90%)',
              }
            }}
          >
            Sign Up
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setSignInOpen(true)}
            sx={{ py: 1.5 }}
          >
            Sign In
          </Button>
        </Box>

        <SignUpDialog 
          open={signUpOpen}
          onClose={() => setSignUpOpen(false)}
        />
        
        <SignInDialog
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
        />
      </Paper>
    </Container>
  );
}
