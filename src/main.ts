import Phaser from "phaser";
import {generateDeck, getCardKey, shuffle} from "./model.ts";

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

let deck = generateDeck();
new Phaser.Game({
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    backgroundColor,
    scene: {
        preload() {
            for (const card of deck) {
                const key = getCardKey(card);
                this.load.svg(key, `cards/${key}.svg`, { width: cardWidth, height: cardHeight });
            }
        },
        create() {
            shuffle(deck);

            const dayCards = deck.slice(0, 4);
            for (let i = 0; i < dayCards.length; i++) {
                const card = dayCards[i];
                this.add.image(
                    gameWidth / 2 + (i - (dayCards.length - 1) / 2) * (cardWidth + gapX),
                    gameHeight / 2,
                    getCardKey(card),
                ).setInteractive().on(Phaser.Input.Events.POINTER_DOWN, ()=> {
                    alert(`Clicked card ${card.value} ${card.suit}`);
                });
            }

            let day = 1;
            let victoryPoints = 0;
            let energy = 3;
            let money = 8;
            let actionPoints = 5;
            this.add.text(gapX, 0, `Day: ${day}`, textStyle);
            this.add.text(gameWidth / 2, 0, `Victory Points: ${victoryPoints}`, textStyle);
            this.add.text(gapX, fontSize * lineHeight, `Energy: ${energy}`, textStyle);
            this.add.text(gameWidth / 2, fontSize * lineHeight, `Money: ${money}`, textStyle);
            this.add.text(gapX, fontSize * lineHeight * 2, `Action Points: ${actionPoints}`, textStyle);
        },
        update() {},
    }
});
