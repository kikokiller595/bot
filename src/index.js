import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWithAuth from './AppWithAuth';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  </React.StrictMode>
);

