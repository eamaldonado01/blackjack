// SinglePlayerGame.jsx – REST‑only blackjack (no sockets)
// path: blackback/client/src/SinglePlayerGame.jsx
import React, { useState } from 'react';
import './styles.css';

const SERVER_PORT = 3001;
const host = window.location.hostname;
const SERVER_IP = `${host}:${SERVER_PORT}`;

function getCardImage(card) {
  if (!card || card.rank === 'Hidden') return '/src/assets/playing_cards/card_back.png';
  const rankMap = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', 10: '10', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  const suitMap = { Spades: 'spades', Hearts: 'hearts', Clubs: 'clubs', Diamonds: 'diamonds' };
  const rankStr = rankMap[card.rank] || card.rank;
  const suitStr = suitMap[card.suit] || card.suit.toLowerCase();
  return `/src/assets/playing_cards/${rankStr}_of_${suitStr}.png`;
}

function calculateHandTotal(cards = []) {
  let total = 0, ace = 0;
  cards.forEach(c => {
    if (!c || c.rank === 'Hidden') return;
    if (c.rank === 'A' || c.rank === 'Ace') { ace++; total += 1; }
    else if (['K', 'Q', 'J', 'King', 'Queen', 'Jack'].includes(c.rank)) total += 10;
    else total += Number(c.rank) || 0;
  });
  while (ace > 0 && total + 10 <= 21) { total += 10; ace--; }
  return total;
}

export default function SinglePlayerGame({ onBack }) {
  // basic state
  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [message, setMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);

  const chipValues = [5, 10, 25, 50, 100];

  const addChip = (val) => {
    if (balance < val) return alert('Not enough balance');
    setBalance(b => b - val);
    setCurrentBet(b => b + val);
  };
  const clearBet = () => {
    setBalance(b => b + currentBet);
    setCurrentBet(0);
  };

  async function startRound() {
    if (currentBet <= 0) return alert('Place a bet first');
    const resp = await fetch(`http://${SERVER_IP}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bet: currentBet })
    });
    const data = await resp.json();
    setPlayerHand(data.playerHand);
    setDealerHand(data.dealerHand);
    setBalance(data.balance);
    setMessage(data.message);
    setGameOver(data.message.includes('Blackjack'));
  }

  async function hit() {
    if (gameOver) return;
    const resp = await fetch(`http://${SERVER_IP}/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handIndex: 0 }) });
    const data = await resp.json();
    setPlayerHand(data.playerHands[0]);
    setMessage(data.message);
    setGameOver(data.gameOver);
  }

  async function stand() {
    if (gameOver) return;
    const resp = await fetch(`http://${SERVER_IP}/stand`, { method: 'POST' });
    const data = await resp.json();
    setDealerHand(data.dealerHand);
    setMessage(data.message);
    setBalance(data.balance);
    setGameOver(true);
  }

  return (
    <div className="table-container">
      <button className="common-button" style={{ position:'absolute', left:10, top:10 }} onClick={onBack}>↩ Menu</button>
      <h1 className="title-banner">Blackjack – Single Player</h1>
      <div className="balance-section">
        <button className="common-button" disabled>Balance: ${balance}</button>
        <button className="common-button" disabled>Current Bet: ${currentBet}</button>
      </div>

      {/* Dealer */}
      <h2>Dealer</h2>
      <div className="hand-display">
        {dealerHand.map((c,i)=>(<img key={i} src={getCardImage(c)} className="card-image"/>))}
      </div>

      {/* Player */}
      <h2>Player – Total {calculateHandTotal(playerHand)}</h2>
      <div className="hand-display">
        {playerHand.map((c,i)=>(<img key={i} src={getCardImage(c)} className="card-image"/>))}
      </div>

      <p style={{ marginTop:'1rem' }}>{message}</p>

      {!playerHand.length && (
        <>
          <div className="chips-row">
            {chipValues.map(v=> (
              <img key={v} src={`/src/assets/chips/${v}.png`} alt={`$${v}`} className="chip-image" onClick={()=>addChip(v)}/>
            ))}
          </div>
          {currentBet>0 && (
            <div className="bet-actions">
              <button className="common-button" onClick={clearBet}>Clear</button>
              <button className="common-button" onClick={startRound}>Deal</button>
            </div>
          )}
        </>
      )}

      {playerHand.length>0 && !gameOver && (
        <div className="action-buttons">
          <button className="common-button" onClick={hit}>Hit</button>
          <button className="common-button" onClick={stand}>Stand</button>
        </div>
      )}

      {gameOver && <button className="common-button" onClick={()=>window.location.reload()}>New Game</button>}
    </div>
  );
}
