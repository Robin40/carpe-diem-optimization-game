import Phaser from "phaser";
import {type Card, EventType, generateDeck, newGameState, useCard} from "./model.ts";

const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;
const cardHeight = gameHeight / 3;
const cardWidth = cardHeight / Math.sqrt(2);
const gapX = gameWidth / 80;
const fontSize = gameHeight / 12;
const textStyle = {
    fontFamily: "serif",
    fontSize,
};
const lineHeight = 1.2;
const backgroundColor = "#192a56";
const usedCardTint = 0x888888;

new Phaser.Game({
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    backgroundColor,
    scene: {
        preload() {
            for (const card of generateDeck()) {
                const key = getCardKey(card);
                this.load.svg(key, `cards/${key}.svg`, { width: cardWidth, height: cardHeight });
            }
        },
        create() {
            let state = newGameState();
            const counters = [
                addCounter(this, gapX, 0, "Day", () => state.day),
                addCounter(this, gameWidth / 2, 0, "Victory Points", () => state.victoryPoints),
                addCounter(this, gapX, fontSize * lineHeight, "Energy", () => state.energy),
                addCounter(this, gameWidth / 2, fontSize * lineHeight, "Money", () => state.money),
                addCounter(this, gapX, fontSize * lineHeight * 2, "Action Points", () => state.actionPoints),
            ];
            for (let i = 0; i < state.dayCards.length; i++) {
                const card = state.dayCards[i];
                const cardImage = this.add.image(
                    gameWidth / 2 + (i - (state.dayCards.length - 1) / 2) * (cardWidth + gapX),
                    gameHeight / 2,
                    getCardKey(card),
                ).setInteractive().on(Phaser.Input.Events.POINTER_DOWN, ()=> {
                    const event = useCard(card, i, state);
                    switch (event.type) {
                        case EventType.UseCard:
                            counters.forEach(counter => counter.update());
                            cardImage.setTint(usedCardTint);
                            break;
                        case EventType.CardAlreadyUsed:
                            break;
                        case EventType.NotEnoughResources:
                            alert(JSON.stringify(event, null, 4));
                            break;
                    }
                });
            }
        },
        update() {},
    }
});

function addCounter(scene: Phaser.Scene, x: number, y: number, label: string, getter: () => number) {
    const contents = () => `${label}: ${getter()}`;
    const text = scene.add.text(x, y, contents(), textStyle);
    return {
        update() {
            text.setText(contents());
        },
    };
}

function getCardKey(card: Card): string {
    return "0A23456789TJQK"[card.value] + card.suit[0];
}