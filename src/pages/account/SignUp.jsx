import * as React from 'react';
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Modal from '@mui/material/Modal';
import MuiCard from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import GoogleIcon from '@mui/icons-material/Google';
import { styled } from '@mui/material/styles';
import { useUser } from '@/common/contexts/UserContext';
import nuLogo from '../../assets/nuLogo.svg';

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

function mapFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/invalid-credential': return 'Email or password is incorrect.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    default: return 'An unexpected error occurred. Please try again.';
  }
}

export default function SignUpModal({ open, onClose }) {
  const { login, signup, googleAuth, requestPasswordReset } = useUser();

  const [mode, setMode] = useState('signup');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setEmailError('');
    setPasswordError('');
    setUsernameError('');
    setError('');
    setSuccessMessage('');
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const validateEmail = () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = () => {
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const usernameValid = username.trim().length > 0;
    if (!usernameValid) setUsernameError('Username is required.');
    else setUsernameError('');
    if (!validateEmail() | !validatePassword() | !usernameValid) return;

    setIsLoading(true);
    setError('');
    try {
      await signup(email, password, username.trim());
      switchMode('login');
      setSuccessMessage('Account created! Please check your email to verify your account.');
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateEmail() | !validatePassword()) return;

    setIsLoading(true);
    setError('');
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!validateEmail()) return;

    setIsLoading(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      await googleAuth();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const titles = { signup: 'Sign up', login: 'Sign in', forgot: 'Reset password' };

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="auth-modal-title">
      <ModalContainer>
        <Card variant="outlined">
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>

          <img src={nuLogo} alt="Logo" style={{ maxWidth: 50 }} />
          <Typography
            id="auth-modal-title"
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            {titles[mode]}
          </Typography>

          {successMessage && (
            <Alert severity="success" onClose={() => setSuccessMessage('')}>
              {successMessage}
            </Alert>
          )}
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* SIGNUP MODE */}
          {mode === 'signup' && (
            <>
              <Box component="form" onSubmit={handleSignup} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl>
                  <FormLabel htmlFor="username">Username</FormLabel>
                  <TextField
                    required
                    fullWidth
                    id="username"
                    name="username"
                    placeholder="johnsmith"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setUsernameError(''); setError(''); }}
                    error={!!usernameError}
                    helperText={usernameError}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <TextField
                    required
                    fullWidth
                    id="email"
                    name="email"
                    placeholder="johnsmith@u.northwestern.edu"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); setError(''); }}
                    error={!!emailError}
                    helperText={emailError}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="password">Password</FormLabel>
                  <TextField
                    required
                    fullWidth
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); setError(''); }}
                    error={!!passwordError}
                    helperText={passwordError}
                  />
                </FormControl>
                <Button type="submit" fullWidth variant="contained" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Sign up'}
                </Button>
              </Box>
              <Divider><Typography sx={{ color: 'text.secondary' }}>or</Typography></Divider>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button fullWidth variant="outlined" onClick={handleGoogleAuth} startIcon={<GoogleIcon />} disabled={isLoading}>
                  Sign up with Google
                </Button>
                <Typography sx={{ textAlign: 'center' }}>
                  Already have an account?{' '}
                  <Link href="#" variant="body2" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>
                    Sign in
                  </Link>
                </Typography>
              </Box>
            </>
          )}

          {/* LOGIN MODE */}
          {mode === 'login' && (
            <>
              <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl>
                  <FormLabel htmlFor="login-email">Email</FormLabel>
                  <TextField
                    required
                    fullWidth
                    id="login-email"
                    name="email"
                    placeholder="johnsmith@u.northwestern.edu"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); setError(''); }}
                    error={!!emailError}
                    helperText={emailError}
                  />
                </FormControl>
                <FormControl>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <FormLabel htmlFor="login-password">Password</FormLabel>
                    <Link href="#" variant="body2" onClick={(e) => { e.preventDefault(); switchMode('forgot'); }}>
                      Forgot password?
                    </Link>
                  </Box>
                  <TextField
                    required
                    fullWidth
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); setError(''); }}
                    error={!!passwordError}
                    helperText={passwordError}
                  />
                </FormControl>
                <Button type="submit" fullWidth variant="contained" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </Box>
              <Divider><Typography sx={{ color: 'text.secondary' }}>or</Typography></Divider>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button fullWidth variant="outlined" onClick={handleGoogleAuth} startIcon={<GoogleIcon />} disabled={isLoading}>
                  Sign in with Google
                </Button>
                <Typography sx={{ textAlign: 'center' }}>
                  Don&apos;t have an account?{' '}
                  <Link href="#" variant="body2" onClick={(e) => { e.preventDefault(); switchMode('signup'); }}>
                    Sign up
                  </Link>
                </Typography>
              </Box>
            </>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </Typography>
              <Box component="form" onSubmit={handleForgot} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl>
                  <FormLabel htmlFor="forgot-email">Email</FormLabel>
                  <TextField
                    required
                    fullWidth
                    id="forgot-email"
                    name="email"
                    placeholder="johnsmith@u.northwestern.edu"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); setError(''); }}
                    error={!!emailError}
                    helperText={emailError}
                  />
                </FormControl>
                <Button type="submit" fullWidth variant="contained" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send reset email'}
                </Button>
              </Box>
              <Typography sx={{ textAlign: 'center' }}>
                <Link href="#" variant="body2" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>
                  Back to sign in
                </Link>
              </Typography>
            </>
          )}
        </Card>
      </ModalContainer>
    </Modal>
  );
}
