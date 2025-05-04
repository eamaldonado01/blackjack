// src/components/GameMessage.jsx
import React from 'react';

export default function GameMessage({ dealerMessage, playerMessage }) {
  return (
    <div className="message-display">
      {dealerMessage && <p>Dealer: {dealerMessage}</p>}
      {playerMessage && <p>{playerMessage}</p>}
    </div>
  );
}
