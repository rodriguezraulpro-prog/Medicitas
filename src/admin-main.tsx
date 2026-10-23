import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicProvider } from './context/ClinicContext';
import { AdminApp } from './AdminApp';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClinicProvider>
      <AdminApp />
    </ClinicProvider>
  </StrictMode>,
);
