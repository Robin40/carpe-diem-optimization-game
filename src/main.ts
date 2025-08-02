import Phaser from "phaser";

const cardWidth = 150;
const cardHeight = 210;
const gapX = 10;
new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload() {
            this.load.svg("1B", "cards/1B.svg", { width: cardWidth, height: cardHeight });
        },
        create() {
            for (let i = 0; i < 4; i++) {
                this.add.image(400 + (i - 1.5) * (cardWidth + gapX), 300, "1B");
            }
        },
        update() {},
    }
});