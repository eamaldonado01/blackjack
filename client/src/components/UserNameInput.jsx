import React from 'react';
import PropTypes from 'prop-types';

export default function UsernameInput({ username, setUsername, onReady }) {
  return (
    <div className="table-container">
      <h1 className="title-banner">Blackjack</h1>

      {/* centred entry card ----------------------------------- */}
      <div className="join-container">
  <h2>Enter your username:</h2>
  <input
    type="text"
    placeholder="Username..."
    value={username}
    onChange={(e) => setUsername(e.target.value)}
  />
</div>
{username && (
    <div className="ready-wrapper">
      <button className="common-button" onClick={onReady}>
        Ready
      </button>
    </div>
  )}
</div>
  );
}


UsernameInput.propTypes = {
  username: PropTypes.string.isRequired,
  setUsername: PropTypes.func.isRequired,
  onReady: PropTypes.func.isRequired,
};
