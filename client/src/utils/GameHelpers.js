// src/utils/GameHelpers.js

export function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
  const deck = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({ suit, rank });
    });
  });
  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;
  hand.forEach(card => {
    if (['Jack', 'Queen', 'King'].includes(card.rank)) {
      value += 10;
    } else if (card.rank === 'Ace') {
      value += 11;
      aces += 1;
    } else {
      value += parseInt(card.rank, 10);
    }
  });
  while (value > 21 && aces) {
    value -= 10;
    aces -= 1;
  }
  return value;
}

// Dynamically import all card images
const cardImages = import.meta.glob('../assets/playing_cards/*.png', { eager: true, import: 'default' });

export function getCardImage(card) {
  if (!card || card.rank === 'Hidden') {
    return cardImages['../assets/playing_cards/card_back.png'];
  }
  const key = `../assets/playing_cards/${card.rank}_of_${card.suit}.png`;
  return cardImages[key];
}


