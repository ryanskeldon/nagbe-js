"use strict";

class EasyJoypad {
    constructor() {
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!!gamepad) { 
                this.gamepadIndex = gamepad.index;
                this._storeButtonState();
            }
        }        
    }

    _storeButtonState() {
        if (!this.gamepadIndex) return;

        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        this.lastButtonState = [];

        for (let i = 0; i < gamepad.buttons.length; i++) {
            this.lastButtonState.push(gamepad.buttons[i].pressed);
        }
    }

    startListener(callback) {
        if (!this.gamepadIndex) return;
        this.listener = setInterval(() => {
            const gamepad = navigator.getGamepads()[this.gamepadIndex];

            const newButtonState = gamepad.buttons;
            
            for (let i = 0; i < newButtonState.length; i++) {
                if (newButtonState[i].pressed !== this.lastButtonState[i]) {
                    callback(i, newButtonState[i].pressed);
                }
            }

            this._storeButtonState();
        }, 100);
    }

    stopListener() {
        clearInterval(this.listener);
        this.listener = null;
    }
}