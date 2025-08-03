import Phaser from "phaser";
import {
    type Action, apply,
    type Card, type CarpeDiemEvent,
    generateDeck, getDelta, getLacks,
    newGameState, type Resources, type State,
} from "./model.ts";

type Dimensions = {
    gameWidth: number;
    gameHeight: number;
    cardWidth: number;
    cardHeight: number;
    gapX: number;
    defaultFontSize: number;
    hintFontSize: number;
};

// Configuration
const CONFIG = {
    dimensions: (gameWidth: number, gameHeight: number): Dimensions => {
        const cardAspectRatio = Math.sqrt(2);
        const portraitCardWidth = gameWidth * 0.22;
        const portraitCardHeight = portraitCardWidth * cardAspectRatio;
        const landscapeCardHeight = gameHeight / 3;

        const portraitDefaultFontSize = gameWidth * 0.055;
        const landscapeDefaultFontSize = gameHeight * 0.058;
        const portraitHintFontSize = gameWidth * 0.048;
        const landscapeHintFontSize = gameHeight * 0.035;

        return {
            gameWidth,
            gameHeight,
            get cardHeight(){ return Math.min(portraitCardHeight, landscapeCardHeight); },
            get cardWidth() { return this.cardHeight / cardAspectRatio; },
            get gapX() { return this.gameWidth / 80; },
            get defaultFontSize() { return Math.min(portraitDefaultFontSize, landscapeDefaultFontSize); },
            get hintFontSize() { return Math.min(portraitHintFontSize, landscapeHintFontSize) },
        };
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
        lineHeight: 1.2,
    },
    timing: {
        initialDelay: 200,
        autoEndDayDelay: 500,
    }
};

interface SceneOptionalMethods {
    init?: Phaser.Types.Scenes.SceneInitCallback;
    preload?: Phaser.Types.Scenes.ScenePreloadCallback;
    create?: Phaser.Types.Scenes.SceneCreateCallback;
    update?: Phaser.Types.Scenes.SceneUpdateCallback;
}

class GameScene extends Phaser.Scene implements SceneOptionalMethods {
    private readonly state: State;
    private preview?: { delta: Resources; cardIndex?: number };
    private views: View[] = [];

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
        const reference = CONFIG.dimensions(1900, 1080);
        for (const card of generateDeck()) {
            const key = getCardKey(card);
            this.load.svg(key, `cards/${key}.svg`, {
                width: reference.cardWidth,
                height: reference.cardHeight,
            });
        }
    }

    create() {
        this.createUI();

        // Initial update after a short delay
        this.time.delayedCall(CONFIG.timing.initialDelay, () => this.updateUI());

        this.scale.on('resize', this.resize, this);
        document.body.style.backgroundColor = CONFIG.colors.gameBg;
    }

    private resize() {
        this.positionElements();
    }

    private createUI() {
        const { emoji } = CONFIG;

        // Create counters
        this.counters = {
            day: new Counter(this, 0, "Day", () => this.state.day),
            victoryPoints: new Counter(this, 1, "Victory Points", () => this.state.victoryPoints,
                () => this.getPreviewValue("victoryPoints")),
            energy: new Counter(this, 2, "Energy", () => this.state.energy,
                () => this.getPreviewValue("energy")),
            money: new Counter(this, 3, "Money", () => this.state.money,
                () => this.getPreviewValue("money")),
            actionPoints: new Counter(this, 4, "Time", () => this.state.actionPoints,
                () => this.getPreviewValue("actionPoints")),
        };

        // Create cards
        this.createCards();

        // Create action buttons
        this.recuperateButton = new Button(
            this,
            dims => dims.gameWidth * 0.25,
            dims => dims.gameHeight * 0.85,
            `${emoji.energy} Recuperate`,
            () => this.sendAction({ type: "Recuperate" }),
            () => this.setPreview({ delta: { actionPoints: -1, energy: 1, money: 0, victoryPoints: 0 } }),
            () => this.setPreview(undefined)
        );

        this.freelanceButton = new Button(
            this,
            dims => dims.gameWidth * 0.75,
            dims => dims.gameHeight * 0.85,
            `${emoji.money} Freelance`,
            () => this.sendAction({ type: "Freelance" }),
            () => this.setPreview({ delta: { actionPoints: -1, money: 1, energy: 0, victoryPoints: 0 } }),
            () => this.setPreview(undefined)
        );

        // Position everything initially
        this.views = [
            ...Object.values(this.counters),
            ...this.cardViews,
            this.recuperateButton,
            this.freelanceButton,
        ];
        this.positionElements();
    }

    private positionElements(): void {
        const dims = CONFIG.dimensions(this.scale.width, this.scale.height);
        this.views.forEach(view => view.updatePosition(dims));
    }

    private createCards() {
        for (let i = 0; i < this.state.dayCards.length; i++) {
            const cardView = new CardView(this,
                dims => dims.gameWidth / 2 + (i - (this.state.dayCards.length - 1) / 2) * (dims.cardWidth + dims.gapX),
                dims => dims.gameHeight * 0.45,
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

interface View {
    updatePosition(dims: Dimensions): void;
}

// UI Component Classes
class Counter implements View {
    private text: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        private gridItemIndex: number,
        private label: string,
        private getCurrent: () => number,
        private getPreview?: () => number | undefined
    ) {
        this.text = scene.add.text(0, 0, this.getDisplayText(), {
            fontFamily: CONFIG.text.fontFamily,
        });
    }

    updatePosition(dims: Dimensions): void {
        const columns = dims.gameWidth / dims.gameHeight < 0.6 ? 1 : 2;
        const col = this.gridItemIndex % columns;
        const row = Math.floor(this.gridItemIndex / columns);
        const fontSize = columns === 2 ? dims.defaultFontSize : dims.defaultFontSize * 1.5;
        this.text.setX(col === 0 ? dims.gapX : dims.gameWidth * 0.4);
        this.text.setY(row * fontSize * CONFIG.text.lineHeight);
        this.text.setFontSize(fontSize);
    }

    update(): void {
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

class CardView implements View {
    private image: Phaser.GameObjects.Image;
    private hint: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        private getX: (dims: Dimensions) => number,
        private getY: (dims: Dimensions) => number,
        private getCard: () => Card,
        onClick: () => void,
        onPointerOver: () => void,
        onPointerOut: () => void,
        private getTint: () => number
    ) {
        this.image = scene.add.image(0, 0, getCardKey(this.getCard()))
            .setInteractive()
            .on(Phaser.Input.Events.POINTER_UP, onClick)
            .on(Phaser.Input.Events.POINTER_OVER, onPointerOver)
            .on(Phaser.Input.Events.POINTER_OUT, onPointerOut);

        this.hint = scene.add.text(0, 0, "", {
            fontFamily: CONFIG.text.fontFamily,
        }).setOrigin(0.5, 0);
    }

    updatePosition(dims: Dimensions): void {
        this.image.setX(this.getX(dims));
        this.image.setY(this.getY(dims));
        this.image.setDisplaySize(dims.cardWidth, dims.cardHeight);
        this.hint.setX(this.getX(dims));
        this.hint.setY(this.getY(dims) + dims.cardHeight / 2);
        this.hint.setFontSize(dims.hintFontSize);
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

class Button implements View {
    private text: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        private getX: (dims: Dimensions) => number,
        private getY: (dims: Dimensions) => number,
        label: string,
        onClick: () => void,
        onPointerOver: () => void,
        onPointerOut: () => void
    ) {
        const style: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: CONFIG.text.fontFamily,
            backgroundColor: CONFIG.colors.buttonBg,
        };

        this.text = scene.add.text(0, 0, label, style)
            .setInteractive()
            .on(Phaser.Input.Events.POINTER_UP, onClick)
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

    updatePosition(dims: Dimensions): void {
        this.text.setX(this.getX(dims));
        this.text.setY(this.getY(dims));
        this.text.setFontSize(dims.defaultFontSize);
        this.text.setPadding(dims.defaultFontSize, dims.defaultFontSize * 0.1);
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
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: document.body,
        width: "100%",
        height: "100%",
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: CONFIG.colors.gameBg,
    scene: GameScene,
    // render: {
    //     pixelArt: true,
    // },
});
