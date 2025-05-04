import React, { useState } from 'react';
import PropTypes from 'prop-types';

export default function LobbySelector({ onCreate, onJoin }) {
  const [lobbyId, setLobbyId] = useState('');

  return (
    <div>
      <button onClick={onCreate}>Create New Lobby</button>
      <input
        value={lobbyId}
        onChange={(e) => setLobbyId(e.target.value)}
        placeholder="Lobby ID"
      />
      <button onClick={() => onJoin(lobbyId)}>Join Lobby</button>
    </div>
  );
}

LobbySelector.propTypes = {
  onCreate: PropTypes.func.isRequired,
  onJoin: PropTypes.func.isRequired,
};
