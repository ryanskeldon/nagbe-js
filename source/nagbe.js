nagbe = {
    _buttons: [
        "l", // Right
        "j", // Left
        "i", // Up
        "k", // Down
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
    },    

    dumpMemory: function (startAddress, size) {
        for (let i = size-1; i > 0; i--) {
            let word = `${MMU.readByte(startAddress+i).toHex(2)}`;i--;
            let address = startAddress+i;
            word += `${MMU.readByte(startAddress+i).toHex(2)}`;
            console.log(`${(address).toHex(4)} ${word}`);
        }
    }
};

nagbe.init();