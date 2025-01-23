import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../store/slices/authSlice';
import { createUser } from '../services/authService';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Alert,
} from '@mui/material';

interface SignUpDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SignUpDialog({ open, onClose }: SignUpDialogProps) {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [occupation, setOccupation] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isLoading) return;

    try {
      if (!email || !password || !userName) {
        throw new Error('Please fill in all required fields');
      }

      setIsLoading(true);
      const user = await createUser({
        email,
        password,
        metadata: {
          name: userName,
          occupation,
          geolocation: location
        }
      });

      dispatch(setUser(user));
      onClose();
      navigate('/research');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
        Sign Up for Free
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSignup} sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Occupation"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            sx={{
              mt: 3,
              mb: 2,
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1976D2 30%, #00BCD4 90%)',
              }
            }}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
