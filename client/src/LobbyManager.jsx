// path: blackback/client/src/LobbyManager.jsx
import React, { useState } from 'react';
import { useLobby } from './hooks/useLobby';

export default function LobbyManager({ username, onLobbyJoined }) {
  const [inputLobbyId, setInputLobbyId] = useState('');
  const { lobbyId, lobbyData, createLobby, joinLobby, loading, error } = useLobby(username);

  const handleCreateLobby = async () => {
    const id = await createLobby();
    if (onLobbyJoined) onLobbyJoined(id);
  };

  const handleJoinLobby = async (id) => {
    const success = await joinLobby(id);
    if (success && onLobbyJoined) onLobbyJoined(id);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error.message}</p>;

  if (!lobbyId) {
    return (
      <div>
        <h2>Welcome, {username}!</h2>
        <button onClick={handleCreateLobby}>Create Lobby</button>

        <div>
          <input
            type="text"
            placeholder="Enter lobby ID"
            value={inputLobbyId}
            onChange={(e) => setInputLobbyId(e.target.value)}
          />
          <button onClick={() => handleJoinLobby(inputLobbyId)}>Join Lobby</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Lobby ID: {lobbyId}</h2>
      <h3>Players:</h3>
      <ul>
        {lobbyData?.players?.map((p) => (
          <li key={p.id}>{p.username}</li>
        ))}
      </ul>
    </div>
  );
}
