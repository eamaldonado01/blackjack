import React, { useState } from 'react';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame from './MultiPlayerGame';
import './styles.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('menu'); // 'menu' | 'single' | 'multi'
  const [lobbyAction, setLobbyAction] = useState(''); // '' | 'create' | 'join'
  const [lobbyId, setLobbyId] = useState('');

  // Step 1: Username screen
  if (!ready) {
    return (
      <div className="table-container">
        <h1 className="title-banner">Blackjack</h1>
        <div className="join-container">
          <h2>Enter your username:</h2>
          <input
            type="text"
            placeholder="Username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {username && (
            <button className="common-button" onClick={() => setReady(true)}>
              Ready
            </button>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Mode selection
  if (mode === 'menu') {
    return (
      <div className="table-container">
        <h1 className="title-banner">Welcome, {username}!</h1>
        <h3>Please select a game mode:</h3>

        <div style={{ marginTop: '2rem' }}>
          <h2>Play Singleplayer</h2>
          <button className="common-button" onClick={() => setMode('single')}>
            Single Player
          </button>
        </div>

        <div style={{ marginTop: '3rem' }}>
          <h2>Play Multiplayer</h2>
          <button
            className="common-button"
            onClick={() => {
              setLobbyAction('create');
              setMode('multi');
            }}
          >
            Create New Lobby
          </button>

          <div style={{ marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Enter Lobby ID..."
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
            />
            <button
              className="common-button"
              onClick={() => {
                if (lobbyId.trim() === '') {
                  alert('Please enter a Lobby ID to join.');
                  return;
                }
                setLobbyAction('join');
                setMode('multi');
              }}
            >
              Join Existing Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'single') {
    return <SinglePlayerGame onBack={() => setMode('menu')} username={username} />;
  }

  return (
    <MultiPlayerGame
      onBack={() => setMode('menu')}
      username={username}
      lobbyAction={lobbyAction}
      lobbyId={lobbyId}
    />
  );
}
