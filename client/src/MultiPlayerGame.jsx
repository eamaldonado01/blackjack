import React from 'react';
import { getCardImage, calculateHandValue } from './utils/GameHelpers';
import chip5   from './assets/chips/5.png';
import chip10  from './assets/chips/10.png';
import chip25  from './assets/chips/25.png';
import chip50  from './assets/chips/50.png';
import chip100 from './assets/chips/100.png';

export default function MultiPlayerGame({
  onBack, username, balance, bet, dealerHand, playerHand,
  dealerMessage, playerMessage, canDouble, showActions,
  handleHit, handleStand, handleDouble, handleClearBet,
  handleDeal, handleAddChipBet, handleNewRound,
  gameOver, roundFinished, lobbyJoined, isMyTurn
}) {
  const chipImages = {5:chip5,10:chip10,25:chip25,50:chip50,100:chip100};
  const playing    = playerHand.length > 0;

  /* dealer total shown */
  let dealerTotal = 0;
  if (playing){
    dealerTotal = roundFinished
      ? calculateHandValue(dealerHand)
      : calculateHandValue([dealerHand[0]]);
  }

  return (
    <div className="table-container">

      {/* NAV */}
      <button className="common-button back-button" onClick={onBack}>Menu</button>
      {roundFinished && !gameOver && (
        <button className="common-button new-round-button" onClick={handleNewRound}>
          New Round
        </button>
      )}
      <h1 className="title-banner">Blackjack – Multiplayer</h1>

      {/* LOBBY WAITING ----------------------------------------- */}
      {!lobbyJoined && <p className="turn-message">Waiting in lobby…</p>}

      {/* BALANCE / BET ----------------------------------------- */}
      <div className="balance-section">
        <div>Balance: ${balance}</div>
        <div>Current Bet: ${bet}</div>
      </div>

      {/* DEALER ------------------------------------------------- */}
      {playing &&
        <div className="dealer-area">
          <h2>Dealer – {dealerTotal}</h2>
          <div className="hand-display">
            {dealerHand.map((c,i)=>(
              <img key={i}
                   src={ roundFinished || i===0 ? getCardImage(c) : getCardImage(null)}
                   className="card-image"
                   alt={`Dealer card ${i}`} />
            ))}
          </div>
        </div>
      }

      {/* PLAYER ------------------------------------------------- */}
      {playing &&
        <div className="player-area">
          <div className="hand-display">
            {playerHand.map((c,i)=>(
              <img key={i} src={getCardImage(c)} className="card-image" alt={`Player card ${i}`} />
            ))}
          </div>
          <h2>{username} – {calculateHandValue(playerHand)}</h2>
        </div>
      }

      {/* ACTION CONTROLS --------------------------------------- */}
      {lobbyJoined && !roundFinished && !gameOver && (
        showActions ? (
          <div className="action-buttons">
            <button className="common-button" onClick={handleHit}>Hit</button>
            <button className="common-button" onClick={handleStand}>Stand</button>
            {canDouble && <button className="common-button" onClick={handleDouble}>Double</button>}
          </div>
        ) : (
          !playing && /* betting‑only before first deal */
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
        )
      )}

      {/* MESSAGES (end‑of‑round etc.) */}
      {playerMessage && <p className="player-message">{playerMessage}</p>}

      {/* GAME‑OVER --------------------------------------------- */}
      {gameOver &&
        <div className="game-over">
          <h2>Game Over!</h2>
          <button className="common-button" onClick={onBack}>Back to Menu</button>
        </div>
      }
    </div>
  );
}
