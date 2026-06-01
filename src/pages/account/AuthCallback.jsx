import React, { useEffect } from 'react';

import { getRedirectResult } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { auth } from '@/firebase-config';
import { BACKEND_URL } from '@/utils/constants';

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
`;

const LoadingText = styled.p`
  font-size: 1rem;
`;

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // Handles the result of a signInWithRedirect() call (e.g. on mobile).
        // If the user signed in via popup (desktop), result will be null and we
        // redirect home immediately.
        const result = await getRedirectResult(auth);

        if (!result) {
          navigate('/', { replace: true });
          return;
        }

        const idToken = await result.user.getIdToken();

        const response = await fetch(
          `${BACKEND_URL}/auth/token`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Authentication failed');
        }

        navigate('/', { replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', {
          state: { error: error.message },
          replace: true,
        });
      }
    };

    handleRedirectResult();
  }, [navigate]);

  return (
    <Container>
      <LoadingText>Completing authentication...</LoadingText>
    </Container>
  );
}
