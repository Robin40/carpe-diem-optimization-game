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
    used: boolean[];
    gameEnded: boolean;
};

export function newGameState(): State {
    let state = {
        day: 1,
        victoryPoints: 0,
        energy: 3,
        money: 8,
        actionPoints: 5,
        drawPile: Phaser.Utils.Array.Shuffle(generateDeck()),
        dayCards: [],
        used: [false, false, false, false],
        gameEnded: false,
    };
    draw(state);
    return state;
}

function draw(state: State): void {
    state.dayCards = [];
    for (let i = 0; i < 4; i++) {
        state.dayCards.push(state.drawPile.pop()!);
    }
    state.used = [false, false, false, false];
}

export type CarpeDiemEvent =
    | { type: "UseCard" }
    | { type: "CardAlreadyUsed" }
    | {
        type: "NotEnoughResources";
        lacksActionPoints: boolean;
        lacksEnergy: boolean;
        lacksMoney: boolean;
    }
    | { type: "Freelance" }
    | { type: "Recuperate" }
    | { type: "DayStart" }
    | { type: "DayEnd" }
    | { type: "Win"; score: number }
    | { type: "Lose" };

type Action =
    | { type: "UseCard", index: number }
    | { type: "Freelance" }
    | { type: "Recuperate" }
    | { type: "EndDay" }
    | { type: "BeginNextDay" };

export function perform(action: Action, state: State): CarpeDiemEvent {
    switch (action.type) {
        case "UseCard": {
            if (state.used[action.index]) {
                return {type: "CardAlreadyUsed"};
            }

            const card = state.dayCards[action.index];
            const isSpecial = card.value === 1 || card.value > 10;

            const deltaActionPoints = -(action.index + 1);
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
                    type: "NotEnoughResources",
                    lacksActionPoints,
                    lacksEnergy,
                    lacksMoney,
                };
            }

            state.actionPoints += deltaActionPoints;
            state.energy += deltaEnergy;
            state.money += deltaMoney;
            state.victoryPoints += deltaVictoryPoints;

            state.used[action.index] = true;

            return {type: "UseCard"};
        }
        case "Freelance": {
            if (state.actionPoints < 1) return notEnoughActionPoints;

            state.actionPoints -= 1;
            state.money += 1;
            return {type: "Freelance"};
        }
        case "Recuperate": {
            if (state.actionPoints < 1) return notEnoughActionPoints;

            state.actionPoints -= 1;
            state.energy += 1;
            return {type: "Recuperate"};
        }
        case "EndDay": {
            state.money -= 4;
            state.energy -= 1;
            if (state.money < 0 || state.energy < 0) {
                state.gameEnded = true;
                return {type: "Lose"};
            }

            if (state.day === 13) {
                state.gameEnded = true;
                return {type: "Win", score: state.victoryPoints + state.money};
            }

            return {type: "DayEnd"};
        }
        case "BeginNextDay": {
            state.actionPoints = 5;
            draw(state);

            return {type: "DayStart"};
        }
    }
}

const notEnoughActionPoints: CarpeDiemEvent = {
    type: "NotEnoughResources",
    lacksActionPoints: true,
    lacksEnergy: false,
    lacksMoney: false,
}
