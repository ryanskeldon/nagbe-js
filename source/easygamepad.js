"use strict";

class EasyGamepad {
    constructor(pollingInterval) {
        // Polling interval in milliseconds. Default to 100ms.
        this.pollingInterval = pollingInterval | 100;

        this.knownGamepads = [];        
        this.listener = null;

        this.eventListeners = [];

        window.addEventListener("gamepadconnected", (e) => {
            console.log(`Gamepad connected: ${e.gamepad.id}`);
            this._registerGamepad(e.gamepad);
        });

        this._startListener();
    }

    _registerGamepad(gamepad) {        
        // Check if gamepad is already registered.
        let knownGamepad = this.knownGamepads.find(item => item.index === gamepad.index);
        console.log("Registering gamepad...");
        if (!knownGamepad) {
            // Gamepad hasn't been registered.
            knownGamepad = {
                index: gamepad.index,
                id: gamepad.id,
                buttons: []
            }

            // Set initial state of buttons.
            for (let b = 0; b < gamepad.buttons.length; b++) {                
                knownGamepad.buttons[b] = gamepad.buttons[b].pressed;
            }

            this.knownGamepads.push(knownGamepad);

            console.log(`Gamepad registered`, this.knownGamepads);
        }
    }

    getConnectedGamepads() {
        const gamepads = navigator.getGamepads();

        if (!gamepads) return [];
        
        const connectedGamepads = [];
        for (let i = 0; i < gamepads.length; i++) {
            if (!!gamepads[i]) connectedGamepads.push(gamepads[i]);
        }
        
        return connectedGamepads;
    }

    addEventListener(gamepadIndex, callback) {
        this._stopListener();

        this.eventListeners.push({
            gamepadIndex: gamepadIndex,
            callback: callback
        });

        console.log(`Callback added`);
        this._startListener();
    }

    _startListener() {
        if (this.listener) return; // Listener already initialized.

        this.listener = setInterval(() => {
            this.getConnectedGamepads().forEach((gamepad) => {
                const knownGamepad = this.knownGamepads.find(item => item.index === gamepad.index);

                for (let b = 0; b < gamepad.buttons.length; b++) {
                    if (gamepad.buttons[b].pressed !== knownGamepad.buttons[b]) {
                        // The button state changed. Notify all callbacks.
                        const callbacks = this.eventListeners.filter(item => item.gamepadIndex === gamepad.index);
                        callbacks.forEach(item => item.callback({
                            gamepadId: knownGamepad.id,
                            gamepadIndex: knownGamepad.index,
                            buttonId: b,
                            buttonPressed: gamepad.buttons[b].pressed
                        }));

                        // Set new state of button.
                        knownGamepad.buttons[b] = gamepad.buttons[b].pressed;
                    }
                }
            });
        }, this.pollingInterval);
    }

    _stopListener() {
        clearInterval(this.listener);
        this.listener = null;
    }
}