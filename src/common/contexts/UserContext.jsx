import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { auth, googleProvider } from '@/firebase-config';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';

export const UserContext = React.createContext({
  user: null,
  isLoading: false,
  logout: () => { },
  login: () => { },
  googleAuth: () => { },
  requestPasswordReset: () => { },
});

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

const buildUrl = (endpoint) =>
  `${import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')}${endpoint}`;

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 🔥 YOU WERE MISSING THIS LINE
          const idToken = await firebaseUser.getIdToken();
      
          // Step 1: sync with backend
          await fetch(buildUrl('/auth/token'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
            credentials: 'include',
          });
      
          // Step 2: fetch profile
          const response = await fetch(buildUrl('/auth/profile'), {
            headers: { Authorization: `Bearer ${idToken}` },
          });
      
          if (response.ok) {
            const backendUserData = await response.json();
            setUser({ ...firebaseUser, ...backendUserData });
          } else {
            setUser(firebaseUser);
          }
        } catch (err) {
          console.error('Auth sync error:', err);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

// Alternative: Use popup with proper error handling
const googleAuth = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Google auth successful:', result.user);
    return result;
  } catch (error) {
    if (error.code === 'auth/popup-blocked') {
      alert('Popup was blocked. Please allow popups for this site.');
    }
    console.error('Google auth error:', error);
    throw error;
  }
};

  const requestPasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  };

  const contextValue = {
    user,
    isLoading,
    login,
    logout,
    googleAuth,
    requestPasswordReset,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export const useUser = () => {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};