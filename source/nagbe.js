nagbe = {
    _buttons: [
        "ArrowRight", // Right
        "ArrowLeft", // Left
        "ArrowUp", // Up
        "ArrowDown", // Down
        "f", // A
        "d", // B
        "e", // Select
        "r", // Start
    ],

    init: function () {
        document.getElementById("screen").addEventListener("keydown", function (event) {
            if (nagbe._buttons.includes(event.key)) {
                Joypad.button_press(nagbe._buttons.indexOf(event.key));
            }
        }, false);

        document.getElementById("screen").addEventListener("keyup", function (event) {
            if (nagbe._buttons.includes(event.key)) {
                Joypad.button_release(nagbe._buttons.indexOf(event.key));
            }
        }, false);
    }
};

nagbe.init();