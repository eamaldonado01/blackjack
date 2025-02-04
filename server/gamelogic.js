// server/gameLogic.js

// 1. Create a deck
function createDeck() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = [
      { rank: 'A', value: 1 },    // We'll handle the special Ace logic later
      { rank: '2', value: 2 },
      { rank: '3', value: 3 },
      { rank: '4', value: 4 },
      { rank: '5', value: 5 },
      { rank: '6', value: 6 },
      { rank: '7', value: 7 },
      { rank: '8', value: 8 },
      { rank: '9', value: 9 },
      { rank: '10', value: 10 },
      { rank: 'J', value: 10 },
      { rank: 'Q', value: 10 },
      { rank: 'K', value: 10 },
    ];
  
    let deck = [];
    for (const suit of suits) {
      for (const r of ranks) {
        deck.push({
          suit: suit,
          rank: r.rank,
          value: r.value,
        });
      }
    }
    return deck;
  }
  
  // 2. Shuffle (using Fisher-Yates algorithm)
  function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  module.exports = {
    createDeck,
    shuffleDeck,
  };

function calculateHandValue(cards) {
    let total = 0;
    let aceCount = 0;
  
    // First pass: add up values, counting Ace as 1
    for (let card of cards) {
      total += card.value;
      if (card.rank === 'A') {
        aceCount += 1;
      }
    }
  
    // Second pass: convert as many Aces from 1 to 11 as possible
    // (each conversion adds +10, since we've already counted Ace as 1)
    while (aceCount > 0) {
      if (total + 10 <= 21) {
        total += 10;
      }
      aceCount -= 1;
    }
  
    return total;
  }
  
  module.exports = {
    createDeck,
    shuffleDeck,
    calculateHandValue,
  };
  
  