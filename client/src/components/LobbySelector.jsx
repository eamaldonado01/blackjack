// src/components/LobbySelector.jsx
import React, { useState } from 'react';

export default function LobbySelector({ onCreate, onJoin }) {
  const [lobbyId, setLobbyId] = useState('');

  return (
    <div>
      <button onClick={onCreate}>Create New Lobby</button>
      <input value={lobbyId} onChange={(e) => setLobbyId(e.target.value)} placeholder="Lobby ID" />
      <button onClick={() => onJoin(lobbyId)}>Join Lobby</button>
    </div>
  );
}
