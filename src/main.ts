import Phaser from "phaser";
import {
    type Card,
    generateDeck,
    newGameState, perform,
} from "./model.ts";

const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;
const cardHeight = gameHeight / 3;
const cardWidth = cardHeight / Math.sqrt(2);
const gapX = gameWidth / 80;
const fontSize = gameHeight / 12;
const buttonPadding = {
    x: fontSize,
    y: fontSize * 0.1,
};
const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: "serif",
    fontSize,
};
const lineHeight = 1.2;
const gameBgColor = "#192a56";
const buttonBgColor = "#1751e6";
const usedCardTint = 0x888888;
const disabledButtonTint = 0x888888;

new Phaser.Game({
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    backgroundColor: gameBgColor,
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
            const updateUI = () => {
                counters.forEach(counter => counter.update());
                cardImages.forEach((image, index) => {
                    image.setTexture(getCardKey(state.dayCards[index]));
                    image.setTint(state.used[index] ? usedCardTint : 0xFFFFFF);
                });
                freelanceButton.setEnabled(state.actionPoints >= 1);
                recuperateButton.setEnabled(state.actionPoints >= 1);

                if (state.actionPoints === 0 && !state.gameEnded) {
                    setTimeout(() => {
                        perform({ type: "EndDay" }, state);
                        if (!state.gameEnded) {
                            perform({ type: "BeginNextDay" }, state);
                        }
                        updateUI();
                    }, 500);
                }
            }

            const cardImages: Phaser.GameObjects.Image[] = [];
            for (let i = 0; i < state.dayCards.length; i++) {
                const card = state.dayCards[i];
                const cardImage = this.add.image(
                    gameWidth / 2 + (i - (state.dayCards.length - 1) / 2) * (cardWidth + gapX),
                    gameHeight / 2,
                    getCardKey(card),
                ).setInteractive().on(Phaser.Input.Events.POINTER_DOWN, ()=> {
                    const event = perform({ type: "UseCard", index: i }, state);
                    switch (event.type) {
                        case "UseCard":
                            updateUI();
                            break;
                        case "CardAlreadyUsed":
                            break;
                        case "NotEnoughResources":
                            alert(JSON.stringify(event, null, 4));
                            break;
                    }
                });
                cardImages.push(cardImage);
            }

            const freelanceButton = addButton(this, gameWidth / 2, gameHeight * 0.75, "Freelance", () => {
                perform({ type: "Freelance" }, state);
                updateUI();
            });
            const recuperateButton = addButton(this, gameWidth / 2, gameHeight * 0.75 + (fontSize * lineHeight + buttonPadding.y * 2), "Recuperate", () => {
                perform({ type: "Recuperate" }, state);
                updateUI();
            });
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

function addButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
        ...textStyle,
        backgroundColor: buttonBgColor,
        padding: buttonPadding,
    };
    const text = scene.add.text(x, y, label, style)
        .setInteractive().on(Phaser.Input.Events.POINTER_DOWN, onClick)
        .setOrigin(0.5, 0);
    return {
        setEnabled(enabled: boolean) {
            text.setTint(enabled ? 0xFFFFFF : disabledButtonTint);
        }
    };
}

function getCardKey(card: Card): string {
    return "0A23456789TJQK"[card.value] + card.suit[0];
}