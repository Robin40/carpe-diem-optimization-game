import Phaser from "phaser";
import {
    type Action, apply,
    type Card, type CarpeDiemEvent,
    generateDeck, getDelta, getLacks,
    newGameState, type Resources, type State,
} from "./model.ts";

// Configuration
const CONFIG = {
    dimensions: {
        gameWidth: window.innerWidth,
        gameHeight: window.innerHeight,
        get cardHeight() { return this.gameHeight / 3; },
        get cardWidth() { return this.cardHeight / Math.sqrt(2); },
        get gapX() { return this.gameWidth / 80; },
        get defaultFontSize() { return this.gameHeight * 0.062; },
        get hintFontSize() { return this.gameHeight * 0.035; },
    },
    colors: {
        gameBg: "#192a56",
        buttonBg: "#1751e6",
        disabledCard: 0x888888,
        disabledButton: 0x888888,
        unaffordable: 0xCC8888,
        hoveredCard: 0xFFFFDD,
        hoveredButton: 0xFFFFDD,
        default: 0xFFFFFF,
        danger: "#FF0000",
        normal: "#FFFFFF",
    },
    emoji: {
        actionPoints: "⏳",
        energy: "⚡",
        money: "💰",
        victoryPoints: "🏆",
    },
    text: {
        fontFamily: "serif",
        get fontSize() { return CONFIG.dimensions.defaultFontSize; },
        lineHeight: 1.2,
    },
    timing: {
        initialDelay: 200,
        autoEndDayDelay: 500,
    }
};

type SceneOptionalMethods = {
    init?: Phaser.Types.Scenes.SceneInitCallback;
    preload?: Phaser.Types.Scenes.ScenePreloadCallback;
    create?: Phaser.Types.Scenes.SceneCreateCallback;
    update?: Phaser.Types.Scenes.SceneUpdateCallback;
}

class GameScene extends Phaser.Scene implements SceneOptionalMethods {
    private readonly state: State;
    private preview?: { delta: Resources; cardIndex?: number };

    // UI Components
    private counters: Record<string, Counter> = {};
    private cardViews: CardView[] = [];
    private recuperateButton!: Button;
    private freelanceButton!: Button;

    constructor() {
        super({ key: 'GameScene' });
        const [state] = newGameState();
        this.state = state;
    }

    preload() {
        for (const card of generateDeck()) {
            const key = getCardKey(card);
            this.load.svg(key, `cards/${key}.svg`, {
                width: CONFIG.dimensions.cardWidth,
                height: CONFIG.dimensions.cardHeight
            });
        }
    }

    create() {
        this.createUI();

        // Initial update after a short delay
        this.time.delayedCall(CONFIG.timing.initialDelay, () => this.updateUI());
    }

    private createUI() {
        const { dimensions, emoji } = CONFIG;

        // Create counters
        this.counters = {
            day: new Counter(this, dimensions.gapX, 0, "Day",
                () => this.state.day),
            victoryPoints: new Counter(this, dimensions.gameWidth / 2, 0, "Victory Points",
                () => this.state.victoryPoints,
                () => this.getPreviewValue("victoryPoints")),
            energy: new Counter(this, dimensions.gapX, dimensions.defaultFontSize * CONFIG.text.lineHeight, "Energy",
                () => this.state.energy,
                () => this.getPreviewValue("energy")),
            money: new Counter(this, dimensions.gameWidth / 2, dimensions.defaultFontSize * CONFIG.text.lineHeight, "Money",
                () => this.state.money,
                () => this.getPreviewValue("money")),
            actionPoints: new Counter(this, dimensions.gapX, dimensions.defaultFontSize * CONFIG.text.lineHeight * 2, "Time",
                () => this.state.actionPoints,
                () => this.getPreviewValue("actionPoints")),
        };

        // Create cards
        this.createCards();

        // Create action buttons
        this.recuperateButton = new Button(
            this,
            dimensions.gameWidth * 0.25,
            dimensions.gameHeight * 0.85,
            `${emoji.energy} Recuperate`,
            () => this.sendAction({ type: "Recuperate" }),
            () => this.setPreview({ delta: { actionPoints: -1, energy: 1, money: 0, victoryPoints: 0 } }),
            () => this.setPreview(undefined)
        );

        this.freelanceButton = new Button(
            this,
            dimensions.gameWidth * 0.75,
            dimensions.gameHeight * 0.85,
            `${emoji.money} Freelance`,
            () => this.sendAction({ type: "Freelance" }),
            () => this.setPreview({ delta: { actionPoints: -1, money: 1, energy: 0, victoryPoints: 0 } }),
            () => this.setPreview(undefined)
        );
    }

    private createCards() {
        const { dimensions } = CONFIG;

        for (let i = 0; i < this.state.dayCards.length; i++) {
            const x = dimensions.gameWidth / 2 + (i - (this.state.dayCards.length - 1) / 2) * (dimensions.cardWidth + dimensions.gapX);
            const y = dimensions.gameHeight * 0.45;

            const cardView = new CardView(this, x, y,
                () => this.state.dayCards[i],
                () => this.sendAction({ type: "UseCard", index: i }),
                () => this.handleCardHover(i, true),
                () => this.handleCardHover(i, false),
                () => this.getCardTint(i, false)
            );

            this.cardViews.push(cardView);
        }
    }

    private sendAction(action: Action) {
        const event = apply(action, this.state);
        this.handleEvent(event);

        if (this.state.actionPoints === 0 && !this.state.gameEnded) {
            this.time.delayedCall(CONFIG.timing.autoEndDayDelay, () => {
                this.sendAction({ type: "EndDay" });
            });
        }

        this.updateUI();
    }

    private handleEvent(event: CarpeDiemEvent) {
        switch (event.type) {
            case "DayEnd":
                if (!this.state.gameEnded) {
                    this.sendAction({ type: "BeginNextDay" });
                }
                break;
        }
    }

    private handleCardHover(index: number, isHovering: boolean) {
        const cardView = this.cardViews[index];
        cardView.setTint(this.getCardTint(index, isHovering));
        this.input.setDefaultCursor(isHovering ? "pointer" : "default");

        if (isHovering && !this.state.used[index]) {
            this.setPreview({ delta: getDelta(index, this.state), cardIndex: index });
        } else if (!isHovering) {
            this.setPreview(undefined);
        }
    }

    private setPreview(preview?: { delta: Resources; cardIndex?: number }) {
        this.preview = preview;
        Object.values(this.counters).forEach(counter => counter.update());
    }

    private getPreviewValue(resource: keyof Resources): number | undefined {
        if (!this.preview) return undefined;
        if (this.preview.cardIndex !== undefined && this.state.used[this.preview.cardIndex]) return undefined;
        return this.state[resource] + this.preview.delta[resource];
    }

    private getCardTint(index: number, hovered: boolean): number {
        const { colors } = CONFIG;
        const delta = getDelta(index, this.state);
        const lacks = getLacks(delta, this.state);

        if (this.state.used[index]) return colors.disabledCard;
        if (lacks) return colors.unaffordable;
        if (hovered) return colors.hoveredCard;
        return colors.default;
    }

    private updateUI() {
        // Update counters
        Object.values(this.counters).forEach(counter => counter.update());

        // Update cards
        this.cardViews.forEach((cardView, index) => {
            cardView.update(this.state.used[index], getDelta(index, this.state));
        });

        // Update buttons
        const canAct = this.state.actionPoints >= 1;
        this.recuperateButton.setEnabled(canAct);
        this.freelanceButton.setEnabled(canAct);
    }
}

// UI Component Classes
class Counter {
    private text: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        private label: string,
        private getCurrent: () => number,
        private getPreview?: () => number | undefined
    ) {
        this.text = scene.add.text(x, y, this.getDisplayText(), {
            fontFamily: CONFIG.text.fontFamily,
            fontSize: CONFIG.text.fontSize,
        });
    }

    update() {
        this.text.setText(this.getDisplayText());
        const value = this.getPreview?.() ?? this.getCurrent();
        this.text.setColor(value < 0 ? CONFIG.colors.danger : CONFIG.colors.normal);
    }

    private getDisplayText(): string {
        let contents = `${this.label}: ${this.getCurrent()}`;
        const currentValue = this.getCurrent();
        const previewValue = this.getPreview?.();

        if (previewValue !== undefined && previewValue !== currentValue) {
            contents += ` → ${previewValue}`;
        }

        return contents;
    }
}

class CardView {
    private image: Phaser.GameObjects.Image;
    private hint: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        private getCard: () => Card,
        onClick: () => void,
        onPointerOver: () => void,
        onPointerOut: () => void,
        private getTint: () => number
    ) {
        this.image = scene.add.image(x, y, getCardKey(this.getCard()))
            .setInteractive()
            .on(Phaser.Input.Events.POINTER_DOWN, onClick)
            .on(Phaser.Input.Events.POINTER_OVER, onPointerOver)
            .on(Phaser.Input.Events.POINTER_OUT, onPointerOut);

        this.hint = scene.add.text(x, y + CONFIG.dimensions.cardHeight / 2, "", {
            fontFamily: CONFIG.text.fontFamily,
            fontSize: CONFIG.dimensions.hintFontSize,
        }).setOrigin(0.5, 0);
    }

    update(isUsed: boolean, delta: Resources) {
        this.image.setTexture(getCardKey(this.getCard()));
        this.image.setTint(this.getTint());

        const hintText = this.generateHintText(delta);
        this.hint.setText(hintText).setAlpha(isUsed ? 0.5 : 1);
    }

    setTint(tint: number) {
        this.image.setTint(tint);
    }

    private generateHintText(delta: Resources): string {
        return (Object.entries(delta) as [keyof Resources, number][])
            .filter(([resource, value]) => !(resource === "victoryPoints" && value === 0))
            .map(([resource, value]) =>
                resource === "actionPoints"
                    ? CONFIG.emoji[resource].repeat(-value)
                    : `${CONFIG.emoji[resource]} ${value}`)
            .join("\n");
    }
}

class Button {
    private text: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        onPointerOver: () => void,
        onPointerOut: () => void
    ) {
        const style: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: CONFIG.text.fontFamily,
            fontSize: CONFIG.text.fontSize,
            backgroundColor: CONFIG.colors.buttonBg,
            padding: {
                x: CONFIG.dimensions.defaultFontSize,
                y: CONFIG.dimensions.defaultFontSize * 0.1,
            },
        };

        this.text = scene.add.text(x, y, label, style)
            .setInteractive()
            .on(Phaser.Input.Events.POINTER_DOWN, onClick)
            .on(Phaser.Input.Events.POINTER_OVER, () => {
                this.text.setTint(CONFIG.colors.hoveredButton);
                scene.input.setDefaultCursor("pointer");
                onPointerOver();
            })
            .on(Phaser.Input.Events.POINTER_OUT, () => {
                this.text.setTint(CONFIG.colors.default);
                scene.input.setDefaultCursor("default");
                onPointerOut();
            })
            .setOrigin(0.5, 0);
    }

    setEnabled(enabled: boolean) {
        this.text.setTint(enabled ? CONFIG.colors.default : CONFIG.colors.disabledButton);
    }
}

function getCardKey(card: Card): string {
    return "0A23456789TJQK"[card.value] + card.suit[0];
}

// Initialize game
new Phaser.Game({
    type: Phaser.AUTO,
    width: CONFIG.dimensions.gameWidth,
    height: CONFIG.dimensions.gameHeight,
    backgroundColor: CONFIG.colors.gameBg,
    scene: GameScene,
});
