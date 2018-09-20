class nagbe {
    constructor() {
        this.clockSpeed = 4194304; // Hz, double speed for GBC mode.
        this.clockMultiplier = 1; // Default to 1x multiplier for DMG clock speed.

        this.frameIntervalDelay = 16; // 1/60s = ~16ms

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

    start(runToInstruction) {
        if (!this.cartridge) {
            console.error(`No cartridge loaded!`);
            return;
        }

        // Initialize components.
        this.cpu = new LR35902(this);
        this.mmu = new MMU(this);
        this.gpu = new GPU(this);
        this.serial = new Serial(this);
        this.apu = new APU(this);
        this.timer = new Timer(this);
        this.joypad = new Joypad(this);

        // Set starting register values.
        if (this.cartridge.colorGameboyFlag) {
            this.cpu.setAF(0x1180);
            this.cpu.setBC(0x0000);
            this.cpu.setDE(0xFF56);
            this.cpu.setHL(0x000D);
        }
        else {
            this.cpu.setAF(0x01B0);
            this.cpu.setBC(0x0013);
            this.cpu.setDE(0x00D8);
            this.cpu.setHL(0x014D);
        }           
        
        this.cpu.register.pc = 0x0100;
        this.cpu.register.sp = 0xFFFE;        

        if (!this.frameInterval) {
            this.frameInterval = setInterval(() => { this.frame(runToInstruction); }, this.frameIntervalDelay);
        } else {            
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
    }

    stop() {
        clearInterval(this.frameInterval);
        this.frameInterval = null;
    }

    resume(runToInstruction) {
        if (!this.frameInterval)
            this.frameInterval = setInterval(() => { this.frame(runToInstruction); }, this.frameIntervalDelay);
    }

    frame(runToInstruction) {
        let baseFrameCycleLimit = 70224;
        let frameClockLimit = this.cpuClock + (baseFrameCycleLimit * this.clockMultiplier);

        do {
            if (runToInstruction && this.cpu.register.pc === runToInstruction) {
                this.stop();
                console.log(`DEBUG: Stop address reached: ${runToInstruction.toHex(4)}`);
                break;
            }

            try {
                this.step();
            } catch (error) {
                console.log(error);
                this.stop();
                throw error;
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
        this.checkInterrupts();
        this.cpu.step();
    }

    consumeClockCycles(cycles) {        
        this.cpuClock += cycles;
        
        this.gpu.step(cycles);
        this.timer.tick(cycles);
    }

    requestInterrupt(id) {
        this.mmu.writeByte(0xFF0F, this.mmu.readByte(0xFF0F)|(1<<id));
    }

    checkInterrupts() {
        // Check if interrupts are enabled.
        if (!this.cpu.ime) return;

        if (!this.mmu.readByte(0xFFFF)) return; // Check if anything is allowed to interrupt.
        let interrupts = this.mmu.readByte(0xFF0F); // Get active interrupt flags.
        if (!interrupts) return; // Leave if nothing to handle.

        for (let i = 0; i < 5; i++) {
            // Check if the IE flag is set for the given interrupt.
            if (interrupts&(1<<i) && this.mmu.readByte(0xFFFF)&(1<<i)) {
                this.handleInterrupt(i);
            }
        }
    }

    handleInterrupt(interrupt) {
        this.cpu.ime = false; // Disable interrupt handling.
        this.cpu.halt = false;

        this.cpu.register.sp -= 2; // Push program counter to stack.
        this.mmu.writeWord(this.cpu.register.sp, this.cpu.register.pc);

        let interrupts = this.mmu.readByte(0xFF0F);
        interrupts &= ~(1<<interrupt); // Reset interrupt flag.
        this.mmu.writeByte(0xFF0F, interrupts);
        
        switch (interrupt) {
            case 0: this.cpu.register.pc = 0x40; break; // V-blank
            case 1: this.cpu.register.pc = 0x48; break; // LCD
            case 2: this.cpu.register.pc = 0x50; break; // Timer
            case 3: this.cpu.register.pc = 0x58; break; // Serial
            case 4: this.cpu.register.pc = 0x60; break; // Joypad
        }

        this.consumeClockCycles(20);
    }
}