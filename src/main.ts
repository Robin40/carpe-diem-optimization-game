import Phaser from "phaser";

const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;
const cardHeight = gameHeight / 3;
const cardWidth = cardHeight / Math.sqrt(2);
const gapX = gameWidth / 80;
new Phaser.Game({
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    scene: {
        preload() {
            this.load.svg("1B", "cards/1B.svg", { width: cardWidth, height: cardHeight });
        },
        create() {
            const n = 4;
            for (let i = 0; i < n; i++) {
                this.add.image(
                    gameWidth / 2 + (i - (n - 1) / 2) * (cardWidth + gapX),
                    gameHeight / 2,
                    "1B",
                );
            }
        },
        update() {},
    }
});