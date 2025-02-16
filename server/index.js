/**
 * FILE: index.js
 * LOCATION: ~/Downloads/blackjack/server/index.js
 */
const express = require('express');
const cors = require('cors');
const { createDeck, shuffleDeck, calculateHandValue } = require('./gameLogic');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// Keep track of seats
let seats = [];
let gameStarted = false;
let currentTurnSeat = 0;

function broadcastTableState() {
  io.emit('tableState', {
    players: seats.map(s => ({
      username: s.username,
      seatIndex: s.seatIndex,
      isReady: s.isReady,
      isTurn: s.isTurn,
    })),
    gameStarted,
    currentTurnSeat,
    message: gameStarted
      ? `Game in progress. It's ${seats.find(s=>s.seatIndex===currentTurnSeat)?.username}'s turn`
      : 'Waiting in the lobby...',
  });
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinTable', (data) => {
    console.log('[Server] joinTable event received:', data);
    const { username } = data;
    if (!username) {
      socket.emit('joinError', 'Username is required');
      return;
    }
    if (seats.some(p => p.username.toLowerCase() === username.toLowerCase())) {
      socket.emit('joinError', 'Username is already taken');
      return;
    }
    if (seats.length >= 5) {
      socket.emit('joinError', 'Table is full (max 5 seats)');
      return;
    }

    const seatIndex = seats.length;
    seats.push({
      username,
      seatIndex,
      socketID: socket.id,
      isReady: false,
      isTurn: false,
    });

    broadcastTableState();

    socket.emit('joinSuccess', {
      players: seats,
      seatIndex,
      gameStarted,
    });
  });

  socket.on('playerReady', () => {
    const seat = seats.find(s => s.socketID === socket.id);
    if (!seat) return;
    seat.isReady = true;
    broadcastTableState();
  });

  socket.on('startGame', () => {
    const hostSeat = seats.find(s => s.seatIndex === 0);
    if (!hostSeat || hostSeat.socketID !== socket.id) {
      console.log('[Server] Non-host tried startGame or seat 0 not found');
      return;
    }
    console.log('[Server] Host is starting the game...');
    const allReady = seats.every(s => s.isReady);
    if (!allReady) {
      console.log('[Server] Not all players are ready, ignoring startGame');
      return;
    }
    gameStarted = true;
    currentTurnSeat = 0;
    seats.forEach(s => s.isTurn = false);
    if (seats[0]) seats[0].isTurn = true;
    broadcastTableState();
  });

  socket.on('disconnect', () => {
    seats = seats.filter(s => s.socketID !== socket.id);
    if (seats.length === 0) {
      gameStarted = false;
      currentTurnSeat = 0;
    }
    broadcastTableState();
    console.log('Client disconnected:', socket.id);
  });
});

/** Single-player logic below unchanged */
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
  }
}
function checkForBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

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

server.listen(PORT, '0.0.0.0', () => {  // Bind to all interfaces
  console.log(`Server + Socket.IO running on port ${PORT}`);
});