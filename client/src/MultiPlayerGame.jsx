import React from 'react';
import { getCardImage, calculateHandValue } from './utils/GameHelpers';
import chip5 from './assets/chips/5.png';
import chip10 from './assets/chips/10.png';
import chip25 from './assets/chips/25.png';
import chip50 from './assets/chips/50.png';
import chip100 from './assets/chips/100.png';

export default function MultiPlayerGame({
  onBack, username, balance, bet, dealerHand, playerHand,
  dealerMessage, playerMessage, canDouble, showActions,
  handleHit, handleStand, handleDouble, handleClearBet,
  handleDeal, handleAddChipBet, handleNewRound,
  gameOver, roundFinished, lobbyJoined
}) {
  const chipImages = { 5: chip5, 10: chip10, 25: chip25, 50: chip50, 100: chip100 };

  return (
    <div className="table-container">
      <button className="common-button back-button" onClick={onBack}>↩ Menu</button>
      <h1 className="title-banner">Blackjack – Multiplayer</h1>

      {!lobbyJoined ? (
        <p>Waiting in lobby...</p>
      ) : gameOver ? (
        <div className="game-over">
          <h2>Game Over!</h2>
          <button className="common-button" onClick={onBack}>Back to Menu</button>
        </div>
      ) : roundFinished ? (
        <button className="common-button new-round-button" onClick={handleNewRound}>New Round</button>
      ) : showActions ? (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
          {canDouble && <button className="common-button" onClick={handleDouble}>Double</button>}
        </div>
      ) : (
        <div className="bet-actions">
          <button className="common-button" onClick={handleClearBet}>Clear Bet</button>
          <button className="common-button" onClick={handleDeal}>Deal</button>
        </div>
      )}

      <div className="balance-section">
        <div>Balance: ${balance}</div>
        <div>Current Bet: ${bet}</div>
      </div>

      <div className="dealer-area">
        <h2>Dealer</h2>
        <div className="hand-display">
          {dealerHand.map((c, i) => (
            <img key={i} src={getCardImage(c)} className="card-image" alt={`Dealer card ${i}`} />
          ))}
        </div>
        <p className="dealer-message">{dealerMessage}</p>
      </div>

      <div className="player-area">
        <h2>{username} – Total {calculateHandValue(playerHand)}</h2>
        <div className="hand-display">
          {playerHand.map((c, i) => (
            <img key={i} src={getCardImage(c)} className="card-image" alt={`Player card ${i}`} />
          ))}
        </div>
        <p className="player-message">{playerMessage}</p>
      </div>

      {!showActions && !roundFinished && (
        <div className="chips-row">
          {[5, 10, 25, 50, 100].map((value) => (
            <img
              key={value}
              src={chipImages[value]}
              className="chip-image"
              onClick={() => handleAddChipBet(value)}
              alt={`$${value} chip`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
