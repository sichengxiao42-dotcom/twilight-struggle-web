import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './archive-skin.css';
import './board-material.css';
import './board-sample.css';

document.documentElement.dataset.material = 'board';

function Sample() {
  const [board, setBoard] = useState(true);
  return <><App/><button className="material-compare" aria-pressed={board} onClick={() => {
    document.documentElement.dataset.material = board ? 'original' : 'board';
    setBoard(!board);
  }}>{board ? '纸板样板 · 点击对比原版' : '原版 · 点击查看纸板样板'}</button></>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Sample/></StrictMode>);
