/**
 * FILE: App.jsx
 * LOCATION: ~/Downloads/blackjack/client/src/App.jsx
 */

import React, { useState } from 'react';
import './styles.css';

function App() {
  const [message, setMessage] = useState('');
  const [playerHands, setPlayerHands] = useState([[]]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [splitOccurred, setSplitOccurred] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const [activeHandIndex, setActiveHandIndex] = useState(0);

  // Chip Data
  const chipData = [
    { value: 5,   img: '/src/assets/chips/5.png' },
    { value: 10,  img: '/src/assets/chips/10.png' },
    { value: 25,  img: '/src/assets/chips/25.png' },
    { value: 50,  img: '/src/assets/chips/50.png' },
    { value: 100, img: '/src/assets/chips/100.png' },
  ];

  // ------------------- Betting Functions -------------------
  const handleAddChip = (chipValue) => {
    if (balance < chipValue) {
      alert('Not enough balance to add this chip.');
      return;
    }
    setBalance((prev) => prev - chipValue);
    setCurrentBet((prev) => prev + chipValue);
  };

  const handleClearBet = () => {
    setBalance((prev) => prev + currentBet);
    setCurrentBet(0);
  };

  // Start round => /start
  const handlePlaceBet = async () => {
    if (currentBet <= 0) {
      alert('Please place a bet before starting.');
      return;
    }
    try {
      const response = await fetch('http://127.0.0.1:3001/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: currentBet }),
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const data = await response.json();
      setMessage(data.message);
      setPlayerHands([data.playerHand]);
      setDealerHand(data.dealerHand);
      setGameOver(false);
      setSplitOccurred(false);
      setActiveHandIndex(0);
      setBalance(data.balance);

      // Round has begun
      setBetPlaced(true);
    } catch (error) {
      console.error('Error placing bet or starting:', error);
    }
  };

  // New round => local state reset
  const handleNewRound = () => {
    setMessage('');
    setPlayerHands([[]]);
    setDealerHand([]);
    setGameOver(false);
    setCurrentBet(0);
    setSplitOccurred(false);
    setActiveHandIndex(0);
    setBetPlaced(false);
  };

  // ------------------- Game Actions: Hit/Stand/Double -------------------
  const handleHit = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3001/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: activeHandIndex }),
      });
      const data = await response.json();

      setMessage(data.message);
      setGameOver(data.gameOver);
      if (data.playerHands) {
        setPlayerHands(data.playerHands);
      }
    } catch (error) {
      console.error('Error hitting:', error);
    }
  };

  const handleStand = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3001/stand', {
        method: 'POST',
      });
      const data = await response.json();

      setMessage(data.message);
      setGameOver(data.gameOver);
      if (data.playerHands) setPlayerHands(data.playerHands);
      if (data.dealerHand) setDealerHand(data.dealerHand);

      setBalance(data.balance);
    } catch (error) {
      console.error('Error standing:', error);
    }
  };

  const handleDouble = async () => {
    if (balance < currentBet) {
      alert('Not enough balance to double down.');
      return;
    }

    setBalance((prev) => prev - currentBet);
    setCurrentBet((prev) => prev * 2);

    try {
      const response = await fetch('http://127.0.0.1:3001/double', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: activeHandIndex }),
      });
      const data = await response.json();

      setMessage(data.message);
      setGameOver(data.gameOver);
      if (data.playerHands) setPlayerHands(data.playerHands);
      if (data.dealerHand) setDealerHand(data.dealerHand);

      setBalance(data.balance);
    } catch (error) {
      console.error('Error doubling:', error);
    }
  };

  // Condition to show Dealer/Player hands only after dealing
  const showHands = betPlaced && !gameOver && playerHands[0].length > 0;

  return (
    <div className="table-container">
      {/* Large Title at the Top for the initial screen */}
      {!betPlaced && !gameOver && (
        <h1 className="title-banner">Blackjack</h1>
      )}

      {/* Balance & Bet Buttons (top-right) */}
      <div className="balance-section">
        <button className="common-button" disabled>
          Balance: ${balance}
        </button>
        <button className="common-button" disabled>
          Current Bet: ${currentBet}
        </button>
      </div>

      {/* Lower message area - closer to chips */}
      <div className="message-display">
        {/* “Place Your Bet” if no bet yet */}
        {!betPlaced && !gameOver && <h2>Place Your Bet</h2>}
        <p>{message}</p>
      </div>

      {/* Chips row if we haven't placed the bet */}
      {!betPlaced && !gameOver && (
        <div className="chips-row">
          {chipData.map((chip) => (
            <img
              key={chip.value}
              src={chip.img}
              alt={`$${chip.value} chip`}
              className="chip-image"
              onClick={() => handleAddChip(chip.value)}
            />
          ))}
        </div>
      )}

      {/* Clear & Deal if bet > 0 and not placed */}
      {currentBet > 0 && !betPlaced && !gameOver && (
        <div className="bet-actions">
          <button className="common-button" onClick={handleClearBet}>Clear</button>
          <button className="common-button" onClick={handlePlaceBet}>Deal</button>
        </div>
      )}

      {/* Dealer’s Hand only after bet placed */}
      {betPlaced && (
        <div className="dealer-area">
          <h2>Dealer's Hand</h2>
          <div className="hand-display">
            {dealerHand.map((card, index) => (
              <img
                key={index}
                src={getCardImage(card)}
                alt={`${card.rank} of ${card.suit}`}
                className="card-image"
              />
            ))}
          </div>
        </div>
      )}

      {/* Player’s Hand only after bet placed */}
      {betPlaced && (
        <div className="player-area">
          <div className="player-hand-container">
            <h2>Player's Hand</h2>
            <div className="hand-display">
              {playerHands[0].map((card, cIndex) => (
                <img
                  key={cIndex}
                  src={getCardImage(card)}
                  alt={`${card.rank} of ${card.suit}`}
                  className="card-image"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons => Center-left, vertical gap, only if game not over and bet is placed */}
      {!gameOver && betPlaced && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
          <button className="common-button" onClick={handleDouble}>Double</button>
        </div>
      )}

      {/* New Round after game is over */}
      {gameOver && (
        <button onClick={handleNewRound} className="common-button new-round-button">
          New Round
        </button>
      )}
    </div>
  );
}

// Format card image filenames
function getCardImage(card) {
  if (card.rank === 'Hidden') {
    return '/src/assets/playing_cards/card_back.png';
  }
  const rankMap = {
    A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack',
    10: '10', 9: '9', 8: '8', 7: '7',
    6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
  };
  const suitMap = {
    Spades: 'spades',
    Hearts: 'hearts',
    Clubs: 'clubs',
    Diamonds: 'diamonds',
  };
  const rankStr = rankMap[card.rank] || card.rank;
  const suitStr = suitMap[card.suit] || card.suit.toLowerCase();

  return `/src/assets/playing_cards/${rankStr}_of_${suitStr}.png`;
}

export default App;
