import Phaser from "phaser";
import {generateDeck, getCardKey, shuffle} from "./model.ts";

const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;
const cardHeight = gameHeight / 3;
const cardWidth = cardHeight / Math.sqrt(2);
const gapX = gameWidth / 80;

let deck = generateDeck();
new Phaser.Game({
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
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
                this.add.image(
                    gameWidth / 2 + (i - (dayCards.length - 1) / 2) * (cardWidth + gapX),
                    gameHeight / 2,
                    getCardKey(dayCards[i]),
                );
            }
        },
        update() {},
    }
});

