/**
 * FILE: App.jsx
 * LOCATION: ~/Downloads/blackjack/client/src/App.jsx
 */

import React, { useState } from 'react';
import './styles.css';

// A helper to calculate the local player's hand value
// We'll use it to decide if Double is allowed (9,10,11 without an Ace)
function getLocalHandValue(cards) {
  // Minimal calculation for local reference
  // This is separate from the server's official logic
  let total = 0;
  let aceCount = 0;
  for (let card of cards) {
    if (card.rank === 'Hidden') continue; // ignore hidden card
    switch (card.rank) {
      case 'A':
      case 'Ace':
        aceCount += 1;
        total += 1; // treat Ace as 1 initially
        break;
      case 'K':
      case 'King':
      case 'Q':
      case 'Queen':
      case 'J':
      case 'Jack':
        total += 10;
        break;
      default:
        total += Number(card.rank) || 0;
        break;
    }
  }
  // Convert Aces from 1 to 11 if it doesn't bust
  while (aceCount > 0) {
    if (total + 10 <= 21) {
      total += 10;
    }
    aceCount -= 1;
  }
  return total;
}

// A helper to see if the local hand has an Ace
function localHandHasAce(cards) {
  for (let card of cards) {
    if (card.rank === 'A' || card.rank === 'Ace') {
      return true;
    }
  }
  return false;
}

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

      // If the server says "Blackjack! Player wins!"
      if (data.message.includes('Blackjack! Player wins!')) {
        setGameOver(true);
      } else {
        setGameOver(false);
      }

      setMessage(data.message);
      setPlayerHands([data.playerHand]);
      setDealerHand(data.dealerHand);
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

  /**
   * Only allow Double if:
   *  - The local hand total is 9, 10, or 11
   *  - No Ace in that hand
   *  - Enough balance to double
   *  - Not game over, bet placed, etc.
   */
  const canDouble = () => {
    if (!betPlaced || gameOver) return false;
    // Check local player's active hand
    const activeHand = playerHands[activeHandIndex] || [];
    const total = getLocalHandValue(activeHand);

    // Must be exactly 9,10, or 11
    if (![9,10,11].includes(total)) return false;
    // Must NOT have an Ace
    if (localHandHasAce(activeHand)) return false;
    // Must have enough balance to double
    if (balance < currentBet) return false;

    return true;
  };

  const handleDouble = async () => {
    if (!canDouble()) {
      alert('You cannot double at this time.');
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

  // If immediate Blackjack => hide the action buttons
  const isBlackjackWin = message.includes('Blackjack! Player wins!');

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

      {/* 
        Action Buttons => 
        Hide them if the game is over or immediate Blackjack
      */}
      {!gameOver && betPlaced && !isBlackjackWin && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>

          {/* Only show Double if canDouble() is true */}
          {canDouble() && (
            <button className="common-button" onClick={handleDouble}>Double</button>
          )}
        </div>
      )}

      {/* New Round after game is over or immediate blackjack */}
      {(gameOver || isBlackjackWin) && (
        <button onClick={handleNewRound} className="common-button new-round-button">
          New Round
        </button>
      )}
    </div>
  );
}

/**
 * getCardImage: Return image path for a given card
 */
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

/**
 * Test Cases for Currency & Splits (examples):
 * 1) Bet 50, then Clear => Check that balance = 300 again, currentBet=0
 * 2) Bet 50 again, then Deal => Check that balance=250 after dealing
 * 3) If immediate Blackjack => confirm only "New Round" is visible, gameOver=true
 * 4) Bet 25, then 25 => total 50, then Clear => balance back=300, bet=0
 * 5) Bet 10, then Deal => if user hits or stands, ensure the final balance updates
 * 6) Splitting scenario => if first 2 cards have same rank => "split" => bet doubles,
 *    check final outcome for each split hand
 */

/**
 * FILE: index.js
 * 
 * No changes needed for Double logic (9,10,11 rule),
 * we handle it in the client by limiting the button. 
 * The rest remains the same as your current code.
 */
