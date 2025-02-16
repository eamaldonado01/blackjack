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

/** 
 * seats: Array of { 
 *   username, seatIndex, socketID, isReady, isTurn 
 * }
 */
let seats = [];
let gameStarted = false;
let currentTurnSeat = 0;

/** 
 * multiGame: tracks the multi-seat Blackjack state.
 * - dealerHand: the dealer's cards
 * - playerHandsBySeat: { [seatIndex]: Card[] } 
 * - deck: array of card objects
 * - gameOver: bool
 * - message: last message
 */
let multiGame = {
  deck: [],
  dealerHand: [],
  playerHandsBySeat: {}, 
  gameOver: false,
  message: '',
};

/** Broadcast seats, turn info, plus optionally partial game info. */
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

/** Broadcast the full multiBlackjack game state (so clients can see each other’s hands). */
function broadcastMultiBlackjack() {
  io.emit('multiBlackjackUpdate', {
    dealerHand: multiGame.dealerHand,
    playerHandsBySeat: multiGame.playerHandsBySeat,
    gameOver: multiGame.gameOver,
    message: multiGame.message,
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
    // If username already taken
    if (seats.some(p => p.username.toLowerCase() === username.toLowerCase())) {
      socket.emit('joinError', 'Username is already taken');
      return;
    }
    if (seats.length >= 5) {
      socket.emit('joinError', 'Table is full (max 5 seats)');
      return;
    }

    // If seat 0 is free => that seat is host. Otherwise seat 1, 2, etc.
    let seatIndex = 0;
    if (seats.find(s => s.seatIndex===0)) {
      seatIndex = Math.max(0, ...seats.map(s=>s.seatIndex)) + 1;
    }

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
    // Only seatIndex=0 is host
    const hostSeat = seats.find(s => s.seatIndex===0);
    if (!hostSeat || hostSeat.socketID !== socket.id) {
      console.log('[Server] Non-host tried startGame');
      return;
    }

    // Must all be ready
    const allReady = seats.every(s=>s.isReady);
    if (!allReady) {
      console.log('[Server] Not all players are ready => ignoring');
      return;
    }
    gameStarted = true;
    currentTurnSeat = 0;
    seats.forEach(s => s.isTurn=false);
    const seat0 = seats.find(s=>s.seatIndex===0);
    if (seat0) seat0.isTurn = true;

    // Reset multiGame state for multi-seat
    multiGame.deck = shuffleDeck(createDeck());
    multiGame.dealerHand = [];
    multiGame.playerHandsBySeat = {};
    multiGame.gameOver = false;
    multiGame.message = '';

    // Deal 2 cards to each seat
    seats.forEach((s) => {
      const card1 = multiGame.deck.pop();
      const card2 = multiGame.deck.pop();
      multiGame.playerHandsBySeat[s.seatIndex] = [card1, card2];
    });
    // Dealer gets 2
    multiGame.dealerHand = [multiGame.deck.pop(), multiGame.deck.pop()];

    multiGame.message = `Dealer shows: ${multiGame.dealerHand[0].rank} of ${multiGame.dealerHand[0].suit}`;

    broadcastTableState();
    broadcastMultiBlackjack();
  });

  socket.on('disconnect', () => {
    seats = seats.filter(s => s.socketID!==socket.id);
    if (seats.length===0) {
      gameStarted = false;
      currentTurnSeat = 0;
      // Could reset multiGame if desired
    }
    broadcastTableState();
    console.log('Client disconnected:', socket.id);
  });
});

/** ========== Turn & Dealer Logic for Multi-Seat ========== */
function nextSeatTurn() {
  // Move currentTurnSeat to next seat
  const seatIndices = seats.map(s=>s.seatIndex).sort((a,b)=>a-b);
  let currentIndexPos = seatIndices.indexOf(currentTurnSeat);

  if (currentIndexPos < 0) {
    // If not found, default to first seat
    currentIndexPos = 0;
  }
  currentIndexPos++;

  // If we've passed the last seat => do dealer logic
  if (currentIndexPos >= seatIndices.length) {
    dealerDraw();
    return;
  } else {
    // Otherwise, set new currentTurnSeat
    currentTurnSeat = seatIndices[currentIndexPos];
    seats.forEach(s => s.isTurn = false);
    const seatObj = seats.find(s=>s.seatIndex===currentTurnSeat);
    if (seatObj) seatObj.isTurn = true;

    broadcastTableState();
    broadcastMultiBlackjack();
  }
}

function dealerDraw() {
  // Basic dealer logic: draw until 17
  let dealerValue = calculateHandValue(multiGame.dealerHand);
  while (dealerValue < 17) {
    const c = multiGame.deck.pop();
    multiGame.dealerHand.push(c);
    dealerValue = calculateHandValue(multiGame.dealerHand);
  }
  // Round ends
  multiGame.gameOver = true;
  multiGame.message = 'Round ended. All players have taken their turn.';
  broadcastTableState();
  broadcastMultiBlackjack();
}

/** ========== Single-player state (coexists for demonstration) ========== */
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
  if (gameState.gameOver || gameState.playerHands[0].length===0) {
    gameState.deck=[];
    gameState.playerHands=[[]];
    gameState.dealerHand=[];
    gameState.gameOver=false;
    gameState.message='';
    gameState.bet=0;
    gameState.currentHandIndex=0;
    gameState.splitOccurred=false;
  }
}

function checkForBlackjack(hand) {
  return (hand.length===2 && calculateHandValue(hand)===21);
}

/** ========== Routes ========== */
const router = express.Router();

/** Single-player “start” route **/
router.post('/start', (req,res)=>{
  const { bet } = req.body;
  resetGameStateIfNeeded();
  if (bet>gameState.balance) {
    return res.status(400).json({message:'Insufficient balance.'});
  }
  if (bet<=0) {
    return res.status(400).json({message:'Bet must be>0'});
  }

  let deck = createDeck();
  deck = shuffleDeck(deck);

  const playerHand=[deck.pop(), deck.pop()];
  const dealerHand=[deck.pop(), deck.pop()];
  gameState.deck=deck;
  gameState.playerHands=[playerHand];
  gameState.dealerHand=dealerHand;
  gameState.gameOver=false;
  gameState.bet=bet;
  gameState.balance-=bet;
  const playerValue=calculateHandValue(playerHand);
  let message=`Dealer shows: ${dealerHand[0].rank} of ${dealerHand[0].suit}`;
  if (checkForBlackjack(playerHand)) {
    const bjWin = Math.round(bet*2.5);
    gameState.balance+=bjWin;
    gameState.gameOver=true;
    message='Blackjack! Player wins!';
  } else {
    message=`Player: ${playerValue}, `+message;
  }
  gameState.message=message;
  return res.json({
    message,
    playerHand,
    dealerHand:[dealerHand[0],{rank:'Hidden',suit:'Hidden'}],
    balance:gameState.balance,
  });
});

/**
 * Unified /hit route
 * - If multi-game is active (and seats.length > 1), handle multi-seat logic
 * - Otherwise, handle single-player logic
 */
router.post('/hit',(req,res)=>{
  const { seatIndex, handIndex } = req.body;

  // If we are in a multi-seat game:
  if (gameStarted && seats.length > 1) {
    const seat = seats.find(s=>s.seatIndex===seatIndex);
    if (!seat) {
      return res.json({ error: 'Invalid seatIndex.' });
    }
    if (seatIndex !== currentTurnSeat) {
      return res.json({ error: 'Not your turn.' });
    }
    // Draw card
    const card = multiGame.deck.pop();
    multiGame.playerHandsBySeat[seatIndex].push(card);

    const val = calculateHandValue(multiGame.playerHandsBySeat[seatIndex]);
    if (val > 21) {
      // Bust => move turn to next seat
      multiGame.message = `${seat.username} busts with ${val}!`;
      nextSeatTurn();
    } else {
      multiGame.message = `${seat.username} hits and now has ${val}.`;
      broadcastTableState();
      broadcastMultiBlackjack();
    }

    return res.json({
      message: multiGame.message,
      gameOver: multiGame.gameOver,
    });
  }

  // Otherwise => single-player logic
  if (gameState.gameOver) {
    return res.json({message:'Game is already over.', gameOver:true});
  }
  if (checkForBlackjack(gameState.playerHands[handIndex])) {
    return res.json({message:'Blackjack already!', gameOver:true});
  }
  const newCard=gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const val=calculateHandValue(gameState.playerHands[handIndex]);
  if (val>21) {
    gameState.gameOver=true;
    gameState.message='Player busts!';
  } else {
    gameState.message=`Player now has ${val}.`;
  }
  return res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    playerHands: gameState.playerHands,
    dealerHand:[gameState.dealerHand[0], {rank:'Hidden', suit:'Hidden'}],
  });
});

/**
 * Unified /stand route
 * - If multi-game is active => seat stands, move turn to next seat or dealer
 * - Otherwise => single-player logic
 */
router.post('/stand',(req,res)=>{
  const { seatIndex } = req.body;

  // Multi-seat logic
  if (gameStarted && seats.length > 1) {
    const seat = seats.find(s=>s.seatIndex===seatIndex);
    if (!seat) {
      return res.json({ error: 'Invalid seatIndex.' });
    }
    if (seatIndex !== currentTurnSeat) {
      return res.json({ error: 'Not your turn.' });
    }
    multiGame.message = `${seat.username} stands.`;
    nextSeatTurn();

    return res.json({
      message: multiGame.message,
      gameOver: multiGame.gameOver,
    });
  }

  // Single-player logic
  if(gameState.gameOver){
    return res.json({message:'Game is already over.', gameOver:true});
  }
  if(checkForBlackjack(gameState.playerHands[0])){
    return res.json({message:'You already have Blackjack!', gameOver:true,balance:gameState.balance});
  }

  let dealerVal=calculateHandValue(gameState.dealerHand);
  while(dealerVal<17) {
    gameState.dealerHand.push(gameState.deck.pop());
    dealerVal=calculateHandValue(gameState.dealerHand);
  }
  let outcome='dealer-win';
  let finalMessage='';

  const pVal=calculateHandValue(gameState.playerHands[0]);
  if(pVal>21){
    finalMessage='Player busts!';
  } else if(dealerVal>21||pVal>dealerVal){
    outcome='player-win';
    finalMessage='Player wins!';
  } else if(pVal===dealerVal){
    outcome='tie';
    finalMessage='Tie!';
  } else {
    finalMessage='Dealer wins!';
  }
  gameState.gameOver=true;
  gameState.message=finalMessage;

  if(outcome==='player-win'){
    gameState.balance+=(gameState.bet*2);
  } else if(outcome==='tie'){
    gameState.balance+=gameState.bet;
  }
  return res.json({
    message: finalMessage,
    gameOver:true,
    outcome,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: gameState.dealerHand,
  });
});

/**
 * Single-player /double route
 */
router.post('/double',(req,res)=>{
  const{handIndex}=req.body;
  if(gameState.gameOver){
    return res.json({message:'Game is already over.'});
  }
  if(checkForBlackjack(gameState.playerHands[handIndex])) {
    return res.json({message:'Cannot double after Blackjack!', gameOver:true});
  }
  if(gameState.balance<gameState.bet){
    return res.json({message:'Insufficient balance to double.'});
  }
  gameState.balance-=gameState.bet;
  gameState.bet*=2;

  const card=gameState.deck.pop();
  gameState.playerHands[handIndex].push(card);

  const val=calculateHandValue(gameState.playerHands[handIndex]);
  if(val>21){
    gameState.gameOver=true;
    gameState.message='Player busts after Double!';
    return res.json({
      message: gameState.message,
      gameOver:true,
      balance: gameState.balance,
      playerHands: gameState.playerHands,
      dealerHand:[gameState.dealerHand[0],{rank:'Hidden', suit:'Hidden'}],
    });
  }

  // stand logic
  req.url='/stand';
  req.method='POST';
  app._router.handle(req,res);
});

router.post('/split',(req,res)=>{
  if(gameState.gameOver){
    return res.json({message:'Game is already over.'});
  }
  if(gameState.splitOccurred||gameState.playerHands.length!==1){
    return res.json({message:'Split not allowed.'});
  }
  const [hand]=gameState.playerHands;
  if(hand.length!==2||hand[0].rank!==hand[1].rank){
    return res.json({message:'Cannot split unless same rank.'});
  }
  if(gameState.balance<gameState.bet){
    return res.json({message:'Insufficient balance to split.'});
  }
  gameState.balance-=gameState.bet;
  gameState.bet*=2;

  const newHand1=[hand[0]];
  const newHand2=[hand[1]];
  gameState.playerHands=[newHand1,newHand2];
  gameState.splitOccurred=true;
  gameState.message='You split your cards!';
  return res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    balance:gameState.balance,
    playerHands:gameState.playerHands,
    dealerHand:[gameState.dealerHand[0], {rank:'Hidden',suit:'Hidden'}],
  });
});

/** This route resets the round => set gameStarted=false, seats=>not ready, reset single & multi states. */
router.post('/resetRound',(req,res)=>{
  // End the round => back to lobby
  gameStarted=false;
  currentTurnSeat=0;
  seats.forEach(s=>{
    s.isReady=false;
    s.isTurn=false;
  });
  multiGame={
    deck:[],
    dealerHand:[],
    playerHandsBySeat:{},
    gameOver:false,
    message:'',
  };
  // reset single-player
  gameState={
    deck:[],
    playerHands:[[]],
    dealerHand:[],
    gameOver:false,
    message:'',
    bet:0,
    balance:300,
    currentHandIndex:0,
    splitOccurred:false,
  };

  broadcastTableState();
  broadcastMultiBlackjack();
  return res.json({message:'Round reset => back to lobby.'});
});

app.use('/', router);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server + Socket.IO running on port ${PORT}`);
});
