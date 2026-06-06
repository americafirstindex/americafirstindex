import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import EndorsedMap from './pages/EndorsedMap/EndorsedMap';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EndorsedMap />
  </StrictMode>
);
