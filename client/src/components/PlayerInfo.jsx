// src/components/PlayerInfo.jsx
import React from 'react';

export default function PlayerInfo({ username, balance, currentBet }) {
  return (
    <div className="balance-section">
      <h2>Player: {username}</h2>
      <button className="common-button" disabled>Balance: ${balance}</button>
      <button className="common-button" disabled>Current Bet: ${currentBet}</button>
    </div>
  );
}