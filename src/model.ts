type Card = {
    /** A = 1, J = 11, Q = 12, K = 13 */
    value: number;
    suit: Suit;
}

enum Suit {
    Clubs = "Clubs",
    Diamonds = "Diamonds",
    Hearts = "Hearts",
    Spades = "Spades",
}

export function generateDeck(): Card[] {
    let cards: Card[] = [];
    for (let value = 1; value <= 13; value++) {
        for (const suit of Object.values(Suit)) {
            cards.push({ value, suit });
        }
    }
    return cards;
}

export function getCardKey(card: Card): string {
    return "0A23456789TJQK"[card.value] + card.suit[0];
}