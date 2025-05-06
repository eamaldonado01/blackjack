import React from 'react';
import { getCardImage, calculateHandValue } from './utils/GameHelpers';
import chip5 from './assets/chips/5.png';
import chip10 from './assets/chips/10.png';
import chip25 from './assets/chips/25.png';
import chip50 from './assets/chips/50.png';
import chip100 from './assets/chips/100.png';

export default function MultiPlayerGame({
  onBack, uid, lobbyData, lobbyId,
  balance, bet, allReady, hostStartGame,
  handleAddChipBet, handleClearBet, handleDeal,
  gameState, handleHit, handleStand, hostNewRound,
}) {
  const chipImages = { 5: chip5, 10: chip10, 25: chip25, 50: chip50, 100: chip100 };

  if (!lobbyData)
    return (
      <div className="table-container">
        <h2 className="turn-message">Connecting…</h2>
      </div>
    );

  /* ───── Waiting Room ───── */
  if (!gameState) {
    return (
      <div className="table-container">
        <button className="common-button back-button" onClick={onBack}>
          Menu
        </button>

        <h1 className="title-banner">Blackjack – Multiplayer</h1>

        <div className="lobby-banner common-button">Lobby ID: {lobbyId}</div>

        <ul className="player-list">
          {lobbyData.players.map(p => (
            <li key={p}>
              {p === lobbyData.host && '👑 '}
              {lobbyData.usernames[p]} —{' '}
              <span style={{ color: lobbyData.ready[p] ? '#0f0' : '#f44' }}>
                {lobbyData.ready[p] ? 'Ready' : 'Not ready'}
              </span>
            </li>
          ))}
        </ul>

        <div className="balance-section">
          <div>Balance: ${balance}</div>
          <div>Current Bet: ${bet}</div>
        </div>

        {!lobbyData.ready[uid] && (
          <>
            <div className="bet-actions">
              <button className="common-button" onClick={handleClearBet}>
                Clear Bet
              </button>
              <button className="common-button" onClick={handleDeal}>
                Deal
              </button>
            </div>
            <div className="chips-row">
              {[5, 10, 25, 50, 100].map(v => (
                <img
                  key={v}
                  src={chipImages[v]}
                  className="chip-image"
                  onClick={() => handleAddChipBet(v)}
                  alt="chip"
                />
              ))}
            </div>
          </>
        )}

        {uid === lobbyData.host && allReady && (
          <button className="common-button host-start-btn" onClick={hostStartGame}>
            Start Game
          </button>
        )}
      </div>
    );
  }

  /* ───── Active Game ───── */
  const dealerHand = gameState.dealerHand;
  const dealerTotal =
    dealerHand[1].rank === 'Hidden'
      ? calculateHandValue([dealerHand[0]])
      : calculateHandValue(dealerHand);

  const currentUid =
    lobbyData.players[Math.min(gameState.currentIdx, lobbyData.players.length - 1)];
  const turnText = !gameState.roundFinished
    ? `${lobbyData.usernames[currentUid]}'s Turn`
    : 'Round Finished';

  const myIdx = lobbyData.players.indexOf(uid);
  const isMyTurn = gameState.currentIdx === myIdx && !gameState.roundFinished;
  const myBalance = gameState.balances[uid];

  const blocks = [...lobbyData.players].reverse().map(pid => {
    const hand = gameState.hands[pid];
    return (
      <div className="mp-player-area" key={pid}>
        <div className="hand-display no-wrap">
          {hand.map((c, i) => (
            <img key={i} src={getCardImage(c)} className="card-image" alt="card" />
          ))}
        </div>
        <h3 className="player-name">
          {lobbyData.usernames[pid]} – {calculateHandValue(hand)}
        </h3>
        {gameState.outcome[pid] && (
          <p className="player-result">{gameState.outcome[pid]}</p>
        )}
      </div>
    );
  });

  return (
    <div className="table-container">
      <button className="common-button back-button" onClick={onBack}>
        Menu
      </button>
      <h1 className="title-banner">Blackjack – Multiplayer</h1>

      <div className="lobby-banner common-button">Lobby ID: {lobbyId}</div>
      <div className="turn-indicator">{turnText}</div>

      <div className="dealer-area">
        <h2>Dealer – {dealerTotal}</h2>
        <div className="hand-display">
          {dealerHand.map((c, i) => (
            <img key={i} src={getCardImage(c)} className="card-image" alt="card" />
          ))}
        </div>
      </div>

      <div className="balance-section">
        <div>Balance: ${gameState.balances[uid]}</div>
        <div>Current Bet: ${gameState.bets[uid]}</div>
      </div>

      <div className="mp-players-row">{blocks}</div>

      {isMyTurn && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>
            Hit
          </button>
          <button className="common-button" onClick={handleStand}>
            Stand
          </button>
        </div>
      )}

      {uid === lobbyData.host && gameState.roundFinished && (
        <button className="common-button new-round-button" onClick={hostNewRound}>
          New Round
        </button>
      )}

      {gameState.roundFinished && myBalance === 0 && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <button className="common-button" onClick={onBack}>
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}
