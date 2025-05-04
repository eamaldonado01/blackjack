// App.jsx – top‑level router between modes
// path: blackback/client/src/App.jsx
import React, { useState } from 'react';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame from './MultiPlayerGame';
import './styles.css';

export default function App() {
  const [mode, setMode] = useState('menu'); // 'menu' | 'single' | 'multi'

  if (mode === 'menu') {
    return (
      <div className="table-container">
        <h1 className="title-banner">Full‑Stack Blackjack</h1>
        <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
          <button className="common-button" onClick={() => setMode('single')}>
            Single Player
          </button>
          <button className="common-button" onClick={() => setMode('multi')}>
            Multi Player
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'single') {
    return <SinglePlayerGame onBack={() => setMode('menu')} />;
  }

  return <MultiPlayerGame onBack={() => setMode('menu')} />;
}
