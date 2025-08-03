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

export type State = {
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

export function newGameState(): [State, CarpeDiemEvent] {
    let state = {
        day: 0,
        victoryPoints: 0,
        energy: 3,
        money: 8,
        actionPoints: 5,
        drawPile: Phaser.Utils.Array.Shuffle(generateDeck()),
        dayCards: [],
        used: [false, false, false, false],
        gameEnded: false,
    };
    const event = beginDay(state);
    return [state, event];
}

function beginDay(state: State): CarpeDiemEvent {
    state.day++;
    state.actionPoints = 5;

    state.dayCards = [];
    for (let i = 0; i < 4; i++) {
        state.dayCards.push(state.drawPile.pop()!);
    }
    state.used = [false, false, false, false];

    const firstCardEnergy = Math.min(state.dayCards[0].value, 10);
    const energyLoss = state.energy > firstCardEnergy ? 1 : 0;
    state.energy -= energyLoss;
    return { type: "DayStart", energyLoss };
}

export type CarpeDiemEvent =
    | { type: "UseCard" }
    | { type: "CardAlreadyUsed" }
    | { type: "NotEnoughResources"; lacks: Lacks; }
    | { type: "Freelance" }
    | { type: "Recuperate" }
    | { type: "DayStart", energyLoss: number }
    | { type: "DayEnd" }
    | { type: "Win"; score: number }
    | { type: "Lose" };

export type Action =
    | { type: "UseCard", index: number }
    | { type: "Freelance" }
    | { type: "Recuperate" }
    | { type: "EndDay" }
    | { type: "BeginNextDay" };

export type Resources = {
    actionPoints: number;
    energy: number;
    money: number;
    victoryPoints: number;
}

export function getDelta(index: number, state: State): Resources {
    const card = state.dayCards[index];
    return {
        actionPoints: -(index + 1),
        energy: ({
            [Suit.Clubs]: 1,
            [Suit.Diamonds]: 0,
            [Suit.Hearts]: -1,
            [Suit.Spades]: -3,
        })[card.suit],
        money: card.value === 1 || card.value > 10 ? -5 : card.value,
        victoryPoints: ({
            11: 10,
            12: 20,
            13: 30,
            1: 50,
        })[card.value] ?? 0
    };
}

type Lacks = {
    actionPoints: boolean;
    energy: boolean;
    money: boolean;
}

export function getLacks(delta: Resources, state: State): Lacks | undefined {
    const lacks: Lacks = {
        actionPoints: state.actionPoints + delta.actionPoints < 0,
        energy: state.energy + delta.energy < 0,
        money: state.money + delta.money < 0,
    };
    if (lacks.actionPoints || lacks.energy || lacks.money) {
        return lacks;
    } else return undefined;
}

export function apply(action: Action, state: State): CarpeDiemEvent {
    switch (action.type) {
        case "UseCard": {
            if (state.used[action.index]) {
                return {type: "CardAlreadyUsed"};
            }

            const delta = getDelta(action.index, state);
            const lacks = getLacks(delta, state);
            if (lacks) {
                return { type: "NotEnoughResources", lacks };
            }

            state.actionPoints += delta.actionPoints;
            state.energy += delta.energy;
            state.money += delta.money;
            state.victoryPoints += delta.victoryPoints;

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
            return beginDay(state);
        }
    }
}

const notEnoughActionPoints: CarpeDiemEvent = {
    type: "NotEnoughResources",
    lacks: { actionPoints: true, energy: false, money: false },
}
