import React, { useState } from 'react';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame from './MultiPlayerGame';
import UsernameInput from './components/UserNameInput';
import ModeSelector from './components/ModeSelector';
import './styles.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('menu');
  const [lobbyAction, setLobbyAction] = useState('');
  const [lobbyId, setLobbyId] = useState('');

  if (!ready) {
    return (
      <UsernameInput
        username={username}
        setUsername={setUsername}
        onReady={() => setReady(true)}
      />
    );
  }

  if (mode === 'menu') {
    return (
      <ModeSelector
        username={username}
        onSingle={() => setMode('single')}
        onCreateLobby={() => {
          setLobbyAction('create');
          setMode('multi');
        }}
        onJoinLobby={(id) => {
          if (id.trim() === '') {
            alert('Please enter a Lobby ID to join.');
            return;
          }
          setLobbyId(id);
          setLobbyAction('join');
          setMode('multi');
        }}
      />
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