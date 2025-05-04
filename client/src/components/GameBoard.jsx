// src/components/GameBoard.jsx
import React from 'react';
import { getCardImage, calculateHandTotal } from '../utils/GameHelpers';

export default function GameBoard({ dealerHand, playerHand, isSinglePlayer }) {
  return (
    <div>
      <h2>Dealer</h2>
      <div className="hand-display">
        {dealerHand.map((c, i) => (
          <img key={i} src={getCardImage(c)} className="card-image" />
        ))}
      </div>

      <h2>Player – Total {calculateHandTotal(playerHand)}</h2>
      <div className="hand-display">
        {playerHand.map((c, i) => (
          <img key={i} src={getCardImage(c)} className="card-image" />
        ))}
      </div>
    </div>
  );
}