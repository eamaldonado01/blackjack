/**
 * FILE: index.js
 * LOCATION: ~/Downloads/blackjack/server/index.js
 */

const express = require('express');
const cors = require('cors');
const { createDeck, shuffleDeck, calculateHandValue } = require('./gameLogic');

const http = require('http');   // For server
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

// We'll store seats for a single table, up to 5 seats
let seats = []; // array of { username, seatIndex }
// username must be unique, seatIndex from 0 to 4

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Player tries to join the table
  socket.on('joinTable', (data, ack) => {
    const { username } = data;
    if (!username) {
      socket.emit('joinError', 'Username is required');
      return;
    }
    // Check if username is already taken
    if (seats.find(p => p.username.toLowerCase() === username.toLowerCase())) {
      socket.emit('joinError', 'Username is already taken');
      return;
    }
    // Check if table is full
    if (seats.length >= 5) {
      socket.emit('joinError', 'Table is full (max 5 seats)');
      return;
    }
    // Add the user
    const seatIndex = seats.length; // next seat
    seats.push({ username, seatIndex, socketID: socket.id });
    
    // Broadcast updated seat info
    io.emit('tableState', { 
      players: seats.map(({username, seatIndex}) => ({ username, seatIndex })),
      message: `Welcome ${username} to seat ${seatIndex + 1}`
    });
    // Let the joiner know they're successful
    socket.emit('joinSuccess', {
      players: seats.map(({username, seatIndex}) => ({ username, seatIndex })),
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // remove from seats
    seats = seats.filter(p => p.socketID !== socket.id);
    // broadcast update
    io.emit('tableState', {
      players: seats.map(({username, seatIndex}) => ({ username, seatIndex })),
      message: 'A player left the table.'
    });
  });
});

// Single-player game logic re-using your existing code
// For demonstration, we keep them so your single-player approach still works:
let gameState = {
  deck: [],
  playerHands: [[]],
  dealerHand: [],
  gameOver: false,
  message: '',
  bet: 0,
  balance: 300,
  currentHandIndex: 0,
  splitOccurred: false,
};

function resetGameStateIfNeeded() {
  if (gameState.gameOver || gameState.playerHands[0].length === 0) {
    gameState.deck = [];
    gameState.playerHands = [[]];
    gameState.dealerHand = [];
    gameState.gameOver = false;
    gameState.message = '';
    gameState.bet = 0;
    gameState.currentHandIndex = 0;
    gameState.splitOccurred = false;
    // Keep balance
  }
}
function checkForBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

// Reuse your existing routes
const router = express.Router();

router.post('/start', (req, res) => {
  const { bet } = req.body;
  resetGameStateIfNeeded();

  if (bet > gameState.balance) {
    return res.status(400).json({ message: 'Insufficient balance for this bet.' });
  }
  if (bet <= 0) {
    return res.status(400).json({ message: 'Bet must be greater than 0.' });
  }

  let deck = createDeck();
  deck = shuffleDeck(deck);

  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  gameState.deck = deck;
  gameState.playerHands = [playerHand];
  gameState.dealerHand = dealerHand;
  gameState.gameOver = false;
  gameState.bet = bet;
  gameState.balance -= bet;

  const playerValue = calculateHandValue(playerHand);
  let message = `Dealer shows: ${dealerHand[0].rank} of ${dealerHand[0].suit}`;

  if (checkForBlackjack(playerHand)) {
    const blackjackWin = Math.round(gameState.bet * 2.5);
    gameState.balance += blackjackWin;
    gameState.gameOver = true;
    message = 'Blackjack! Player wins!';
  } else {
    message = `Player: ${playerValue}, ` + message;
  }
  gameState.message = message;

  return res.json({
    message: gameState.message,
    playerHand,
    dealerHand: [dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
    balance: gameState.balance,
  });
});

router.post('/hit', (req, res) => {
  const { handIndex } = req.body;
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.', gameOver: true });
  }
  if (checkForBlackjack(gameState.playerHands[handIndex])) {
    return res.json({ message: 'Blackjack already!', gameOver: true });
  }
  const newCard = gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const value = calculateHandValue(gameState.playerHands[handIndex]);
  if (value > 21) {
    gameState.message = 'Player busts!';
    gameState.gameOver = true;
  } else {
    gameState.message = `Player now has ${value}.`;
  }

  return res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    playerHands: gameState.playerHands,
    dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
  });
});

router.post('/stand', (req, res) => {
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.', gameOver: true });
  }
  if (checkForBlackjack(gameState.playerHands[0])) {
    return res.json({
      message: 'You already have Blackjack!',
      gameOver: true,
      balance: gameState.balance,
    });
  }
  let dealerValue = calculateHandValue(gameState.dealerHand);
  while (dealerValue < 17) {
    gameState.dealerHand.push(gameState.deck.pop());
    dealerValue = calculateHandValue(gameState.dealerHand);
  }
  let outcome = 'dealer-win';
  let finalMessage = '';

  const pVal = calculateHandValue(gameState.playerHands[0]);
  if (pVal > 21) {
    finalMessage = 'Player busts!';
  } else if (dealerValue > 21 || pVal > dealerValue) {
    outcome = 'player-win';
    finalMessage = 'Player wins!';
  } else if (pVal === dealerValue) {
    outcome = 'tie';
    finalMessage = 'Tie!';
  } else {
    finalMessage = 'Dealer wins!';
  }

  gameState.gameOver = true;
  gameState.message = finalMessage;

  if (outcome === 'player-win') {
    gameState.balance += gameState.bet * 2;
  } else if (outcome === 'tie') {
    gameState.balance += gameState.bet;
  }

  return res.json({
    message: gameState.message,
    gameOver: true,
    outcome,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: gameState.dealerHand,
  });
});

router.post('/double', (req, res) => {
  const { handIndex } = req.body;
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }
  if (checkForBlackjack(gameState.playerHands[handIndex])) {
    return res.json({ message: 'Cannot double after Blackjack!', gameOver: true });
  }
  if (gameState.balance < gameState.bet) {
    return res.json({ message: 'Insufficient balance to double down.' });
  }

  gameState.balance -= gameState.bet;
  gameState.bet *= 2;

  const newCard = gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const value = calculateHandValue(gameState.playerHands[handIndex]);
  if (value > 21) {
    gameState.message = 'Player busts after Double!';
    gameState.gameOver = true;
    return res.json({
      message: gameState.message,
      gameOver: true,
      balance: gameState.balance,
      playerHands: gameState.playerHands,
      dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
    });
  }

  // If not busted, stand
  req.url = '/stand'; 
  req.method = 'POST';
  app._router.handle(req, res);
});

router.post('/split', (req, res) => {
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }
  if (gameState.splitOccurred || gameState.playerHands.length !== 1) {
    return res.json({ message: 'Split not allowed.' });
  }

  const [hand] = gameState.playerHands;
  if (hand.length !== 2 || hand[0].rank !== hand[1].rank) {
    return res.json({ message: 'Cannot split unless both cards have the same rank.' });
  }
  if (gameState.balance < gameState.bet) {
    return res.json({ message: 'Insufficient balance to split.' });
  }

  gameState.balance -= gameState.bet;
  gameState.bet *= 2;

  const newHand1 = [hand[0]];
  const newHand2 = [hand[1]];
  gameState.playerHands = [newHand1, newHand2];
  gameState.splitOccurred = true;
  gameState.message = 'You split your cards!';

  return res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
  });
});

app.use('/', router);

// Start the server with Socket.IO
server.listen(PORT, () => {
  console.log(`Server + Socket.IO running on port ${PORT}`);
});

/**
 * Explanation:
 * 1) We added Socket.IO:
 *    const server = http.createServer(app);
 *    const io = new Server(server, { ... });
 * 2) We store up to 5 seats in an array 'seats'. Each seat is { username, seatIndex, socketID }.
 * 3) In 'joinTable' we ensure a unique username, limit seats to 5, broadcast seat info.
 * 4) The single-player endpoints (/start, /hit, /stand, etc.) remain for demonstration, 
 *    but in a true multi-user environment, you'd adapt them to handle multiple players 
 *    and seat logic. 
 */
