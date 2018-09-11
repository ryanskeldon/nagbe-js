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

        this.pendingDisableInterrupts = 0;
        this.pendingEnableInterrupts = 0;
    }

    step() {
        if (this.register.pc < 0x0000 || this.register.pc > 0xFFFF)
            throw `Program counter out of range.`;

        if (this.halt) {
            // CPU is "powered down". Only wake up if there's an interrupt.
            this.system.consumeClockCycles(4);
        } else {
            let programCounter = this.register.pc++;
            this.instructionCode = this.system.mmu.readByte(programCounter);
            //console.log(`PC: $${programCounter.toHex(4)} / INS: 0x${this.instructionCode.toHex(2)}`);
            let instruction = this.decodeInstruction(this.instructionCode);
            instruction();
        }

        if (this.pendingEnableInterrupts) {
            if (this.pendingEnableInterrupts&0xF>0) this.pendingEnableInterrupts--;
            else { this.ime = true; this.pendingEnableInterrupts = 0; }
        }

        if (this.pendingDisableInterrupts) {
            if (this.pendingDisableInterrupts&0xF>0) this.pendingDisableInterrupts--;
            else { this.ime = false; this.pendingDisableInterrupts = 0; }
        }
    }

    decodeInstruction(code) {
        switch (code) {
            //*****************************************************************
            // Main Instructions
            //*****************************************************************
            case 0xA7: case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xE6: 
                return () => { this.AND() };
            case 0xCD:
                return () => { this.CALL_nn() };
            case 0xBF: case 0xB8: case 0xB9: case 0xBA: case 0xBB: case 0xBC: case 0xBD: case 0xBE: case 0xFE: 
                return () => { this.CP_n() };
            case 0x2F:
                return () => { this.CPL() };
            case 0x27:
                return () => { this.DAA() };
            case 0x3D: case 0x05: case 0x0D: case 0x1D: case 0x1D: case 0x25: case 0x2D: case 0x35: 
                return () => { this.DEC() };
            case 0x0B: case 0x1B: case 0x2B: case 0x3B: 
                return () => { this.DEC_nn() };
            case 0xF3:
                return () => { this.DI() };
            case 0xFB:
                return () => { this.EI() };
            case 0x3C: case 0x04: case 0x0C: case 0x14: case 0x1C: case 0x24: case 0x2C: case 0x34: 
                return () => { this.INC() };
            case 0xC3:
                return () => { this.JP_nn() };
            case 0x20: case 0x28: case 0x30: case 0x38: 
                return () => { this.JR_cc_n() };
            case 0x7F: case 0x78: case 0x79: case 0x7A: case 0x7B: case 0x7C: case 0x7D: case 0x0A: case 0x1A: case 0x7E: case 0x3E: case 0xFA:            
                return () => { this.LD_A_n() };
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46:
                return () => { this.LD_B_n() };
            case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x36:
                return () => { this.LD_HLmem_n() };
            case 0x7F: case 0x47: case 0x4F: case 0x57: case 0x5F: case 0x67: case 0x6F: case 0x02: case 0x12: case 0x77: case 0xEA: 
                return () => { this.LD_n_A() };
            case 0x01: case 0x11: case 0x21: case 0x31: 
                return () => { this.LD_n_nn() };
            case 0x06: case 0x0E: case 0x16: case 0x1E: case 0x26: case 0x2E:
                return () => { this.LD_nn_n() };
            case 0xF2:
                return () => { this.LD_A_Cmem() };
            case 0xE2:
                return () => { this.LD_Cmem_A() };
            case 0x32:
                return () => { this.LDD_HLmem_A() };
            case 0xF0:
                return () => { this.LDH_A_d8mem() };
            case 0xE0:
                return () => { this.LDH_d8mem_A() };
            case 0x2A:
                return () => { this.LDI_A_HLmem() };
            case 0x22:
                return () => { this.LDI_HLmem_A() };
            case 0x00:
                return () => { this.NOP() };
            case 0xB7: case 0xB0: case 0xB1: case 0xB2: case 0xB3: case 0xB4: case 0xB5: case 0xB6: case 0xF6: 
                return () => { this.OR() };
            case 0xC9:
                return () => { this.RET() };
            case 0xC7: case 0xCF: case 0xD7: case 0xDF: case 0xE7: case 0xEF: case 0xF7: case 0xFF: 
                return () => { this.RST() };
            case 0xAF: case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xEE:
                return () => { this.XOR_n() };
                
            //*****************************************************************
            // CB Instructions
            //*****************************************************************
            case 0xCB:
                return () => { this.CB() };
            case 0xCB37: case 0xCB30: case 0xCB31: case 0xCB32: case 0xCB33: case 0xCB34: case 0xCB35: case 0xCB36: 
                return () => { this.SWAP() };
        }        
        
        throw `Instruction 0x${code.toHex(2)} not found`;
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

    // Register Helpers
    getAF() { return (this.register.a<<8)+this.register.f; }
    getBC() { return (this.register.b<<8)+this.register.c; }
    getDE() { return (this.register.d<<8)+this.register.e; }
    getHL() { return (this.register.h<<8)+this.register.l; }

    //*************************************************************************
    // Main Instructions
    //*************************************************************************
    AND() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xA7: // AND A
                value = this.register.a; cycles = 4; break;
            case 0xA0: // AND B
                value = this.register.b; cycles = 4; break;
            case 0xA1: // AND C
                value = this.register.c; cycles = 4; break;
            case 0xA2: // AND D
                value = this.register.d; cycles = 4; break;
            case 0xA3: // AND E
                value = this.register.e; cycles = 4; break;
            case 0xA4: // AND H
                value = this.register.h; cycles = 4; break;
            case 0xA5: // AND L
                value = this.register.l; cycles = 4; break;
            case 0xA6: // AND (HL)
                value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xE6: // AND n
                value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        this.register.a = (this.register.a&value)&0xFF;
        if (!this.register.a) this.setZ(); else this.clearZ();
        this.clearN(); this.setH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    CALL_nn() {
        this.register.sp-=2;
        this.system.mmu.writeWord(this.register.sp, this.register.pc+2);
        this.register.pc = this.system.mmu.readWord(this.register.pc);
        this.system.consumeClockCycles(24);
    }

    CP_n() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xBF: // CP A
                value = this.register.a; cycles = 4; break;
            case 0xB8: // CP B
                value = this.register.b; cycles = 4; break;
            case 0xB9: // CP C
                value = this.register.c; cycles = 4; break;
            case 0xBA: // CP D
                value = this.register.d; cycles = 4; break;
            case 0xBB: // CP E
                value = this.register.e; cycles = 4; break;
            case 0xBC: // CP H
                value = this.register.h; cycles = 4; break;
            case 0xBD: // CP L
                value = this.register.l; cycles = 4; break;
            case 0xBE: // CP (HL)
                value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xFE: // CP d8
                value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        let result = this.register.a - value;
        if ((result&0xFF) === 0) this.setZ(); else this.clearZ();
        this.setN();
        if (this.register.a < result) this.setC(); else this.clearC();
        if ((this.register.a&0xF) < (result&0xF)) this.setH(); else this.clearH();

        this.system.consumeClockCycles(cycles);
    }

    CPL() {
        this.setN(); this.setH();
        this.register.a ^= 0xFF;
        this.system.consumeClockCycles(4);
    }

    DAA() {
        let correction = 0;
        let flagN = !!(this.register.f&0x40);
        let flagH = !!(this.register.f&0x20);
        let flagC = !!(this.register.f&0x10);

        if (flagH || (!flagN && (this.register.a & 0xF) > 9))
            correction = 6;

        if (flagC || (!flagN && this.register.a > 0x99)) {
            correction |= 0x60;
            this.setC();
        }

        this.register.a += flagN ? -correction : correction;
        this.register.a &= 255;
        this.clearH();

        if (!this.register.a) this.setZ(); else this.clearZ();
        this.system.consumeClockCycles(4);
    }

    DEC() {
        let original = null;
        let result = null;
        let cycles = null;
        
        switch (this.instructionCode) {
            case 0x3D: // DEC A
                original = this.register.a; result = (original-1)&0xFF; this.register.a = result; cycles = 4; break;
            case 0x05: // DEC B
                original = this.register.b; result = (original-1)&0xFF; this.register.b = result; cycles = 4; break;
            case 0x0D: // DEC C
                original = this.register.c; result = (original-1)&0xFF; this.register.c = result; cycles = 4; break;
            case 0x15: // DEC D
                original = this.register.d; result = (original-1)&0xFF; this.register.d = result; cycles = 4; break;
            case 0x1D: // DEC E
                original = this.register.e; result = (original-1)&0xFF; this.register.e = result; cycles = 4; break;
            case 0x25: // DEC H
                original = this.register.h; result = (original-1)&0xFF; this.register.h = result; cycles = 4; break;
            case 0x2D: // DEC L
                original = this.register.l; result = (original-1)&0xFF; this.register.l = result; cycles = 4; break;
            case 0x35: // DEC (HL)
                original = this.system.mmu.readByte(this.getHL()); result = (original-1)&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 12; break;
        }

        if (result === 0) this.setZ(); else this.clearZ();
        this.setN();
        if ((original&0xf)-1<0) this.setH(); else this.clearH();
        this.system.consumeClockCycles(cycles);
    }

    DEC_nn() {
        switch (this.instructionCode) {
            case 0x0B: // DEC BC
                this.register.c = (this.register.c-1)&0xFF; if (this.register.c === 0xFF) this.register.b = (this.register.b-1)&0xFF; this.system.consumeClockCycles(8); break;
            case 0x1B: // DEC DE
                this.register.e = (this.register.e-1)&0xFF; if (this.register.e === 0xFF) this.register.d = (this.register.d-1)&0xFF; this.system.consumeClockCycles(8); break;
            case 0x2B: // DEC HL
                this.register.l = (this.register.l-1)&0xFF; if (this.register.l === 0xFF) this.register.h = (this.register.h-1)&0xFF; this.system.consumeClockCycles(8); break;
            case 0x3B: // DEC SP
                this.register.sp = (this.register.sp-1)&0xFFFF; this.system.consumeClockCycles(8); break;
        }
    }

    DI() { // Disable Interrupts
        this.pendingDisableInterrupts = 0x11;
        this.system.consumeClockCycles(4);
    }

    EI() { // Enable Interrupts
        this.pendingEnableInterrupts = 0x11;
        this.system.consumeClockCycles(4);
    }

    INC() {
        let original = null;
        let result = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0x3C: // INC A
                original = this.register.a; result = (original+1)&0xFF; this.register.a = result; cycles = 4; break;
            case 0x04: // INC B
                original = this.register.b; result = (original+1)&0xFF; this.register.b = result; cycles = 4; break;
            case 0x0C: // INC C
                original = this.register.c; result = (original+1)&0xFF; this.register.c = result; cycles = 4; break;
            case 0x14: // INC D
                original = this.register.d; result = (original+1)&0xFF; this.register.d = result; cycles = 4; break;
            case 0x1C: // INC E
                original = this.register.e; result = (original+1)&0xFF; this.register.e = result; cycles = 4; break;
            case 0x24: // INC H
                original = this.register.h; result = (original+1)&0xFF; this.register.h = result; cycles = 4; break;
            case 0x2C: // INC L
                original = this.register.l; result = (original+1)&0xFF; this.register.l = result; cycles = 4; break;
            case 0x34: // INC (HL)
                original = this.system.mmu.readByte(this.getHL()); result = (original+1)&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 12; break;
        }

        if (result === 0) this.setZ(); else this.clearZ();
        this.clearN();
        if ((this.register.c&0xF)+1>0xF) this.setH(); else this.clearH();
        this.system.consumeClockCycles(cycles);
    }

    JP_nn() {
        this.register.pc = this.system.mmu.readWord(this.register.pc);
        this.system.consumeClockCycles(16);
    }

    JR_cc_n() { // If the following condition is true then add n to current address and jump to it.
        let condition = null;
        let move = this.system.mmu.readByte(this.register.pc++);

        switch (this.instructionCode) {
            case 0x20: // JR NZ
                condition = !(this.register.f&0x80); break;
            case 0x28: // JR Z
                condition = this.register.f&0x80; break;
            case 0x30: // JR NC
                condition = !(this.register.f&0x10); break;
            case 0x38: // JR C
                condition = this.register.f&0x10; break;
        }

        if (condition) {
            if (move > 127) move = -((~move+1)&255);
            this.register.pc += move;
            this.system.consumeClockCycles(12);
        } else {
            this.system.consumeClockCycles(8);
        }
    }

    LD_A_n() {
        let value = null;
        let cycles = null;
        
        switch (this.instructionCode) {
            case 0x7F: // LD A, A
                value = this.register.a; cycles = 4; break;
            case 0x78: // LD A, B
                value = this.register.b; cycles = 4; break;
            case 0x79: // LD A, C
                value = this.register.c; cycles = 4; break;
            case 0x7A: // LD A, D
                value = this.register.d; cycles = 4; break;
            case 0x7B: // LD A, E
                value = this.register.e; cycles = 4; break;
            case 0x7C: // LD A, H
                value = this.register.h; cycles = 4; break;
            case 0x7D: // LD A, L
                value = this.register.l; cycles = 4; break;
            case 0x0A: // LD A, (BC)
                value = this.system.mmu.readByte(this.getBC()); cycles = 8; break;
            case 0x1A: // LD A, (DE)
                value = this.system.mmu.readByte(this.getDE()); cycles = 8; break;
            case 0x7E: // LD A, (HL)
                value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0x3E: // LD A, n
                value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
            case 0xFA: // LD A, (nn)
                value = this.system.mmu.readByte(this.system.mmu.readWord(this.register.pc)); this.register.pc+=2; cycles = 16; break;
        }

        this.register.a = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_B_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x40: // LD B, B
                value = this.register.b; cycles = 4; break;
            case 0x41: // LD B, C
                value = this.register.c; cycles = 4; break;
            case 0x42: // LD B, D
                value = this.register.d; cycles = 4; break;
            case 0x43: // LD B, E
                value = this.register.e; cycles = 4; break;
            case 0x44: // LD B, H
                value = this.register.h; cycles = 4; break;
            case 0x45: // LD B, L
                value = this.register.l; cycles = 4; break;
            case 0x46: // LD B, (HL)
                value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.b = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_HLmem_n() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0x70: // LD (HL), B
                value = this.register.b; cycles = 8; break;
            case 0x71: // LD (HL), C
                value = this.register.c; cycles = 8; break;
            case 0x72: // LD (HL), D
                value = this.register.d; cycles = 8; break;
            case 0x73: // LD (HL), E
                value = this.register.e; cycles = 8; break;
            case 0x74: // LD (HL), H
                value = this.register.h; cycles = 8; break;
            case 0x75: // LD (HL), L
                value = this.register.l; cycles = 8; break;
            case 0x36: // LD (HL), n
                value = this.system.mmu.readByte(this.register.pc++); cycles = 12; break;
        }

        this.system.mmu.writeByte(this.getHL(), value);
        this.system.consumeClockCycles(cycles);
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

        this.system.consumeClockCycles(12);
    }

    LD_nn_n() { // Put the value of n into nn.
        let value = this.system.mmu.readByte(this.register.pc++);

        switch (this.instructionCode) {
            case 0x06: // LD B, n
                this.register.b = value; break;
            case 0x0E: // LD C, n
                this.register.c = value; break;
            case 0x16: // LD D, n
                this.register.d = value; break;
            case 0x1E: // LD E, n
                this.register.e = value; break;
            case 0x26: // LD H, n
                this.register.h = value; break;
            case 0x2E: // LD L, n
                this.register.l = value; break;
        }

        this.system.consumeClockCycles(8);
    }

    LD_n_A() {
        switch (this.instructionCode) {
            case 0x7F: // LD A, A
                this.register.a = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x47: // LD B, A
                this.register.b = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x4F: // LD C, A
                this.register.c = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x57: // LD D, A
                this.register.d = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x5F: // LD E, A
                this.register.e = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x67: // LD H, A
                this.register.h = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x6F: // LD L, A
                this.register.l = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x02: // LD (BC), A
                this.system.mmu.writeByte(this.getBC(), this.register.a); this.system.consumeClockCycles(8); break;
            case 0x12: // LD (DE), A
                this.system.mmu.writeByte(this.getDE(), this.register.a); this.system.consumeClockCycles(8); break;
            case 0x77: // LD (HL), A
                this.system.mmu.writeByte(this.getHL(), this.register.a); this.system.consumeClockCycles(8); break;
            case 0xEA: // LD (nn), A
                this.system.mmu.writeByte(this.system.mmu.readWord(this.register.pc), this.register.a); this.register.pc+=2; this.system.consumeClockCycles(16); break;
        }
    }

    LDD_HLmem_A() { // Put A into memory address HL. Decrement HL.
        this.system.mmu.writeByte(this.getHL(), this.register.a);
        this.register.l = (this.register.l-1)&0xFF;
        if (this.register.l == 255) this.register.h = (this.register.h-1)&0xFF
        this.system.consumeClockCycles(8);
    }

    LD_A_Cmem() {
        this.register.a = this.system.mmu.readByte(0xFF00+this.register.c);
        this.system.consumeClockCycles(8);        
    }

    LD_Cmem_A() {
        this.system.mmu.writeByte(0xFF00+this.register.c, this.register.a);
        this.system.consumeClockCycles(8);
    }

    LDH_A_d8mem() { // Put memory address $FF00 + n into A.
        this.register.a = this.system.mmu.readByte(0xFF00+this.system.mmu.readByte(this.register.pc++));
        this.system.consumeClockCycles(12);
    }

    LDH_d8mem_A() { // Put A into memory address $FF00 + n.
        this.system.mmu.writeByte(0xFF00+this.system.mmu.readByte(this.register.pc++), this.register.a);
        this.system.consumeClockCycles(12);
    }

    LDI_A_HLmem() { // Put value at address HL into A. Increment HL.
        this.register.a = this.system.mmu.readByte(this.getHL());
        this.register.l = (this.register.l+1)&0xFF;
        if (this.register.l === 0) this.register.h = (this.register.h+1)&0xFF;
        this.system.consumeClockCycles(8);
    }

    LDI_HLmem_A() {        
        this.system.mmu.writeByte(this.getHL(), this.register.a);
        this.register.l = (this.register.l+1)&0xFF;
        if (this.register.l == 0) this.register.h = (this.register.h+1)&0xFF;
        this.system.consumeClockCycles(8);
    }

    NOP() { // No operation.
        this.system.consumeClockCycles(4);
    }

    OR() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xB7: // OR A
                value = this.register.a; cycles = 4; break;
            case 0xB0: // OR B
                value = this.register.b; cycles = 4; break;
            case 0xB1: // OR C
                value = this.register.c; cycles = 4; break;
            case 0xB2: // OR D
                value = this.register.d; cycles = 4; break;
            case 0xB3: // OR E
                value = this.register.e; cycles = 4; break;
            case 0xB4: // OR H
                value = this.register.h; cycles = 4; break;
            case 0xB5: // OR L
                value = this.register.l; cycles = 4; break;
            case 0xB6: // OR (HL)
                value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xF6: // OR n
                value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        this.register.a = (this.register.a|value)&0xFF;
        if (!this.register.a) this.setZ(); else this.clearZ();
        this.clearN(); this.clearH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    PUSH() {
        let value = null;

        switch (this.instructionCode) {
            case 0xF5: // PUSH AF
                value = this.getAF(); break;
            case 0xC5: // PUSH BC
                value = this.getBC(); break;
            case 0xD5: // PUSH DE
                value = this.getDE(); break;
            case 0xE5: // PUSH HL
                value = this.getHL(); break;
        }

        this.register.sp-=2;
        this.system.mmu.writeWord(this.register.sp, value);
        this.system.consumeClockCycles(16);
    }

    RET() {
        this.register.pc = this.system.mmu.readWord(this.register.sp);
        this.register.sp+=2;
        this.system.consumeClockCycles(16);
    }

    RST() { // Push present address onto stack. Jump to address $0000 + n.
        let offset = null;

        switch (this.instructionCode) {
            case 0xC7: offset = 0x00; break;
            case 0xCF: offset = 0x08; break;
            case 0xD7: offset = 0x10; break;
            case 0xDF: offset = 0x18; break;
            case 0xE7: offset = 0x20; break;
            case 0xEF: offset = 0x28; break;
            case 0xF7: offset = 0x30; break;
            case 0xFF: offset = 0x38; break;
        }

        this.register.sp-=2;
        this.system.mmu.writeWord(this.register.sp, this.register.pc);
        this.register.pc = 0x0000 + offset;
        this.system.consumeClockCycles(32);
    }

    XOR_n() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xAF: // XOR A
                value = this.register.a; cycles = 4; break;
            case 0xA8: // XOR B
                value = this.register.b; cycles = 4; break;
            case 0xA9: // XOR C
                value = this.register.c; cycles = 4; break;
            case 0xAA: // XOR D
                value = this.register.d; cycles = 4; break;
            case 0xAB: // XOR E
                value = this.register.e; cycles = 4; break;
            case 0xAC: // XOR H
                value = this.register.h; cycles = 4; break;
            case 0xAD: // XOR L
                value = this.register.l; cycles = 4; break;
            case 0xAE: // XOR (HL)
                value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xEE: // XOR n
                value = this.system.mmu.readByte(this.register++); cycles = 8; break;
        }

        this.register.a ^= value;
        this.register.a &= 0xFF;

        if (!this.register.a) this.setZ(); else this.clearZ();
        this.clearN(); this.clearH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    //*****************************************************************
    // CB Instructions
    //*****************************************************************   
    CB() {
        this.instructionCode = 0xCB00 + this.system.mmu.readByte(this.register.pc++);
        let instruction = this.decodeInstruction(this.instructionCode);
        instruction();
    }

    SWAP() {
        let result = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xCB37:
                result = this._SWAP(this.register.a); this.register.a = result; cycles = 8; break;
            case 0xCB30:
                result = this._SWAP(this.register.b); this.register.b = result; cycles = 8; break;
            case 0xCB31:
                result = this._SWAP(this.register.c); this.register.c = result; cycles = 8; break;
            case 0xCB32:
                result = this._SWAP(this.register.d); this.register.d = result; cycles = 8; break;
            case 0xCB33:
                result = this._SWAP(this.register.e); this.register.e = result; cycles = 8; break;
            case 0xCB34:
                result = this._SWAP(this.register.h); this.register.h = result; cycles = 8; break;
            case 0xCB35:
                result = this._SWAP(this.register.l); this.register.l = result; cycles = 8; break;
            case 0xCB36:
                result = this._SWAP(this.system.mmu.readByte(this.getHL())); this.system.mmu.writeByte(this.getHL(), result); cycles = 16; break;
        }
        
        if (result) this.clearZ(); else this.setZ(); 
        this.clearN(); this.clearH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    _SWAP(value) { return ((value&0xF)<<4)+(value>>4); }
}