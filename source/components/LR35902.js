"use strict";

class LR35902 {
    constructor(system) {
        this.system = system; // Reference to the emulator system.        

        // Create registers.
        this.register = {
            // 8-bit registers
            a: 0, f: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0,

            // 16-bit registers
            pc: 0, sp: 0
        }

        // Flags
        this.halt = false;
        this.stop = false;
        this.ime;

        // Clock
        this.instructionCycles = 0;
    }

    step() {
        if (this.register.pc < 0x0000 || this.register.pc > 0xFFFF)
            throw `Program counter out of range.`;

        if (this.halt) {
            // CPU is "powered down". Only wake up if there's an interrupt.
            this.instructionCycles = 4;
        } else {
            let programCounter = this.register.pc++;
            this.instructionCode = this.system.mmu.readByte(programCounter);
            console.log(`PC: $${programCounter.toHex(4)}`);
            let instruction = this.decodeInstruction(this.instructionCode);
            instruction();
        }
    }

    decodeInstruction(code) {
        let instruction = null;

        switch (code) {
            case 0xC3:
                instruction = () => { this.JP_nn() }; break;
            case 0x7F: case 0x78: case 0x79: case 0x7A: case 0x7B: case 0x7C: case 0x7D: case 0x0A: case 0x1A: case 0x7E: case 0x3E: case 0xFA:
                instruction = () => { this.LD_A_n() }; break;
            case 0x01: case 0x11: case 0x21: case 0x31: 
                instruction = () => { this.LD_n_nn() }; break;
            case 0x00:
                instruction = () => { this.NOP() }; break;
            case 0xAF: case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xEE:
                instruction = () => { this.XOR_n() }; break;
        }        
        
        if (instruction == null) 
            throw `Instruction 0x${code.toHex(2)} not found`;

        return instruction;
    }

    // Flag Helpers
    setZ() { this.register.f |= 0x80; }
    setN() { this.register.f |= 0x40; }
    setH() { this.register.f |= 0x20; }
    setC() { this.register.f |= 0x10; }
    clearZ() { this.register.f &= ~0x80; }
    clearN() { this.register.f &= ~0x40; }
    clearH() { this.register.f &= ~0x20; }
    clearC() { this.register.f &= ~0x10; }

    //*************************************************************************
    // Instructions
    //*************************************************************************
    JP_nn() {
        this.register.pc = this.system.mmu.readWord(this.register.pc);
        this.instructionCycles = 16;
    }

    LD_A_n() {
        let value = null;
        
        switch (this.instructionCode) {
            case 0x7F: // LD A, A
                value = this.register.a; this.instructionCycles = 4; break;
            case 0x78: // LD A, B
                value = this.register.b; this.instructionCycles = 4; break;
            case 0x79: // LD A, C
                value = this.register.c; this.instructionCycles = 4; break;
            case 0x7A: // LD A, D
                value = this.register.d; this.instructionCycles = 4; break;
            case 0x7B: // LD A, E
                value = this.register.e; this.instructionCycles = 4; break;
            case 0x7C: // LD A, H
                value = this.register.h; this.instructionCycles = 4; break;
            case 0x7D: // LD A, L
                value = this.register.l; this.instructionCycles = 4; break;
            case 0x0A: // LD A, (BC)
                value = this.system.mmu.readByte((this.register.b<<8)+this.register.c); this.instructionCycles = 8; break;
            case 0x1A: // LD A, (DE)
                value = this.system.mmu.readByte((this.register.d<<8)+this.register.e); this.instructionCycles = 8; break;
            case 0x7E: // LD A, (HL)
                value = this.system.mmu.readByte((this.register.h<<8)+this.register.l); this.instructionCycles = 8; break;
            case 0x3E: // LD A, n
                value = this.system.mmu.readByte(this.register.pc++); this.instructionCycles = 8; break;
            case 0xFA: // LD A, (nn)
                value = this.system.mmu.readByte(this.system.mmu.readWord(this.register.pc)); this.register.pc+=2; this.instructionCycles = 16; break;
        }

        this.register.a = value;
    }

    LD_n_nn() {
        let word = this.system.mmu.readWord(this.register.pc);
        this.register.pc+=2;

        switch (this.instructionCode) {
            case 0x01: // LD BC, nn
                this.register.b = (word>>8)&0xFF; this.register.c = word&0xFF; break;
            case 0x11: // LD DE, nn
                this.register.d = (word>>8)&0xFF; this.register.e = word&0xFF; break;
            case 0x21: // LD HL, nn
                this.register.h = (word>>8)&0xFF; this.register.l = word&0xFF; break;
            case 0x31: // LD SP, nn
                this.register.sp = word; break;
        }

        this.instructionCycles = 12;
    }

    NOP() {
        this.instructionCycles = 4;
    }

    XOR_n() {
        let value = null;

        switch (this.instructionCode) {
            case 0xAF: // XOR A
                value = this.register.a; this.instructionCycles = 4; break;
            case 0xA8: // XOR B
                value = this.register.b; this.instructionCycles = 4; break;
            case 0xA9: // XOR C
                value = this.register.c; this.instructionCycles = 4; break;
            case 0xAA: // XOR D
                value = this.register.d; this.instructionCycles = 4; break;
            case 0xAB: // XOR E
                value = this.register.e; this.instructionCycles = 4; break;
            case 0xAC: // XOR H
                value = this.register.h; this.instructionCycles = 4; break;
            case 0xAD: // XOR L
                value = this.register.l; this.instructionCycles = 4; break;
            case 0xAE: // XOR (HL)
                value = this.system.mmu.readByte((this.register.h<<8)+this.register.l); this.instructionCycles = 8; break;
            case 0xEE: // XOR n
                value = this.system.mmu.readByte(this.register++); this.instructionCycles = 8; break;
        }

        this.register.a ^= value;
        this.register.a &= 0xFF;

        if (!this.register.a) this.setZ(); else this.clearZ();
        this.clearN(); this.clearH(); this.clearC();
    }
}