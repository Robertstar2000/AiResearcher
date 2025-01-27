import { useState } from 'react';
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
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

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

  const handleSignup = async () => {
    setError(null);

    if (isLoading) return;

    try {
      // Validate all required fields are properly filled
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      const trimmedName = userName.trim();
      const trimmedOccupation = occupation.trim();
      const trimmedLocation = location.trim();

      if (!trimmedEmail || !trimmedPassword || !trimmedName || !trimmedOccupation || !trimmedLocation) {
        throw new Error('Please fill in all required fields');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password length
      if (trimmedPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      setIsLoading(true);
      const user = await createUser({
        email: trimmedEmail,
        password: trimmedPassword,
        metadata: {
          name: trimmedName,
          occupation: trimmedOccupation,
          geolocation: trimmedLocation
        }
      });

      dispatch(setUser(user));
      onClose();
      navigate('/research');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setIsLoading(false);
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
        Sign Up for Free
      </DialogTitle>
      <DialogContent sx={{ pb: 2, px: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1, width: '100%', py: 0 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ width: '100%' }}>
          <TextField
            margin="dense"
            required
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            required
            fullWidth
            label="Username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
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
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            required
            fullWidth
            label="Occupation"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            required
            fullWidth
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            size="small"
            sx={{ mb: 1 }}
          />
          <Button
            onClick={handleSignup}
            fullWidth
            variant="contained"
            disabled={isLoading || !email.trim() || !password.trim() || !userName.trim() || !occupation.trim() || !location.trim()}
            sx={{
              mt: 1,
              mb: 1,
              py: 1,
            }}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
