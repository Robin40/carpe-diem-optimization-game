import Phaser from "phaser";
import {
    type Action, apply,
    type Card, type CarpeDiemEvent,
    generateDeck, getDelta, getLacks,
    newGameState, type Resources,
} from "./model.ts";

const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;
const cardHeight = gameHeight / 3;
const cardWidth = cardHeight / Math.sqrt(2);
const gapX = gameWidth / 80;
const fontSize = gameHeight * 0.07;
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
const disabledCardTint = 0x888888;
const disabledButtonTint = 0x888888;
const unaffordableTint = 0xCC8888;

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
            let [state, event] = newGameState();
            receive(event);
            setTimeout(() => updateUI(), 200);

            function send(action: Action) {
                const event = apply(action, state);
                receive(event);
                if (state.actionPoints === 0 && !state.gameEnded) {
                    setTimeout(() => {
                        send({ type: "EndDay" });
                    }, 500);
                }
                updateUI();
            }
            function receive(event: CarpeDiemEvent) {
                switch (event.type) {
                    case "DayEnd":
                        if (!state.gameEnded) {
                            send({ type: "BeginNextDay" });
                        }
                        break;
                }
            }

            const counters = [
                addCounter(this, gapX, 0, "Day", () => state.day),
                addCounter(this, gameWidth / 2, 0, "Victory Points", () => state.victoryPoints),
                addCounter(this, gapX, fontSize * lineHeight, "Energy", () => state.energy),
                addCounter(this, gameWidth / 2, fontSize * lineHeight, "Money", () => state.money),
                addCounter(this, gapX, fontSize * lineHeight * 2, "Time", () => state.actionPoints),
            ];
            const updateUI = () => {
                counters.forEach(counter => counter.update());
                cardImages.forEach((image, index) => {
                    const delta = getDelta(index, state);
                    const lacks = getLacks(delta, state);
                    image.setTexture(getCardKey(state.dayCards[index]));
                    image.setTint(state.used[index] ? disabledCardTint : lacks ? unaffordableTint : 0xFFFFFF);
                });
                cardHints.forEach((hint, index) => {
                    const delta = getDelta(index, state);
                    const emoji = {
                        actionPoints: "⏳",
                        energy: "⚡",
                        money: "💰",
                        victoryPoints: "🏆",
                    }
                    hint.setText(
                        (Object.entries(delta) as [keyof Resources, number][])
                            .filter(([resource, value]) => !(resource === "victoryPoints" && value === 0))
                            .map(([resource, value]) =>
                                resource === "actionPoints"
                                    ? emoji[resource].repeat(-value)
                                    : `${emoji[resource]} ${value}`)
                            .join("\n")
                    ).setAlpha(state.used[index] ? 0.5 : 1);
                });
                freelanceButton.setEnabled(state.actionPoints >= 1);
                recuperateButton.setEnabled(state.actionPoints >= 1);
            }

            const cardImages: Phaser.GameObjects.Image[] = [];
            const cardHints: Phaser.GameObjects.Text[] = [];
            for (let i = 0; i < state.dayCards.length; i++) {
                const card = state.dayCards[i];
                const cardImage = this.add.image(
                    gameWidth / 2 + (i - (state.dayCards.length - 1) / 2) * (cardWidth + gapX),
                    gameHeight * 0.45,
                    getCardKey(card),
                ).setInteractive().on(Phaser.Input.Events.POINTER_DOWN, ()=> {
                    send({ type: "UseCard", index: i });
                });
                cardImages.push(cardImage);

                cardHints.push(
                    this.add.text(cardImage.x, cardImage.y + cardHeight / 2, "",
                        { ...textStyle, fontSize: fontSize * 0.5 }
                    ).setOrigin(0.5, 0)
                );
            }

            const recuperateButton = addButton(
                this,
                gameWidth * 0.25,
                gameHeight * 0.85,
                "Recuperate",
                () => send({ type: "Recuperate" }),
            );
            const freelanceButton = addButton(
                this,
                gameWidth * 0.75,
                gameHeight * 0.85,
                "Freelance",
                () => send({ type: "Freelance" })
            );
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