import React, { useState } from 'react';

export default function ModeSelector({ username, onSingle, onCreateLobby, onJoinLobby }) {
  const [lobbyId, setLobbyId] = useState('');

  return (
    <div className="table-container">
      <h1 className="title-banner">Welcome, {username}!</h1>
      <h3>Please select a game mode:</h3>

      <div className="section-spacing">
        <h2>Play Singleplayer</h2>
        <button className="common-button" onClick={onSingle}>
          Single Player
        </button>
      </div>

      <div className="section-spacing">
        <h2>Play Multiplayer</h2>
        <button className="common-button" onClick={onCreateLobby}>
          Create New Lobby
        </button>

        <div className="subsection-spacing">
          <input
            type="text"
            placeholder="Enter Lobby ID..."
            value={lobbyId}
            onChange={(e) => setLobbyId(e.target.value)}
          />
          <button className="common-button" onClick={() => onJoinLobby(lobbyId)}>
            Join Existing Lobby
          </button>
        </div>
      </div>
    </div>
  );
}