import Phaser from "phaser";
import {generateDeck, getCardKey} from "./model.ts";

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
            let day = 1;
            let victoryPoints = 0;
            let energy = 3;
            let money = 8;
            let actionPoints = 5;
            addCounter(this, gapX, 0, "Day", () => day);
            addCounter(this, gameWidth / 2, 0, "Victory Points", () => victoryPoints);
            addCounter(this, gapX, fontSize * lineHeight, "Energy", () => energy);
            addCounter(this, gameWidth / 2, fontSize * lineHeight, "Money", () => money);
            const actionPointsCounter = addCounter(this, gapX, fontSize * lineHeight * 2, "Action Points", () => actionPoints);

            Phaser.Utils.Array.Shuffle(deck);
            const dayCards = deck.slice(0, 4);
            for (let i = 0; i < dayCards.length; i++) {
                const card = dayCards[i];
                let requiredActionPoints = i + 1;
                this.add.image(
                    gameWidth / 2 + (i - (dayCards.length - 1) / 2) * (cardWidth + gapX),
                    gameHeight / 2,
                    getCardKey(card),
                ).setInteractive().on(Phaser.Input.Events.POINTER_DOWN, ()=> {
                    if (actionPoints >= requiredActionPoints) {
                        actionPoints -= requiredActionPoints;
                        actionPointsCounter.update();
                    } else {
                        alert("Not enough Action Points");
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