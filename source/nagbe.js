class nagbe {
    constructor() {
        this.clockSpeed = 4194304; // Hz, double speed for GBC mode.
        this.clockMultiplier = 1; // Default to 1x multiplier for DMG clock speed.

        // Load any previously saved ROMs.
        let rom = localStorage.getItem(`ROM`);

        if (rom) {
            console.log(`Cartridge ROM found in local storage.`);
            this.cartridge = new Cartridge(rom.split(",").map(value => { return parseInt(value); }));
        }
    }

    loadFile(file) {
        let fileReader = new FileReader();
        fileReader.onload = (e) => {
            this.cartridge = new Cartridge(new Uint8Array(e.target.result));
            localStorage.setItem(`ROM`, this.cartridge.rom);
        };
        fileReader.readAsArrayBuffer(file);
    }

    start() {
        if (!this.cartridge) {
            console.error(`No cartridge loaded!`);
            return;
        }

        // Initialize components.
        this.cpu = new LR35902(this);
        this.mmu = new MMU(this);

        // Set starting register values.
        if (this.cartridge.colorGameboyFlag) 
            this.cpu.register.a = 0x11;
        else
            this.cpu.register.a = 0x01;

        this.cpu.register.f = 0xB0;
        this.cpu.register.b = 0x00;
        this.cpu.register.c = 0x13;
        this.cpu.register.d = 0x00;
        this.cpu.register.e = 0xD8;
        this.cpu.register.h = 0x01;
        this.cpu.register.l = 0x4D;
        this.cpu.register.pc = 0x100;
        this.cpu.register.sp = 0xFFFE;

        if (!this.frameInterval) {
            this.frameInterval = setInterval(() => { this.frame(); }, 1);
        } else {
            //traceLog.write("Z80", "$0x" + (Z80._register.pc).toString(16));
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
    }

    stop() {
        clearInterval(this.frameInterval);
        this.frameInterval = null;
    }

    frame() {
        let baseFrameCycleLimit = 70224;
        let frameClockLimit = this.cpuClock + (baseFrameCycleLimit * this.clockMultiplier);

        do {
            try {
                // Step emulator
                this.step();
            } catch (error) {
                console.log(error);
                this.stop();
                break;
            }
        } while (this.cpuClock < frameClockLimit);

        // Frame complete, reset CPU clock.
        this.cpuClock = 0;

        // Save RAM to local storage if there's a battery in the cartridge.
        if (this.cartridge.hasBattery && this.cartridge.ramIsDirty) {
            // TODO: Save RAM to local storage.
            this.cartridge.ramIsDirty = false;
        }
    }

    step() {
        this.cpu.step();
    }

    // _buttons: [
    //     "l", // Right
    //     "j", // Left
    //     "i", // Up
    //     "k", // Down
    //     "f", // A
    //     "d", // B
    //     "e", // Select
    //     "r", // Start
    // ],

    // init: function () {
    //     document.getElementById("screen").addEventListener("keydown", function (event) {
    //         if (nagbe._buttons.includes(event.key)) {
    //             Joypad.button_press(nagbe._buttons.indexOf(event.key));
    //         }
    //     }, false);

    //     document.getElementById("screen").addEventListener("keyup", function (event) {
    //         if (nagbe._buttons.includes(event.key)) {
    //             Joypad.button_release(nagbe._buttons.indexOf(event.key));
    //         }
    //     }, false);
    // },    
}