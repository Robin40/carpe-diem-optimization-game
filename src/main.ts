import Phaser from "phaser";

new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload() {
            this.load.svg("1B", "cards/1B.svg");
        },
        create() {
            this.add.image(400, 300, "1B");
        },
        update() {},
    }
});