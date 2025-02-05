/**
 * FILE: App.jsx
 * LOCATION: ~/Downloads/blackjack/client/src/App.jsx
 */

import React, { useState } from 'react';
import './styles.css';

function App() {
  // Basic game states
  const [message, setMessage] = useState('');
  const [playerHands, setPlayerHands] = useState([[]]); // supports multiple hands
  const [dealerHand, setDealerHand] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  // Betting states
  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [splitOccurred, setSplitOccurred] = useState(false);

  // Which hand is currently playing (0 or 1 if split)
  const [activeHandIndex, setActiveHandIndex] = useState(0);

  // Chip Selection
  const chipValues = [5, 10, 25, 50, 100];

  /**
   * (1) Update balance dynamically when clicking chips
   */
  const handleAddChip = (value) => {
    // Check if user has enough balance
    if (balance - value < 0) {
      alert('Not enough balance to add this chip.');
      return;
    }
    // Subtract chip value immediately from balance
    setBalance((prev) => prev - value);
    // Add to current bet
    setCurrentBet((prev) => prev + value);
  };

  /**
   * (2) Clear bet => add back to balance
   */
  const handleClearBet = () => {
    if (currentBet > 0) {
      setBalance((prev) => prev + currentBet);
      setCurrentBet(0);
    }
  };

  /**
   * Place Bet & Deal => call /start with bet
   */
  const handlePlaceBet = async () => {
    if (currentBet <= 0) {
      alert('Please place a bet before starting.');
      return;
    }
    if (currentBet > balance + currentBet) {
      // If you artificially manipulated something, this check is extra
      alert('Bet cannot exceed your current balance.');
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
      console.log("Start response:", data);

      setMessage(data.message);
      setPlayerHands([data.playerHand]); // single hand
      setDealerHand(data.dealerHand);
      setGameOver(false);
      setSplitOccurred(false);
      setActiveHandIndex(0);

      // Update local balance from server data (in case there's a mismatch)
      setBalance(data.balance);
    } catch (error) {
      console.error('Error placing bet or starting:', error);
    }
  };

  /**
   * Hit => /hit with { handIndex }
   */
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

      // Update the current hand
      const updatedHands = [...playerHands];
      updatedHands[activeHandIndex] = data.playerHands[activeHandIndex];
      setPlayerHands(updatedHands);

    } catch (error) {
      console.error('Error hitting:', error);
    }
  };

  /**
   * Stand => /stand
   */
  const handleStand = async () => {
    try {
      // If we have split and are on the first hand,
      // move to second hand before calling stand on the server
      // In real Blackjack, you might stand each hand separately
      if (splitOccurred && activeHandIndex === 0) {
        setActiveHandIndex(1);
        return;
      }

      const response = await fetch('http://127.0.0.1:3001/stand', {
        method: 'POST',
      });
      const data = await response.json();
      setMessage(data.message);
      setGameOver(data.gameOver);

      setPlayerHands(data.playerHands);
      setDealerHand(data.dealerHand);

      // If the player wins, add winnings
      if (data.outcome === 'player-win') {
        setBalance((prev) => prev + currentBet * 2);
      }
      // Tie => refund
      else if (data.outcome === 'tie') {
        setBalance((prev) => prev + currentBet);
      }
    } catch (error) {
      console.error('Error standing:', error);
    }
  };

  /**
   * Double => /double with { handIndex }
   */
  const handleDouble = async () => {
    // Double bet must not exceed balance
    if (balance < currentBet) {
      alert('Not enough balance to double down.');
      return;
    }

    // Immediately deduct that extra bet
    setBalance((prev) => prev - currentBet);
    // currentBet doubles
    setCurrentBet((prev) => prev + currentBet);

    try {
      const response = await fetch('http://127.0.0.1:3001/double', {
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
      if (data.dealerHand) {
        setDealerHand(data.dealerHand);
      }
      if (data.outcome === 'player-win') {
        // Now the bet is doubled, so winnings = currentBet * 2
        setBalance((prev) => prev + currentBet * 2);
      } else if (data.outcome === 'tie') {
        // Return the entire bet
        setBalance((prev) => prev + currentBet);
      } else {
        // No changes for a normal lose
      }
    } catch (error) {
      console.error('Error doubling:', error);
    }
  };

  /**
   * Split => /split
   */
  const handleSplit = async () => {
    // Splitting requires an additional bet = currentBet
    if (balance < currentBet) {
      alert('Not enough balance to split.');
      return;
    }

    // Deduct new bet
    setBalance((prev) => prev - currentBet);
    setCurrentBet((prev) => prev + currentBet);

    try {
      const response = await fetch('http://127.0.0.1:3001/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setMessage(data.message);
      setGameOver(data.gameOver);
      setSplitOccurred(true);

      if (data.playerHands) {
        setPlayerHands(data.playerHands);
      }
      if (data.dealerHand) {
        setDealerHand(data.dealerHand);
      }
    } catch (error) {
      console.error('Error splitting:', error);
    }
  };

  /**
   * (7) Continue Playing After Round Ends
   * Show a "New Round" button => reset local states & allow new bet
   */
  const handleNewRound = () => {
    // Reset front-end states so user can place a new bet
    setPlayerHands([[]]);
    setDealerHand([]);
    setGameOver(false);
    setMessage('');
    setCurrentBet(0);
    setSplitOccurred(false);
    setActiveHandIndex(0);
  };

  /**
   * Check if we can show the Split button on the UI
   * - Must not have split yet
   * - Only 1 hand so far
   * - That hand has exactly 2 cards
   * - The 2 cards have the same rank
   */
  const canSplit = () => {
    if (splitOccurred) return false;
    if (playerHands.length !== 1) return false;
    if (playerHands[0].length !== 2) return false;

    const [c1, c2] = playerHands[0];
    return c1.rank === c2.rank;
  };

  // RENDER UI
  return (
    <div className="container">
      <h1>Blackjack</h1>

      <p>Balance: ${balance}</p>
      <p>Current Bet: ${currentBet}</p>
      <p>{message}</p>

      {/* 
        (3) Hide chip container once cards are dealt 
        => i.e. if playerHands[0].length > 0, the game is in progress
      */}
      {playerHands[0].length === 0 && !gameOver && (
        <div className="chips-container">
          {chipValues.map((chip) => (
            <button key={chip} onClick={() => handleAddChip(chip)}>
              ${chip}
            </button>
          ))}
          <button onClick={handleClearBet}>Clear Bet</button>
        </div>
      )}

      {/* 
        Show "Place Bet & Deal" if no cards have been dealt 
        and the game is not over 
      */}
      {playerHands[0].length === 0 && !gameOver && (
        <button onClick={handlePlaceBet}>Place Bet & Deal</button>
      )}

      {/* 
        If the game is in progress (cards dealt & not over) => Show actions 
      */}
      {!gameOver && playerHands[0].length > 0 && (
        <>
          <button onClick={handleHit}>Hit</button>
          <button onClick={handleStand}>Stand</button>
          <button onClick={handleDouble}>Double</button>
          {canSplit() && (
            <button onClick={handleSplit}>Split</button>
          )}
        </>
      )}

      {/* 
        (7) If the gameOver is true => "New Round" button 
      */}
      {gameOver && (
        <button onClick={handleNewRound}>New Round</button>
      )}

      {/* Player Hands */}
      {playerHands.map((hand, hIndex) => (
        <div className="hand-container" key={hIndex}>
          <h2>
            Player Hand {hIndex + 1}
            {hIndex === activeHandIndex && !gameOver ? ' (Active)' : ''}
          </h2>
          {hand.map((card, cIndex) => (
            <img
              key={cIndex}
              src={getCardImage(card)} 
              alt={`${card.rank} of ${card.suit}`}
              className="card-image"
            />
          ))}
        </div>
      ))}

      {/* Dealer Hand */}
      <div className="hand-container">
        <h2>Dealer Hand:</h2>
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
  );
}

/** 
 * Fix #4: Face cards & Ace images
 * Make sure your images exist in /src/assets/playing_cards
 * Examples: 
 *   2_of_spades.png
 *   jack_of_hearts.png
 *   ace_of_diamonds.png
 *   king_of_clubs.png
 *   card_back.png
 */
function getCardImage(card) {
  if (card.rank === 'Hidden') {
    return '/src/assets/playing_cards/card_back.png';
  }

  const rankMap = {
    A: 'ace',
    K: 'king',
    Q: 'queen',
    J: 'jack',
    10: '10',
    9: '9',
    8: '8',
    7: '7',
    6: '6',
    5: '5',
    4: '4',
    3: '3',
    2: '2',
  };
  const suitMap = {
    Spades: 'spades',
    Hearts: 'hearts',
    Clubs: 'clubs',
    Diamonds: 'diamonds',
  };

  const rankStr = rankMap[card.rank] || card.rank.toLowerCase();
  const suitStr = suitMap[card.suit] || card.suit.toLowerCase();

  // Example file name: "jack_of_hearts.png"
  return `/src/assets/playing_cards/${rankStr}_of_${suitStr}.png`;
}

export default App;
