/**
 * FILE: App.jsx
 * LOCATION: ~/Downloads/blackjack/client/src/App.jsx
 */
import React, { useState } from 'react';
import './styles.css';

// Local helpers from your original code
function getLocalHandValue(cards) {
  let total = 0;
  let aceCount = 0;
  for (let card of cards) {
    if (card.rank === 'Hidden') continue;
    switch (card.rank) {
      case 'A':
      case 'Ace':
        aceCount += 1;
        total += 1;
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
  while (aceCount > 0) {
    if (total + 10 <= 21) {
      total += 10;
    }
    aceCount -= 1;
  }
  return total;
}
function localHandHasAce(cards) {
  return cards.some((c) => c.rank === 'A' || c.rank === 'Ace');
}

function App() {
  // Minimal single-player states
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false); // for demonstration
  // If you want a single-player experience, set joined = true by default.

  const [message, setMessage] = useState('');
  const [playerHands, setPlayerHands] = useState([[]]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [splitOccurred, setSplitOccurred] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const [activeHandIndex, setActiveHandIndex] = useState(0);

  const chipData = [
    { value: 5,   img: '/src/assets/chips/5.png' },
    { value: 10,  img: '/src/assets/chips/10.png' },
    { value: 25,  img: '/src/assets/chips/25.png' },
    { value: 50,  img: '/src/assets/chips/50.png' },
    { value: 100, img: '/src/assets/chips/100.png' },
  ];

  // -- Demo: "username" flow for single player. Set joined to true if you want no prompt.
  const handleJoin = () => {
    if (!username) {
      alert("Please enter a username to continue");
      return;
    }
    setJoined(true); 
  };

  // Betting
  const handleAddChip = (chipValue) => {
    if (balance < chipValue) {
      alert('Not enough balance for this chip.');
      return;
    }
    setBalance((prev) => prev - chipValue);
    setCurrentBet((prev) => prev + chipValue);
  };
  const handleClearBet = () => {
    setBalance((prev) => prev + currentBet);
    setCurrentBet(0);
  };

  // Start (Deal)
  const handlePlaceBet = async () => {
    if (currentBet <= 0) {
      alert('Please place a bet before starting.');
      return;
    }
    try {
      const resp = await fetch('http://127.0.0.1:3001/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: currentBet }),
      });
      if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`);
      const data = await resp.json();

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

      setBetPlaced(true);
    } catch (err) {
      console.error("Error starting round:", err);
    }
  };

  // New Round
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

  // Hit
  const handleHit = async () => {
    try {
      const resp = await fetch('http://127.0.0.1:3001/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: activeHandIndex }),
      });
      const data = await resp.json();
      setMessage(data.message);
      setGameOver(data.gameOver);
      if (data.playerHands) setPlayerHands(data.playerHands);
    } catch (err) {
      console.error("Error hitting:", err);
    }
  };

  // Stand
  const handleStand = async () => {
    try {
      const resp = await fetch('http://127.0.0.1:3001/stand', { method: 'POST' });
      const data = await resp.json();
      setMessage(data.message);
      setGameOver(data.gameOver);
      if (data.playerHands) setPlayerHands(data.playerHands);
      if (data.dealerHand) setDealerHand(data.dealerHand);
      setBalance(data.balance);
    } catch (err) {
      console.error("Error standing:", err);
    }
  };

  // Double
  const canDouble = () => {
    if (!betPlaced || gameOver) return false;
    const activeHand = playerHands[activeHandIndex] || [];
    const total = getLocalHandValue(activeHand);
    if (![9, 10, 11].includes(total)) return false;
    if (localHandHasAce(activeHand)) return false;
    if (balance < currentBet) return false;
    return true;
  };
  const handleDouble = async () => {
    if (!canDouble()) {
      alert('You cannot double at this time.');
      return;
    }
    try {
      setBalance((prev) => prev - currentBet);
      setCurrentBet((prev) => prev * 2);

      const resp = await fetch('http://127.0.0.1:3001/double', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: activeHandIndex }),
      });
      const data = await resp.json();
      setMessage(data.message);
      setGameOver(data.gameOver);
      if (data.playerHands) setPlayerHands(data.playerHands);
      if (data.dealerHand) setDealerHand(data.dealerHand);
      setBalance(data.balance);
    } catch (err) {
      console.error("Error doubling:", err);
    }
  };

  // Hide action buttons if immediate Blackjack
  const isBlackjackWin = message.includes('Blackjack! Player wins!');

  // Render
  if (!joined) {
    return (
      <div className="table-container">
        <div className="join-container">
          <h2>Enter your username:</h2>
          <input
            type="text"
            placeholder="Username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button className="common-button" onClick={handleJoin}>
            Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      {!betPlaced && !gameOver && (
        <h1 className="title-banner">Blackjack</h1>
      )}

      <div className="balance-section">
        <button className="common-button" disabled>
          Balance: ${balance}
        </button>
        <button className="common-button" disabled>
          Current Bet: ${currentBet}
        </button>
      </div>

      <div className="message-display">
        {!betPlaced && !gameOver && <h2>Place Your Bet</h2>}
        <p>{message}</p>
      </div>

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

      {currentBet > 0 && !betPlaced && !gameOver && (
        <div className="bet-actions">
          <button className="common-button" onClick={handleClearBet}>Clear</button>
          <button className="common-button" onClick={handlePlaceBet}>Deal</button>
        </div>
      )}

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

      {!gameOver && betPlaced && !isBlackjackWin && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
          {canDouble() && (
            <button className="common-button" onClick={handleDouble}>Double</button>
          )}
        </div>
      )}

      {(gameOver || isBlackjackWin) && (
        <button onClick={handleNewRound} className="common-button new-round-button">
          New Round
        </button>
      )}
    </div>
  );
}

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
