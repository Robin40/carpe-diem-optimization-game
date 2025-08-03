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
const defaultFontSize = gameHeight * 0.062;
const hintFontSize = gameHeight * 0.035
const buttonPadding = {
    x: defaultFontSize,
    y: defaultFontSize * 0.1,
};
const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: "serif",
    fontSize: defaultFontSize,
};
const lineHeight = 1.2;
const gameBgColor = "#192a56";
const buttonBgColor = "#1751e6";
const disabledCardTint = 0x888888;
const disabledButtonTint = 0x888888;
const unaffordableTint = 0xCC8888;
const hoveredCardTint = 0xFFFFDD;
const hoveredButtonTint = 0xFFFFDD;
const emoji = {
    actionPoints: "⏳",
    energy: "⚡",
    money: "💰",
    victoryPoints: "🏆",
};

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

            const counters = {
                day: addCounter(this, gapX, 0, "Day", () => state.day),
                victoryPoints: addCounter(this, gameWidth / 2, 0, "Victory Points", () => state.victoryPoints),
                energy: addCounter(this, gapX, defaultFontSize * lineHeight, "Energy", () => state.energy),
                money: addCounter(this, gameWidth / 2, defaultFontSize * lineHeight, "Money", () => state.money),
                actionPoints: addCounter(this, gapX, defaultFontSize * lineHeight * 2, "Time", () => state.actionPoints),
            };
            const getCardTint = (index: number, hovered: boolean) => {
                const delta = getDelta(index, state);
                const lacks = getLacks(delta, state);
                return state.used[index] ? disabledCardTint : lacks ? unaffordableTint : hovered ? hoveredCardTint : 0xFFFFFF;
            }
            const updateUI = () => {
                Object.values(counters).forEach(counter => counter.update());
                cardImages.forEach((image, index) => {
                    image.setTexture(getCardKey(state.dayCards[index]));
                    image.setTint(getCardTint(index, false));
                });
                cardHints.forEach((hint, index) => {
                    const delta = getDelta(index, state);
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
                }).on(Phaser.Input.Events.POINTER_OVER, () => {
                    cardImage.setTint(getCardTint(i, true));
                    this.input.setDefaultCursor("pointer");
                    if (!state.used[i]) {
                        const delta = getDelta(i, state);
                        for (const resource of Object.keys(delta) as (keyof Resources)[]) {
                            counters[resource].update(state[resource] + delta[resource]);
                        }
                    }
                }).on(Phaser.Input.Events.POINTER_OUT, () => {
                    cardImage.setTint(getCardTint(i, false));
                    this.input.setDefaultCursor("default");
                    Object.values(counters).forEach(counter => counter.update());
                });
                cardImages.push(cardImage);

                cardHints.push(
                    this.add.text(cardImage.x, cardImage.y + cardHeight / 2, "",
                        { ...textStyle, fontSize: hintFontSize }
                    ).setOrigin(0.5, 0)
                );
            }

            const recuperateButton = addButton(
                this,
                gameWidth * 0.25,
                gameHeight * 0.85,
                `${emoji.energy} Recuperate`,
                () => send({ type: "Recuperate" }),
                () => {
                    counters.actionPoints.update(state.actionPoints - 1);
                    counters.energy.update(state.energy + 1);
                },
                () => Object.values(counters).forEach(counter => counter.update()),
            );
            const freelanceButton = addButton(
                this,
                gameWidth * 0.75,
                gameHeight * 0.85,
                `${emoji.money} Freelance`,
                () => send({ type: "Freelance" }),
                () => {
                    counters.actionPoints.update(state.actionPoints - 1);
                    counters.money.update(state.money + 1);
                },
                () => Object.values(counters).forEach(counter => counter.update()),
            );
        },
        update() {},
    }
});

function addCounter(scene: Phaser.Scene, x: number, y: number, label: string, getter: () => number) {
    const withoutPreview = () => `${label}: ${getter()}`;
    const text = scene.add.text(x, y, withoutPreview(), textStyle);
    return {
        update(previewValue?: number) {
            let contents = withoutPreview();
            if (previewValue !== undefined && previewValue !== getter()) {
                contents += ` → ${previewValue}`;
            }
            text.setText(contents);
        },
    };
}

function addButton(scene: Phaser.Scene, x: number, y: number, label: string,
                   onClick: () => void, onPointerOver: () => void, onPointerOut: () => void) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
        ...textStyle,
        backgroundColor: buttonBgColor,
        padding: buttonPadding,
    };
    const text = scene.add.text(x, y, label, style)
        .setInteractive()
        .on(Phaser.Input.Events.POINTER_DOWN, onClick)
        .on(Phaser.Input.Events.POINTER_OVER, () => {
            text.setTint(hoveredButtonTint);
            scene.input.setDefaultCursor("pointer");
            onPointerOver();
        })
        .on(Phaser.Input.Events.POINTER_OUT, () => {
            text.setTint(0xFFFFFF);
            scene.input.setDefaultCursor("default");
            onPointerOut();
        })
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