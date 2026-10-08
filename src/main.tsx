import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';
import './workspaces.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
