import React from 'react';
import { getCardImage, calculateHandValue } from './utils/GameHelpers';
import chip5 from './assets/chips/5.webp';
import chip10 from './assets/chips/10.webp';
import chip25 from './assets/chips/25.webp';
import chip50 from './assets/chips/50.webp';
import chip100 from './assets/chips/100.webp';

export default function SinglePlayerGame(props) {
  const {
    onBack, username, balance, bet,
    dealerHand, playerHand, playerMessage,
    canDouble, showActions,
    handleHit, handleStand, handleDouble,
    handleClearBet, handleDeal, handleAddChipBet,
    handleNewRound, gameOver, roundFinished,
  } = props;

  const chipImages={5:chip5,10:chip10,25:chip25,50:chip50,100:chip100};
  const playing = playerHand.length>0;
  const dealerTotal =
    dealerHand.length>0
      ? (dealerHand[1]?.rank==='Hidden'
          ? calculateHandValue([dealerHand[0]])
          : calculateHandValue(dealerHand))
      : 0;

  return(
    <div className="table-container">
      <button className="common-button back-button" onClick={onBack}>Menu</button>

      {!gameOver && roundFinished &&
        <button className="common-button new-round-button" onClick={handleNewRound}>New Round</button>}

      <h1 className="title-banner">Blackjack – Single Player</h1>

      <div className="balance-section">
        <div>Balance: ${balance}</div><div>Current Bet: ${bet}</div>
      </div>

      {playing && (
        <div className="dealer-area">
          <h2>Dealer – {dealerTotal}</h2>
          <div className="hand-display">
            {dealerHand.map((c,i)=><img key={i} src={getCardImage(c)} className="card-image" alt="card" loading="lazy" />)}
          </div>
        </div>
      )}

      {playing && (
        <div className="player-area">
          <div className="hand-display">
            {playerHand.map((c,i)=><img key={i} src={getCardImage(c)} className="card-image" alt="card" loading="lazy" />)}
          </div>
          <h2>{username} – {calculateHandValue(playerHand)}</h2>
        </div>
      )}

      {playerMessage && <p className="player-message">{playerMessage}</p>}

      {playing && showActions && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
          {canDouble && <button className="common-button" onClick={handleDouble}>Double</button>}
        </div>
      )}

      {!playing && !gameOver && (
        <>
          <div className="bet-actions">
            <button className="common-button" onClick={handleClearBet}>Clear Bet</button>
            <button className="common-button" onClick={handleDeal}>Deal</button>
          </div>
          <div className="chips-row">
            {[5,10,25,50,100].map(v=>(
              <img key={v} src={chipImages[v]} className="chip-image" onClick={()=>handleAddChipBet(v)} alt={`$${v} chip`}/>
            ))}
          </div>
        </>
      )}

      {gameOver && (
        <div className="game-over">
          Game Over!
        </div>
      )}
    </div>
  );
}
