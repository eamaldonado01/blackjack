/**
 * FILE: App.jsx
 * LOCATION: ~/Downloads/blackjack/client/src/App.jsx
 */

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './styles.css';

// IP of Computer 1
const SERVER_IP = '192.168.86.220:3001';

// If you'd like to see more logs, set to true
const DEBUG = true;

/** Helper: local compute for double-checking hands (demo only). */
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
    if (total + 10 <= 21) total += 10;
    aceCount--;
  }
  return total;
}
function localHandHasAce(cards) {
  return cards.some((c) => c.rank === 'A' || c.rank === 'Ace');
}

function App() {
  /** ========== Socket & Connection States ========== */
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false); // track if socket connected

  /** ========== Lobby States ========== */
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);

  // The array of players from server: { username, seatIndex, isReady, isTurn }
  const [players, setPlayers] = useState([]);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [host, setHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentTurnSeat, setCurrentTurnSeat] = useState(null);

  /** ========== Single-Player-Like States ========== */
  const [message, setMessage] = useState('');
  const [playerHands, setPlayerHands] = useState([[]]); 
  const [dealerHand, setDealerHand] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [splitOccurred, setSplitOccurred] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false); // did we do "Deal"?

  // Chip data
  const chipData = [
    { value: 5,   img: '/src/assets/chips/5.png' },
    { value: 10,  img: '/src/assets/chips/10.png' },
    { value: 25,  img: '/src/assets/chips/25.png' },
    { value: 50,  img: '/src/assets/chips/50.png' },
    { value: 100, img: '/src/assets/chips/100.png' },
  ];

  /** ========== Socket.io Setup ========== */
  useEffect(() => {
    if (DEBUG) console.log('[App.jsx] Attempting socket.io connection to:', SERVER_IP);
    const newSocket = io(`http://${SERVER_IP}`, {
      transports: ['websocket'],  // Force WebSocket
      reconnectionAttempts: 3,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      if (DEBUG) console.log('[App.jsx] Socket connected:', newSocket.id);
    });
    newSocket.on('connect_error', (err) => {
      setConnected(false);
      console.error('[App.jsx] connect_error:', err);
    });
    newSocket.on('disconnect', () => {
      setConnected(false);
      if (DEBUG) console.log('[App.jsx] Socket disconnected');
    });

    // Listen for tableState
    newSocket.on('tableState', (data) => {
      if (DEBUG) console.log('[App.jsx] tableState received:', data);
      setPlayers(data.players || []);
      setMessage(data.message || '');
      setGameStarted(!!data.gameStarted);
      if (typeof data.currentTurnSeat !== 'undefined') {
        setCurrentTurnSeat(data.currentTurnSeat);
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);
    });

    // joinSuccess => we store seatIndex, set joined
    newSocket.on('joinSuccess', (data) => {
      if (DEBUG) console.log('[App.jsx] joinSuccess:', data);
      setPlayers(data.players || []);
      setMySeatIndex(data.seatIndex);
      setHost(data.seatIndex === 0);
      setJoined(true);
      setGameStarted(!!data.gameStarted);
    });

    newSocket.on('joinError', (errMsg) => {
      alert(errMsg);
    });

    setSocket(newSocket);

    return () => {
      if (DEBUG) console.log('[App.jsx] Cleanup: disconnect socket');
      newSocket.disconnect();
    };
  }, []);

  /** ========== Lobby & Join Logic ========== */
  const handleJoin = () => {
    if (DEBUG) console.log('[App.jsx] handleJoin fired, username=', username);
    if (!socket) {
      console.error('[App.jsx] socket not ready or failed to connect');
      alert('Socket not ready. Is the server running?');
      return;
    }
    if (!connected) {
      console.warn('[App.jsx] socket is not connected, cannot join');
      alert('Not connected to server. Check IP or firewall.');
      return;
    }
    if (!username) {
      alert('Enter a username');
      return;
    }

    // Emit the join event to server
    socket.emit('joinTable', { username }, (ack) => {
      if (DEBUG) console.log('[App.jsx] joinTable callback ack=', ack);
    });
  };

  /** Mark self Ready on server */
  function setReadyOnServer() {
    if (!socket) return;
    socket.emit('playerReady');
  }

  /** Host => startGame */
  function handleHostStartGame() {
    if (!socket || !host) return;
    socket.emit('startGame');
  }

  /** ========== Betting & Single-Player Logic ========== */
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

  // Pressing "Deal" => single-player /start => also mark ourselves ready
  const handlePlaceBet = async () => {
    if (currentBet <= 0) {
      alert('Please place a bet before starting.');
      return;
    }
    try {
      if (DEBUG) console.log('[App.jsx] handlePlaceBet => /start with bet=', currentBet);
      const resp = await fetch(`http://${SERVER_IP}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: currentBet }),
      });
      if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`);

      const data = await resp.json();
      if (DEBUG) console.log('[App.jsx] /start response:', data);
      setMessage(data.message || '');
      if ((data.message || '').includes('Blackjack! Player wins!')) {
        setGameOver(true);
      } else {
        setGameOver(false);
      }

      setPlayerHands([data.playerHand || []]);
      setDealerHand(data.dealerHand || []);
      setSplitOccurred(false);
      setBalance(data.balance || balance);

      setBetPlaced(true); // local "Ready"
      setReadyOnServer(); // inform server
    } catch (err) {
      console.error('Error placing bet:', err);
    }
  };

  const handleNewRound = () => {
    if (DEBUG) console.log('[App.jsx] handleNewRound');
    setMessage('');
    setPlayerHands([[]]);
    setDealerHand([]);
    setGameOver(false);
    setCurrentBet(0);
    setSplitOccurred(false);
    setBetPlaced(false);
  };

  const handleHit = async () => {
    if (DEBUG) console.log('[App.jsx] handleHit => /hit');
    try {
      const resp = await fetch(`http://${SERVER_IP}/hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: 0 }),
      });
      const data = await resp.json();
      if (DEBUG) console.log('[App.jsx] /hit response:', data);
      setMessage(data.message || '');
      setGameOver(data.gameOver || false);
      if (data.playerHands) setPlayerHands(data.playerHands);
    } catch (err) {
      console.error('Error hitting:', err);
    }
  };
  const handleStand = async () => {
    if (DEBUG) console.log('[App.jsx] handleStand => /stand');
    try {
      const resp = await fetch(`http://${SERVER_IP}/stand`, { method: 'POST' });
      const data = await resp.json();
      if (DEBUG) console.log('[App.jsx] /stand response:', data);
      setMessage(data.message || '');
      setGameOver(data.gameOver || false);
      if (data.playerHands) setPlayerHands(data.playerHands);
      if (data.dealerHand) setDealerHand(data.dealerHand);
      setBalance(data.balance || balance);
    } catch (err) {
      console.error('Error standing:', err);
    }
  };

  const canDouble = () => {
    if (!gameStarted || gameOver) return false;
    const total = getLocalHandValue(playerHands[0]);
    if (![9, 10, 11].includes(total)) return false;
    if (localHandHasAce(playerHands[0])) return false;
    if (balance < currentBet) return false;
    return true;
  };
  const handleDouble = async () => {
    if (DEBUG) console.log('[App.jsx] handleDouble => /double');
    if (!canDouble()) {
      alert('Cannot double right now');
      return;
    }
    try {
      setBalance((prev) => prev - currentBet);
      setCurrentBet((prev) => prev * 2);

      const resp = await fetch(`http://${SERVER_IP}/double`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: 0 }),
      });
      const data = await resp.json();
      if (DEBUG) console.log('[App.jsx] /double response:', data);
      setMessage(data.message || '');
      setGameOver(data.gameOver || false);
      if (data.playerHands) setPlayerHands(data.playerHands);
      if (data.dealerHand) setDealerHand(data.dealerHand);
      setBalance(data.balance || balance);
    } catch (err) {
      console.error('Error doubling:', err);
    }
  };

  const isMyTurn = (currentTurnSeat === mySeatIndex) && gameStarted && !gameOver;
  const isBlackjackWin = message.includes('Blackjack! Player wins!');

  /** 1) Username screen if not joined */
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
          {/* Use type="button" to avoid form submission */}
          <button type="button" className="common-button" onClick={handleJoin}>
            Join
          </button>

          {/* Show debug info if desired */}
          {!connected && (
            <p style={{ color: 'red', marginTop: '10px' }}>
              Not connected to server. Is the server running at {SERVER_IP}?
            </p>
          )}
        </div>
      </div>
    );
  }

  /** 2) If game not started => show LOBBY / LOADING SCREEN */
  if (!gameStarted && !gameOver) {
    const allReady = players.length > 0 && players.every((p) => p.isReady);
    // If there's only 1 player => can start if that one is ready
    // If a second player joins => only start if all are ready
    const canHostStart = host && (
      (players.length === 1 && players[0].isReady) 
      || (players.length > 1 && allReady)
    );

    return (
      <div className="table-container">
        <h1 className="title-banner">Blackjack Lobby</h1>

        <div className="balance-section">
          <button className="common-button" disabled>Balance: ${balance}</button>
          <button className="common-button" disabled>Current Bet: ${currentBet}</button>
        </div>

        <div className="lobby-players">
          <h2>Players in Lobby:</h2>
          <ul>
            {players.map((p) => (
              <li key={p.seatIndex}>
                {p.username} {p.isReady ? '(Ready)' : '(Not Ready)'}
              </li>
            ))}
          </ul>
        </div>

        <div className="message-display">
          <p>{message}</p>
        </div>

        {!players.find(p => p.seatIndex === mySeatIndex)?.isReady && (
          <>
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
            {currentBet > 0 && (
              <div className="bet-actions">
                <button className="common-button" onClick={handleClearBet}>Clear</button>
                <button className="common-button" onClick={handlePlaceBet}>Deal (Ready)</button>
              </div>
            )}
          </>
        )}

        {canHostStart && (
          <button className="common-button start-game-button" onClick={handleHostStartGame}>
            Start Game
          </button>
        )}
      </div>
    );
  }

  /** 3) Actual GAME SCREEN if gameStarted = true */
  return (
    <div className="table-container">
      <div className="balance-section">
        <button className="common-button" disabled>Balance: ${balance}</button>
        <button className="common-button" disabled>Current Bet: ${currentBet}</button>
      </div>

      <div className="message-display">
        <p>{message}</p>
        {currentTurnSeat !== null && (
          <h2>It's {players.find(p => p.seatIndex === currentTurnSeat)?.username}'s turn</h2>
        )}
      </div>

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

      {/* Display seats reversed => seat 0 far right, seat N far left */}
      <div className="player-area">
        {[...players].reverse().map((p) => (
          <div 
            key={p.seatIndex} 
            className="player-hand-container seat-block"
          >
            <h2>
              {p.username} {p.seatIndex === mySeatIndex && '(You)'}
              {p.seatIndex === currentTurnSeat && ' (Turn)'}
            </h2>
            {/* For demonstration, we only show actual cards for myself using local single-player approach */}
            {p.seatIndex === mySeatIndex ? (
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
            ) : (
              <div style={{ color: '#ccc' }}>
                Cards hidden or not implemented for other seats
              </div>
            )}
          </div>
        ))}
      </div>

      {isMyTurn && !gameOver && (
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

/** Helper to get correct card image */
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