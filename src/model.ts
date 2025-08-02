import Phaser from "phaser";

export type Card = {
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

type State = {
    day: number;
    victoryPoints: number;
    energy: number;
    money: number;
    actionPoints: number;
    drawPile: Card[];
    dayCards: Card[];
};

export function newGameState(): State {
    let drawPile = Phaser.Utils.Array.Shuffle(generateDeck());
    let dayCards: Card[] = [];
    for (let i = 0; i < 4; i++) {
        dayCards.push(drawPile.pop()!);
    }

    return {
        day: 1,
        victoryPoints: 0,
        energy: 3,
        money: 8,
        actionPoints: 5,
        drawPile: Phaser.Utils.Array.Shuffle(generateDeck()),
        dayCards,
    };
}

export enum EventType {
    UseCard,
    NotEnoughResources,
}

export type CarpeDiemEvent =
    | { type: EventType.UseCard }
    | {
        type: EventType.NotEnoughResources;
        lacksActionPoints: boolean;
        lacksEnergy: boolean;
        lacksMoney: boolean;
      };

export function useCard(card: Card, index: number, state: State): CarpeDiemEvent {
    const isSpecial = card.value === 1 || card.value > 10;

    const deltaActionPoints = -(index + 1);
    const deltaEnergy = ({
        [Suit.Clubs]: 1,
        [Suit.Diamonds]: 0,
        [Suit.Hearts]: -1,
        [Suit.Spades]: -3,
    })[card.suit];
    const deltaMoney = isSpecial ? -5 : card.value;
    const deltaVictoryPoints = ({
        11: 10,
        12: 20,
        13: 30,
        1: 50,
    })[card.value] ?? 0;

    const lacksActionPoints = state.actionPoints + deltaActionPoints < 0;
    const lacksEnergy = state.energy + deltaEnergy < 0;
    const lacksMoney = state.money + deltaMoney < 0;
    if (lacksActionPoints || lacksEnergy || lacksMoney) {
        return {
            type: EventType.NotEnoughResources,
            lacksActionPoints,
            lacksEnergy,
            lacksMoney,
        };
    }

    state.actionPoints += deltaActionPoints;
    state.energy += deltaEnergy;
    state.money += deltaMoney;
    state.victoryPoints += deltaVictoryPoints;

    return { type: EventType.UseCard };
}