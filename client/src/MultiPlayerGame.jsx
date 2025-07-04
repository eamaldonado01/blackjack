import React, { useEffect } from 'react';
import { getCardImage, calculateHandValue } from './utils/GameHelpers';
import chip5 from './assets/chips/5.webp';
import chip10 from './assets/chips/10.webp';
import chip25 from './assets/chips/25.webp';
import chip50 from './assets/chips/50.webp';
import chip100 from './assets/chips/100.webp';

export default function MultiPlayerGame({
  onBack, uid, lobbyId, lobbyData,
  balance, bet,                 /* ← live local figures for chip clicks */
  allReady, hostStartGame,
  handleAddChipBet, handleClearBet, handleDeal,
  gameState, handleHit, handleStand, handleDouble, hostNewRound,
}) {
  const chips = {5:chip5,10:chip10,25:chip25,50:chip50,100:chip100};

  if (!lobbyData || !Array.isArray(lobbyData.players)) {
    return <div className="table-container"><h2 className="player-message">Connecting…</h2></div>;
  }

  /* =========================================================== *
   * ===================   WAITING ROOM   ====================== *
   * =========================================================== */
  if (!gameState) {
    const ready      = lobbyData.ready?.[uid];
    const lobbyBal   = lobbyData.balances?.[uid] ?? 100;
    const lobbyBet   = lobbyData.bets?.[uid]     ?? 0;

    /* show **live** local numbers while the player is still editing bet */
    const displayBal = ready ? lobbyBal - lobbyBet : balance;
    const displayBet = ready ? lobbyBet            : bet;

    return (
      <div className="table-container">
        <button className="common-button back-button" onClick={onBack}>Menu</button>
        <h1 className="title-banner">Blackjack – Multiplayer</h1>
        <div className="lobby-banner">{`Lobby ID: ${lobbyId}`}</div>

        <div className="waiting-list-container">
  <ul className="player-list">
    {lobbyData.players.map(pid => {
      const username = lobbyData.usernames?.[pid] || 'Player';
      const balance  = lobbyData.balances?.[pid] ?? 100;
      const betAmt   = lobbyData.bets?.[pid] ?? 0;
      const isBetting = betAmt > 0;

      const displayBal = isBetting ? (balance - betAmt) : balance;
      const statusText = isBetting
        ? `Betting $${betAmt}`
        : 'Not Ready';

      return (
        <li key={pid}>
          {pid === lobbyData.host && '👑 '}
          {username} — ${displayBal} — {statusText}
        </li>
      );
    })}
  </ul>

  {uid === lobbyData.host && allReady && (
    <button className="common-button host-start-btn" onClick={hostStartGame}>
      Start Game
    </button>
  )}
</div>


        <div className="balance-section">
          <div>Balance: ${displayBal}</div>
          <div>Current Bet: ${displayBet}</div>
        </div>

        {!ready && (
          <>
            <div className="bet-actions">
              <button className="common-button" onClick={handleClearBet}>Clear Bet</button>
              <button className="common-button" onClick={handleDeal}>Deal</button>
            </div>

            <div className="chips-row">
              {[5,10,25,50,100].map(v=>(
                <img key={v} src={chips[v]} className="chip-image"
                     alt={`$${v} chip`} onClick={()=>handleAddChipBet(v)}/>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  /* =========================================================== *
   * ===================   ACTIVE ROUND   ====================== *
   * =========================================================== */
  const dealerHand  = gameState.dealerHand;
  const dealerTotal =
    dealerHand[1].rank === 'Hidden'
      ? calculateHandValue([dealerHand[0]])
      : calculateHandValue(dealerHand);

  const currentUid = lobbyData.players[
    Math.min(gameState.currentIdx, lobbyData.players.length - 1)
  ];
  const isMyTurn   = currentUid === uid && !gameState.roundFinished;
  const myHand     = gameState.hands[uid] ?? [];

  /* -------------- auto‑skip if I already have blackjack ----------- */
  useEffect(() => {
    if (isMyTurn && myHand.length === 2 && calculateHandValue(myHand) === 21) {
      handleStand();   // silently advance turn
    }
  }, [isMyTurn, myHand, handleStand]);

  const allowDouble =
    isMyTurn &&
    myHand.length === 2 &&
    gameState.balances[uid] >= gameState.bets[uid];

  return (
    <div className="table-container">
      <button className="common-button back-button" onClick={onBack}>Menu</button>
      <h1 className="title-banner">Blackjack – Multiplayer</h1>
      <div className="lobby-banner">{`Lobby ID: ${lobbyId}`}</div>

      {/* --------- Dealer ---------- */}
      <div className="dealer-area">
        <h2>Dealer – {dealerTotal}</h2>
        <div className="hand-display">
          {dealerHand.map((c,i)=><img key={i} src={getCardImage(c)} className="card-image" alt="card" loading="lazy" />)}
        </div>
      </div>

      <div className="turn-indicator">
        {gameState.roundFinished ? 'Round Finished'
          : `${lobbyData.usernames[currentUid]}'s Turn`}
      </div>

      <div className="balance-section">
        <div>Balance: ${gameState.balances[uid]}</div>
        <div>Current Bet: ${gameState.bets[uid]}</div>
      </div>

      {/* --------- Players ---------- */}
      <div className="mp-players-row">
        {[...lobbyData.players].reverse().map(pid => {
          const hand = gameState.hands[pid] ?? [];
          if (hand.length === 0) return null;
          return (
            <div className="mp-player-area" key={pid}>
              <div className="hand-display">
                {hand.map((c,i)=><img key={i} src={getCardImage(c)} className="card-image" alt="card" loading="lazy" />)}
              </div>
              <h3 className="player-name">
                {lobbyData.usernames[pid]} – {calculateHandValue(hand)}
              </h3>
              {gameState.outcome[pid] && (
                <p className="player-result">{gameState.outcome[pid]}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* --------- Action Buttons ---------- */}
      {isMyTurn && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
          {allowDouble && (
            <button className="common-button" onClick={handleDouble}>Double</button>
          )}
        </div>
      )}

      {uid === lobbyData.host && gameState.roundFinished && (
        <button className="common-button new-round-button" onClick={hostNewRound}>
          New Round
        </button>
      )}
    </div>
  );
}
