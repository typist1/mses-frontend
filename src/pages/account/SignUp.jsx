import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MuiCard from '@mui/material/Card';
import Modal from '@mui/material/Modal';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';
import { useUser } from '@/common/contexts/UserContext';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import WebIcon from '@mui/icons-material/Web';
import nuLogo from "../../assets/nuLogo.svg";

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  [theme.breakpoints.up('sm')]: {
    width: '450px',
  },
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

const ModalContainer = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  outline: 'none',
});

export default function SignUpModal({ open, onClose }) {
  const navigate = useNavigate();
  const { googleAuth } = useUser();
  
  const [emailError, setEmailError] = useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');
  const [firstnameError, setFirstnameError] = useState(false);
  const [firstnameErrorMessage, setFirstnameErrorMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [formState, setFormState] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    username: '',
    allowExtraEmails: false,
  });

  const validateInputs = () => {
    let isValid = true;

    if (!formState.email || !/\S+@\S+\.\S+/.test(formState.email)) {
      setEmailError(true);
      setEmailErrorMessage('Please enter a valid email address.');
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage('');
    }

    if (!formState.password || formState.password.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage('Password must be at least 6 characters long.');
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }

    if (!formState.firstname || formState.firstname.length < 1) {
      setFirstnameError(true);
      setFirstnameErrorMessage('First name is required.');
      isValid = false;
    } else {
      setFirstnameError(false);
      setFirstnameErrorMessage('');
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formState.email,
            password: formState.password,
            username: formState.username || undefined,
            firstname: formState.firstname || undefined,
            lastname: formState.lastname || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }
      
      onClose();
      navigate('/login', {
        state: {
          message:
            'Account created successfully! Please check your email to verify your account.',
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      setError(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      await googleAuth();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="signup-modal-title"
    >
      <ModalContainer>
        <Card variant="outlined">
          <IconButton
            aria-label="close"
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
          

          <nuLogo />
          <Typography
            id="signup-modal-title"
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            Sign up
          </Typography>

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <FormControl>
              <FormLabel htmlFor="firstname">First name</FormLabel>
              <TextField
                autoComplete="given-name"
                name="firstname"
                required
                fullWidth
                id="firstname"
                placeholder="John"
                value={formState.firstname}
                onChange={(e) => {
                  setFormState({ ...formState, firstname: e.target.value });
                  setError('');
                  setFirstnameError(false);
                }}
                error={firstnameError}
                helperText={firstnameErrorMessage}
                color={firstnameError ? 'error' : 'primary'}
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="lastname">Last name</FormLabel>
              <TextField
                autoComplete="family-name"
                name="lastname"
                fullWidth
                id="lastname"
                placeholder="Smith"
                value={formState.lastname}
                onChange={(e) => {
                  setFormState({ ...formState, lastname: e.target.value });
                  setError('');
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="email">Email</FormLabel>
              <TextField
                required
                fullWidth
                id="email"
                placeholder="j@example.com"
                name="email"
                autoComplete="email"
                variant="outlined"
                value={formState.email}
                onChange={(e) => {
                  setFormState({ ...formState, email: e.target.value });
                  setError('');
                  setEmailError(false);
                }}
                error={emailError}
                helperText={emailErrorMessage}
                color={emailError ? 'error' : 'primary'}
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="username">Username</FormLabel>
              <TextField
                fullWidth
                id="username"
                placeholder="johnsmith"
                name="username"
                autoComplete="username"
                variant="outlined"
                value={formState.username}
                onChange={(e) => {
                  setFormState({ ...formState, username: e.target.value });
                  setError('');
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                required
                fullWidth
                name="password"
                placeholder="••••••"
                type="password"
                id="password"
                autoComplete="new-password"
                variant="outlined"
                value={formState.password}
                onChange={(e) => {
                  setFormState({ ...formState, password: e.target.value });
                  setError('');
                  setPasswordError(false);
                }}
                error={passwordError}
                helperText={passwordErrorMessage}
                color={passwordError ? 'error' : 'primary'}
              />
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.allowExtraEmails}
                  onChange={(e) =>
                    setFormState({ ...formState, allowExtraEmails: e.target.checked })
                  }
                  color="primary"
                />
              }
              label="I want to receive updates via email."
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Sign up'}
            </Button>
          </Box>

          <Divider>
            <Typography sx={{ color: 'text.secondary' }}>or</Typography>
          </Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleGoogleSignup}
              startIcon={<GoogleIcon />}
              disabled={isLoading}
            >
              Sign up with Google
            </Button>
            <Typography sx={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link
                href="#"
                variant="body2"
                sx={{ alignSelf: 'center', cursor: 'pointer' }}
                onClick={(e) => {
                  e.preventDefault();
                  onClose();
                  navigate('/login');
                }}
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </Card>
      </ModalContainer>
    </Modal>
  );
}