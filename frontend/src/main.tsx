import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { AppWithRouter } from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithRouter />
  </StrictMode>,
);
