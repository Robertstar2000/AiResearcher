import React, { useState, KeyboardEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../store/slices/authSlice';
import { authenticateUser } from '../services/authService';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Alert,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SignInDialog({ open, onClose }: SignInDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isLoading) return;

    try {
      if (!email || !password) {
        throw new Error('Please fill in all required fields');
      }

      setIsLoading(true);
      const user = await authenticateUser({
        email,
        password
      });

      dispatch(setUser(user));
      onClose();
      navigate('/research');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && password && email) {
      handleLogin(event);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { position: 'relative' }
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500],
        }}
      >
        <CloseIcon />
      </IconButton>
      <DialogTitle sx={{ textAlign: 'center', pt: 2, pb: 1, typography: 'h6' }}>
        Welcome Back
      </DialogTitle>
      <DialogContent sx={{ pb: 2, px: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1, width: '100%', py: 0 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }}>
          <TextField
            margin="dense"
            required
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            required
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            size="small"
            sx={{ mb: 1 }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            sx={{
              mt: 1,
              mb: 1,
              py: 1,
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
