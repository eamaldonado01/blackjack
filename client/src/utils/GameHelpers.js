// path: blackjack/client/src/GameHelpers.js

export function getCardImage(card) {
    if (!card || card.rank === 'Hidden') {
      return '/src/assets/playing_cards/card_back.png';
    }
    const rankMap = {
      A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack',
      10: '10', 9: '9', 8: '8', 7: '7',
      6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
    };
    const suitMap = {
      Spades: 'S', Hearts: 'H', Clubs: 'C', Diamonds: 'D',
    };
    return `/src/assets/playing_cards/${rankMap[card.rank]}${suitMap[card.suit]}.png`;
  }
  
  export function calculateHandTotal(hand) {
    let total = 0;
    let aces = 0;
    hand.forEach(card => {
      if (card.rank === 'A') {
        aces += 1;
        total += 11;
      } else if (['K', 'Q', 'J'].includes(card.rank)) {
        total += 10;
      } else {
        total += Number(card.rank);
      }
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }
  