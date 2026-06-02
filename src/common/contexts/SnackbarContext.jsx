import React, { createContext, useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';
import { Snackbar, Alert } from '@mui/material';

const SnackbarContext = createContext(null);

SnackbarProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function SnackbarProvider({ children }) {
  const [state, setState] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setState({ open: true, message, severity });
  }, []);

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setState(prev => ({ ...prev, open: false }));
  };

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={2000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ mb: 2, mr: 2 }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="standard"
          icon={false}
          sx={{
            height: "30px",
            backgroundColor: '#fff',
            color: '#111',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            fontSize: '14px',
            fontWeight: 500,
            alignItems: 'center',
            borderLeft: `3px solid ${state.severity === 'success' ? '#22c55e' : '#ef4444'}`,
            '& .MuiAlert-action .MuiIconButton-root': {
              color: '#999',
              '&:hover': { color: '#333' },
            },
          }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}
