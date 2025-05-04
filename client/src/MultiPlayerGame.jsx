import React from 'react';
import { getCardImage, calculateHandValue } from './utils/GameHelpers';
import chip5   from './assets/chips/5.png';
import chip10  from './assets/chips/10.png';
import chip25  from './assets/chips/25.png';
import chip50  from './assets/chips/50.png';
import chip100 from './assets/chips/100.png';

export default function MultiPlayerGame({
  onBack, uid,
  lobbyData, lobbyId, gameState,
  allReady, hostStartGame,
  balance, bet,
  handleAddChipBet, handleClearBet, handleDeal,
  handleHit, handleStand,
}) {
  const chipImages = {5:chip5,10:chip10,25:chip25,50:chip50,100:chip100};

    /* --------------- loading ----------------------------------------- */
  if (!lobbyData) {
    return (
      <div className="table-container">
        <h2 className="turn-message">Connecting to lobby…</h2>
      </div>
    );
  }

  /* --------------- WAITING ROOM ------------------------------------ */
  if (!gameState) {
    return (
      <div className="table-container">
        <button className="common-button back-button" onClick={onBack}>Menu</button>
        <h1 className="title-banner">Blackjack – Multiplayer</h1>

        <div className="turn-message">
          Lobby ID:&nbsp;<strong>{lobbyId}</strong>
        </div>

        <ul className="player-list">
          {(lobbyData.players ?? []).map(p=>(
            <li key={p}>
              {p === lobbyData.host && '👑 '}
              {lobbyData.usernames[p]} —&nbsp;
              <span style={{color:lobbyData.ready[p]?'#0f0':'#f44'}}>
                {lobbyData.ready?.[p] ? 'Ready' : 'Not ready'}
              </span>
            </li>
          ))}
        </ul>

        {/* betting controls for players who haven't pressed Deal yet */}
        {!lobbyData.ready?.[uid] && (
          <>
            <div className="bet-actions">
              <button className="common-button" onClick={handleClearBet}>Clear Bet</button>
              <button className="common-button" onClick={handleDeal}>Deal</button>
            </div>
            <div className="chips-row">
              {[5,10,25,50,100].map(v=>(
                <img key={v} src={chipImages[v]} className="chip-image"
                     onClick={()=>handleAddChipBet(v)} alt={`$${v} chip`} />
              ))}
            </div>
          </>
        )}

        {uid === lobbyData.host && allReady &&
          <button className="common-button host-start-btn" onClick={hostStartGame}>
            Start Game
          </button>}
      </div>
    );
  }

  /* --------------- ACTIVE GAME ------------------------------------- */
  const dealerHand  = gameState.dealerHand;
  const myIdx       = lobbyData.players.indexOf(uid);
  const isMyTurn    = gameState.currentIdx === myIdx;

  /* create ordered player blocks (right → left) */
  const blocks = [...lobbyData.players].reverse().map(pid=>{
    const hand = gameState.hands[pid];
    return (
      <div className="mp-player-area" key={pid}>
        <div className="hand-display">
          {hand.map((c,i)=>
            <img key={i} src={getCardImage(c)} className="card-image" alt="card"/>
          )}
        </div>
        <h3>
          {lobbyData.usernames[pid]}
          {gameState.currentIdx === lobbyData.players.indexOf(pid) && ' ←'}
          &nbsp;– {calculateHandValue(hand)}
        </h3>
        {gameState.outcome[pid] && <p>{gameState.outcome[pid]}</p>}
      </div>
    );
  });

  return (
    <div className="table-container">
      <button className="common-button back-button" onClick={onBack}>Menu</button>
      <h1 className="title-banner">Blackjack – Multiplayer</h1>

      {/* dealer */}
      <div className="dealer-area">
        <h2>Dealer</h2>
        <div className="hand-display">
          {dealerHand.map((c,i)=>
            <img key={i} src={getCardImage(c)} className="card-image" alt="card"/>
          )}
        </div>
      </div>

      {/* players row */}
      <div className="mp-players-row">
        {blocks}
      </div>

      {/* action buttons if it's my turn */}
      {isMyTurn && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
        </div>
      )}
    </div>
  );
}
