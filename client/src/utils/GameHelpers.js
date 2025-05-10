// src/utils/GameHelpers.js
// ================================================================
// Dynamically import all .webp card images at build‑time
// (Vite adds the full relative path—keep that EXACT)
// ================================================================
const cardImages = import.meta.glob(
  '../assets/playing_cards/*.webp',
  { eager: true, import: 'default' }
);

/* ----------------------------------------------------------------
 * Deck helpers
 * ---------------------------------------------------------------- */
export function createDeck() {
  const suits  = ['spades', 'hearts', 'diamonds', 'clubs'];   // <- all‑lowercase
  const ranks  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck   = [];
  suits.forEach(suit => ranks.forEach(rank => deck.push({ rank, suit })));
  return deck;
}

export function shuffleDeck(deck) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function calculateHandValue(hand) {
  let total = 0, aces = 0;
  hand.forEach(c => {
    if (['K','Q','J'].includes(c.rank)) total += 10;
    else if (c.rank === 'A')            { aces++; total += 11; }
    else                                total += Number(c.rank);
  });
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

/* ----------------------------------------------------------------
 * Image helper
 * ---------------------------------------------------------------- */
const FACE_MAP = { a: 'Ace', j: 'Jack', q: 'Queen', k: 'King' };

export function getCardImage(card) {
  // Hidden / placeholder
  if (!card || card.rank === 'Hidden') {
    return cardImages['../assets/playing_cards/card_back.webp'];
  }

  // --- build filename ------------------------------------------------
  const rawRank  = card.rank.toString();          // e.g. '10' | 'A' | 'Q'
  const rawSuit  = card.suit.toString();          // e.g. 'hearts'
  const rankKey  = FACE_MAP[rawRank.toLowerCase()] ?? rawRank;    // Ace / Jack / …
  const suitKey  = rawSuit.toLowerCase();                           // keep lowercase
  const fileKey  = `../assets/playing_cards/${rankKey}_of_${suitKey}.webp`;

  // fallback → card back
  return fileKey in cardImages
    ? cardImages[fileKey]
    : cardImages['../assets/playing_cards/card_back.webp'];
}
