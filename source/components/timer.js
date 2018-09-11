"use strict";

class Timer {
    constructor(system) {
        this.system = system;

        this.frequency = 4096;
        this.counter = 0;

        this.register = {
            div:  0, // 0xFF04 (r/w) Divider 16-bit MSB is actual value
            tima: 0, // 0xFF05 (r/w) Timer counter
            tma:  0, // 0xFF06 (r/w) Timer modulo
            tac:  0, // 0xFF07 (r/w) Timer control
        }
    }

    readByte(address) {
        switch (address) {
            case 0xFF04: return this.register.div>>8;
            case 0xFF05: return this.register.tima;
            case 0xFF06: return this.register.tma;
            case 0xFF07: return this.register.tac|0xF8;                
        }
    }

    writeByte(address, byte) {
        switch (address) {
            case 0xFF04: this.register.div = 0; return;
            case 0xFF05: this.register.tima = byte; return;
            case 0xFF06: this.register.tma = byte; return;
            case 0xFF07: this.updateFrequency(byte); return;
        }
    }

    isClockEnabled() {
        return !!(this.register.tac&0x04);
    }

    updateFrequency(data) {
        let currentFrequency = this.register.tac&0x03;
        this.register.tac = data;
        let newFrequency = this.register.tac&0x03;

        if (currentFrequency != newFrequency) {
            // console.log(`Frequency adjusted to MOD ${newFrequency}`);
            switch (newFrequency) {
                case 0: this.frequency = 4096; break;
                case 1: this.frequency = 262144; break;
                case 2: this.frequency = 65536; break;
                case 3: this.frequency = 16386; break;
            }
        }
    }

    tick(cycles) {
        this.register.div = (this.register.div+cycles)&0xFFFF;

        if (!this.isClockEnabled()) return;

        this.counter += cycles;
        let interval = this.system.clockSpeed / this.frequency;

        while (this.counter >= interval) {
            this.counter -= interval;

            // Did timer overflow?
            if (this.register.tima == 0xFF) {
                this.register.tima = this.register.tma;
                this.system.requestInterrupt(2);
            } else {
                this.register.tima = (this.register.tima+1)&0xFF;
            }
        }
    }
}