import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './archive-skin.css';
import './board-material.css';

document.documentElement.dataset.material = 'board';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
