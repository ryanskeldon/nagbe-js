"use strict";

class LR35902 {
    constructor(system) {
        this.system = system; // Reference to the emulator system.        

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
            // console.log(`PC: $${programCounter.toHex(4)} / INS: 0x${this.instructionCode.toHex(2)}`);
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
            case 0x8F: case 0x88: case 0x89: case 0x8A: case 0x8B: case 0x8C: case 0x8D: case 0x8E: case 0xCE: 
                return () => { this.ADC() };
            case 0x87: case 0x80: case 0x81: case 0x82: case 0x83: case 0x84: case 0x85: case 0x86: case 0xC6: 
                return () => { this.ADD() };
            case 0x09: case 0x19: case 0x29: case 0x39: 
                return () => { this.ADD_HL_n() };
            case 0xE8:
                return () => { this.ADD_SP_n() };
            case 0xA7: case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xE6: 
                return () => { this.AND() };
            case 0xC4: case 0xCC: case 0xD4: case 0xDC: 
                return () => { this.CALL_cc_nn() };
            case 0xCD:
                return () => { this.CALL_nn() };
            case 0x3F:
                return () => { this.CCF() };
            case 0xBF: case 0xB8: case 0xB9: case 0xBA: case 0xBB: case 0xBC: case 0xBD: case 0xBE: case 0xFE: 
                return () => { this.CP() };
            case 0x2F:
                return () => { this.CPL() };
            case 0x27:
                return () => { this.DAA() };
            case 0x3D: case 0x05: case 0x0D: case 0x15: case 0x1D: case 0x25: case 0x2D: case 0x35: 
                return () => { this.DEC() };
            case 0x0B: case 0x1B: case 0x2B: case 0x3B: 
                return () => { this.DEC_nn() };
            case 0xF3:
                return () => { this.DI() };
            case 0xFB:
                return () => { this.EI() };
            case 0x76:
                return () => { this.HALT() };
            case 0x3C: case 0x04: case 0x0C: case 0x14: case 0x1C: case 0x24: case 0x2C: case 0x34: 
                return () => { this.INC() };
            case 0x03: case 0x13: case 0x23: case 0x33: 
                return () => { this.INC_nn() };
            case 0xC2: case 0xCA: case 0xD2: case 0xDA:
                return () => { this.JP_cc_nn() };
            case 0xC3:
                return () => { this.JP_nn() };
            case 0xE9:
                return () => { this.JP_HLmem() };
            case 0x20: case 0x28: case 0x30: case 0x38: 
                return () => { this.JR_cc_n() };
            case 0x18:
                return () => { this.JR_n() };
            case 0x08:
                return () => { this.LD_d16_SP() };
            case 0x78: case 0x79: case 0x7A: case 0x7B: case 0x7C: case 0x7D: case 0x0A: case 0x1A: case 0x7E: case 0x3E: case 0xFA:            
                return () => { this.LD_A_n() };
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46:
                return () => { this.LD_B_n() };
            case 0x48: case 0x49: case 0x4A: case 0x4B: case 0x4C: case 0x4D: case 0x4E:
                return () => { this.LD_C_n() };
            case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56:
                return () => { this.LD_D_n() };
            case 0x58: case 0x59: case 0x5A: case 0x5B: case 0x5C: case 0x5D: case 0x5E:
                return () => { this.LD_E_n() };
            case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66:
                return () => { this.LD_H_n() };
            case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E:
                return () => { this.LD_L_n() };
            case 0xF8:
                return () => { this.LD_HL_SP_r8() };            
            case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x36:
                return () => { this.LD_HLmem_n() };
            case 0x7F: case 0x47: case 0x4F: case 0x57: case 0x5F: case 0x67: case 0x6F: case 0x02: case 0x12: case 0x77: case 0xEA: 
                return () => { this.LD_n_A() };
            case 0x01: case 0x11: case 0x21: case 0x31: 
                return () => { this.LD_n_nn() };
            case 0x06: case 0x0E: case 0x16: case 0x1E: case 0x26: case 0x2E:
                return () => { this.LD_nn_n() };
            case 0xF9:
                return () => { this.LD_SP_HL() };
            case 0xF2:
                return () => { this.LD_A_Cmem() };
            case 0xE2:
                return () => { this.LD_Cmem_A() };
            case 0x3A:
                return () => { this.LDD_A_HLmem() };
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
            case 0xF1: case 0xC1: case 0xD1: case 0xE1: 
                return () => { this.POP() };
            case 0xF5: case 0xC5: case 0xD5: case 0xE5: 
                return () => { this.PUSH() };
            case 0xC9:
                return () => { this.RET() };
            case 0xC0: case 0xC8: case 0xD0: case 0xD8: 
                return () => { this.RET_cc() };
            case 0xD9:
                return () => { this.RETI() };
            case 0x17:
                return () => { this.RLA() };
            case 0x07:
                return () => { this.RLCA() };
            case 0x1F:
                return () => { this.RRA() };
            case 0x0F:
                return () => { this.RRCA() };
            case 0xC7: case 0xCF: case 0xD7: case 0xDF: case 0xE7: case 0xEF: case 0xF7: case 0xFF: 
                return () => { this.RST() };
            case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F: case 0xDE: 
                return () => { this.SBC() };
            case 0x37:
                return () => { this.SCF() };
            case 0x10:
                return () => { this.STOP() };
            case 0x97: case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0xD6: 
                return () => { this.SUB() };
            case 0xAF: case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xEE:
                return () => { this.XOR() };
                
            //*****************************************************************
            // CB Instructions
            //*****************************************************************
            case 0xCB:
                return () => { this.CB() };
            case 0xCB00: case 0xCB01: case 0xCB02: case 0xCB03: case 0xCB04: case 0xCB05: case 0xCB06: case 0xCB07:
                return () => { this.RLC() };
            case 0xCB08: case 0xCB09: case 0xCB0A: case 0xCB0B: case 0xCB0C: case 0xCB0D: case 0xCB0E: case 0xCB0F: 
                return () => { this.RRC() };
            case 0xCB10: case 0xCB11: case 0xCB12: case 0xCB13: case 0xCB14: case 0xCB15: case 0xCB16: case 0xCB17:
                return () => { this.RL() };
            case 0xCB18: case 0xCB19: case 0xCB1A: case 0xCB1B: case 0xCB1C: case 0xCB1D: case 0xCB1E: case 0xCB1F:
                return () => { this.RR() };
            case 0xCB20: case 0xCB21: case 0xCB22: case 0xCB23: case 0xCB24: case 0xCB25: case 0xCB26: case 0xCB27: 
                return () => { this.SLA() };
            case 0xCB28: case 0xCB29: case 0xCB2A: case 0xCB2B: case 0xCB2C: case 0xCB2D: case 0xCB2E: case 0xCB2F: 
                return () => { this.SRA() };
            case 0xCB30: case 0xCB31: case 0xCB32: case 0xCB33: case 0xCB34: case 0xCB35: case 0xCB36: case 0xCB37: 
                return () => { this.SWAP() };
            case 0xCB38: case 0xCB39: case 0xCB3A: case 0xCB3B: case 0xCB3C: case 0xCB3D: case 0xCB3E: case 0xCB3F: 
                return () => { this.SRL() };
            case 0xCB40: case 0xCB41: case 0xCB42: case 0xCB43: case 0xCB44: case 0xCB45: case 0xCB46: case 0xCB47: 
            case 0xCB48: case 0xCB49: case 0xCB4A: case 0xCB4B: case 0xCB4C: case 0xCB4D: case 0xCB4E: case 0xCB4F: 
            case 0xCB50: case 0xCB51: case 0xCB52: case 0xCB53: case 0xCB54: case 0xCB55: case 0xCB56: case 0xCB57: 
            case 0xCB58: case 0xCB59: case 0xCB5A: case 0xCB5B: case 0xCB5C: case 0xCB5D: case 0xCB5E: case 0xCB5F: 
            case 0xCB60: case 0xCB61: case 0xCB62: case 0xCB63: case 0xCB64: case 0xCB65: case 0xCB66: case 0xCB67: 
            case 0xCB68: case 0xCB69: case 0xCB6A: case 0xCB6B: case 0xCB6C: case 0xCB6D: case 0xCB6E: case 0xCB6F: 
            case 0xCB70: case 0xCB71: case 0xCB72: case 0xCB73: case 0xCB74: case 0xCB75: case 0xCB76: case 0xCB77: 
            case 0xCB78: case 0xCB79: case 0xCB7A: case 0xCB7B: case 0xCB7C: case 0xCB7D: case 0xCB7E: case 0xCB7F: 
                return () => { this.BIT() };
            case 0xCB80: case 0xCB81: case 0xCB82: case 0xCB83: case 0xCB84: case 0xCB85: case 0xCB86: case 0xCB87: 
            case 0xCB88: case 0xCB89: case 0xCB8A: case 0xCB8B: case 0xCB8C: case 0xCB8D: case 0xCB8E: case 0xCB8F: 
            case 0xCB90: case 0xCB91: case 0xCB92: case 0xCB93: case 0xCB94: case 0xCB95: case 0xCB96: case 0xCB97: 
            case 0xCB98: case 0xCB99: case 0xCB9A: case 0xCB9B: case 0xCB9C: case 0xCB9D: case 0xCB9E: case 0xCB9F: 
            case 0xCBA0: case 0xCBA1: case 0xCBA2: case 0xCBA3: case 0xCBA4: case 0xCBA5: case 0xCBA6: case 0xCBA7: 
            case 0xCBA8: case 0xCBA9: case 0xCBAA: case 0xCBAB: case 0xCBAC: case 0xCBAD: case 0xCBAE: case 0xCBAF: 
            case 0xCBB0: case 0xCBB1: case 0xCBB2: case 0xCBB3: case 0xCBB4: case 0xCBB5: case 0xCBB6: case 0xCBB7: 
            case 0xCBB8: case 0xCBB9: case 0xCBBA: case 0xCBBB: case 0xCBBC: case 0xCBBD: case 0xCBBE: case 0xCBBF: 
                return () => { this.RES() };
            case 0xCBC0: case 0xCBC1: case 0xCBC2: case 0xCBC3: case 0xCBC4: case 0xCBC5: case 0xCBC6: case 0xCBC7: 
            case 0xCBC8: case 0xCBC9: case 0xCBCA: case 0xCBCB: case 0xCBCC: case 0xCBCD: case 0xCBCE: case 0xCBCF: 
            case 0xCBD0: case 0xCBD1: case 0xCBD2: case 0xCBD3: case 0xCBD4: case 0xCBD5: case 0xCBD6: case 0xCBD7: 
            case 0xCBD8: case 0xCBD9: case 0xCBDA: case 0xCBDB: case 0xCBDC: case 0xCBDD: case 0xCBDE: case 0xCBDF: 
            case 0xCBE0: case 0xCBE1: case 0xCBE2: case 0xCBE3: case 0xCBE4: case 0xCBE5: case 0xCBE6: case 0xCBE7: 
            case 0xCBE8: case 0xCBE9: case 0xCBEA: case 0xCBEB: case 0xCBEC: case 0xCBED: case 0xCBEE: case 0xCBEF: 
            case 0xCBF0: case 0xCBF1: case 0xCBF2: case 0xCBF3: case 0xCBF4: case 0xCBF5: case 0xCBF6: case 0xCBF7: 
            case 0xCBF8: case 0xCBF9: case 0xCBFA: case 0xCBFB: case 0xCBFC: case 0xCBFD: case 0xCBFE: case 0xCBFF:
                return () => { this.SET() };
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
    setAF(value) { this.register.a = (value>>8)&0xFF; this.register.f = value&0xF0; }
    setBC(value) { this.register.b = (value>>8)&0xFF; this.register.c = value&0xFF; }
    setDE(value) { this.register.d = (value>>8)&0xFF; this.register.e = value&0xFF; }
    setHL(value) { this.register.h = (value>>8)&0xFF; this.register.l = value&0xFF; }

    //*************************************************************************
    // Main Instructions
    //*************************************************************************
    ADC() {
        let cycles = null;
        let input = null;

        switch (this.instructionCode) {
            case 0x8F: input = this.register.a; cycles = 4; break;
            case 0x88: input = this.register.b; cycles = 4; break;
            case 0x89: input = this.register.c; cycles = 4; break;
            case 0x8A: input = this.register.d; cycles = 4; break;
            case 0x8B: input = this.register.e; cycles = 4; break;
            case 0x8C: input = this.register.h; cycles = 4; break;
            case 0x8D: input = this.register.l; cycles = 4; break;
            case 0x8E: input = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xCE: input = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        const a = this.register.a;
        const carry = this.register.f&0x10?1:0;
        let result = a + input + carry;
        this.clearN();
        if (result>0xFF) this.setC(); else this.clearC();
        result &= 0xFF;
        if (result === 0) this.setZ(); else this.clearZ();
        if ((a^input^result)&0x10) this.setH(); else this.clearH();
        this.register.a = result;
        this.system.consumeClockCycles(cycles);
    }

    ADD() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0x87: value = this.register.a; cycles = 4; break;
            case 0x80: value = this.register.b; cycles = 4; break;
            case 0x81: value = this.register.c; cycles = 4; break;
            case 0x82: value = this.register.d; cycles = 4; break;
            case 0x83: value = this.register.e; cycles = 4; break;
            case 0x84: value = this.register.h; cycles = 4; break;
            case 0x85: value = this.register.l; cycles = 4; break;
            case 0x86: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xC6: value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        const a = this.register.a;
        this.register.a += value;
        if (this.register.a>0xFF) this.setC(); else this.clearC();
        this.register.a &= 0xFF;
        this.clearN();
        if (this.register.a===0) this.setZ(); else this.clearZ();
        if (((a&0xF)+(value&0xF))>0xF) this.setH(); else this.clearH();
        this.system.consumeClockCycles(cycles);
    }

    ADD_HL_n() {
        let value = null;

        switch (this.instructionCode) {
            case 0x09: value = this.getBC(); break;
            case 0x19: value = this.getDE(); break;
            case 0x29: value = this.getHL(); break;
            case 0x39: value = this.register.sp; break;
        }

        let hl = this.getHL();
        this.clearN();
        if (((hl&0xFFF)+(value&0xFFF))&0x1000) this.setH(); else this.clearH();
        if (hl+value>0xFFFF) this.setC(); else this.clearC();
        hl += value;
        this.setHL(hl);
        this.system.consumeClockCycles(8);
    }

    ADD_SP_n() {
        let n = this.system.mmu.readByte(this.register.pc++);
        if (n>127) n = -((~n+1)&0xFF);
        const result = this.register.sp+n;
        this.clearZ(); this.clearN();
        if ((this.register.sp^n^result)&0x10) this.setH(); else this.clearH();
        if ((this.register.sp^n^result)&0x100) this.setC(); else this.clearC();
        this.register.sp = result&0xFFFF;
        this.system.consumeClockCycles(16);
    }

    AND() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xA7: value = this.register.a; cycles = 4; break;
            case 0xA0: value = this.register.b; cycles = 4; break;
            case 0xA1: value = this.register.c; cycles = 4; break;
            case 0xA2: value = this.register.d; cycles = 4; break;
            case 0xA3: value = this.register.e; cycles = 4; break;
            case 0xA4: value = this.register.h; cycles = 4; break;
            case 0xA5: value = this.register.l; cycles = 4; break;
            case 0xA6: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xE6: value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        this.register.a = (this.register.a&value)&0xFF;
        if (this.register.a) this.clearZ(); else this.setZ();
        this.clearN(); this.setH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    CALL_cc_nn() {
        let condition = null;
        const address = this.system.mmu.readWord(this.register.pc);
        this.register.pc += 2;

        switch (this.instructionCode) {
            case 0xC4: condition = !(this.register.f&0x80); break;
            case 0xCC: condition = this.register.f&0x80; break;
            case 0xD4: condition = !(this.register.f&0x10); break;
            case 0xDC: condition = this.register.f&0x10; break;
        }

        if (condition) {
            this.register.sp -= 2;
            this.system.mmu.writeWord(this.register.sp, this.register.pc);
            this.register.pc = address;
            this.system.consumeClockCycles(24);
        } else {
            this.system.consumeClockCycles(12);
        }
    }

    CALL_nn() {
        this.register.sp-=2;
        this.system.mmu.writeWord(this.register.sp, this.register.pc+2);
        this.register.pc = this.system.mmu.readWord(this.register.pc);
        this.system.consumeClockCycles(24);
    }

    CCF() {
        this.clearN(); this.clearH();
        if (this.register.f&0x10) this.clearC(); else this.setC();
        this.system.consumeClockCycles(4);
    }

    CP() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xBF: value = this.register.a; cycles = 4; break;
            case 0xB8: value = this.register.b; cycles = 4; break;
            case 0xB9: value = this.register.c; cycles = 4; break;
            case 0xBA: value = this.register.d; cycles = 4; break;
            case 0xBB: value = this.register.e; cycles = 4; break;
            case 0xBC: value = this.register.h; cycles = 4; break;
            case 0xBD: value = this.register.l; cycles = 4; break;
            case 0xBE: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xFE: value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        const result = this.register.a - value;
        if ((result&0xFF) === 0) this.setZ(); else this.clearZ();
        this.setN();
        if (this.register.a < value) this.setC(); else this.clearC();
        if ((this.register.a&0xF) < (value&0xF)) this.setH(); else this.clearH();
        this.system.consumeClockCycles(cycles);
    }

    CPL() {
        this.setN(); this.setH();
        this.register.a ^= 0xFF;
        this.system.consumeClockCycles(4);
    }

    DAA() {
        let correction = 0;
        const flagN = !!(this.register.f&0x40);
        const flagH = !!(this.register.f&0x20);
        const flagC = !!(this.register.f&0x10);

        if (flagH || (!flagN && (this.register.a & 0xF) > 9))
            correction = 6;

        if (flagC || (!flagN && this.register.a > 0x99)) {
            correction |= 0x60;
            this.setC();
        }

        this.register.a += flagN ? -correction : correction;
        this.register.a &= 0xFF;
        this.clearH();

        if (!this.register.a) this.setZ(); else this.clearZ();
        this.system.consumeClockCycles(4);
    }

    DEC() {
        let original = null;
        let result = null;
        let cycles = null;
        
        switch (this.instructionCode) {
            case 0x3D: original = this.register.a; result = (original-1)&0xFF; this.register.a = result; cycles = 4; break;
            case 0x05: original = this.register.b; result = (original-1)&0xFF; this.register.b = result; cycles = 4; break;
            case 0x0D: original = this.register.c; result = (original-1)&0xFF; this.register.c = result; cycles = 4; break;
            case 0x15: original = this.register.d; result = (original-1)&0xFF; this.register.d = result; cycles = 4; break;
            case 0x1D: original = this.register.e; result = (original-1)&0xFF; this.register.e = result; cycles = 4; break;
            case 0x25: original = this.register.h; result = (original-1)&0xFF; this.register.h = result; cycles = 4; break;
            case 0x2D: original = this.register.l; result = (original-1)&0xFF; this.register.l = result; cycles = 4; break;
            case 0x35: original = this.system.mmu.readByte(this.getHL()); result = (original-1)&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 12; break;
        }

        if (result === 0) this.setZ(); else this.clearZ();
        this.setN();
        if ((original&0xF)-1<0) this.setH(); else this.clearH();
        this.system.consumeClockCycles(cycles);
    }

    DEC_nn() {
        switch (this.instructionCode) {
            case 0x0B: this.register.c = (this.register.c-1)&0xFF; if (this.register.c === 0xFF) this.register.b = (this.register.b-1)&0xFF; break;
            case 0x1B: this.register.e = (this.register.e-1)&0xFF; if (this.register.e === 0xFF) this.register.d = (this.register.d-1)&0xFF; break;
            case 0x2B: this.register.l = (this.register.l-1)&0xFF; if (this.register.l === 0xFF) this.register.h = (this.register.h-1)&0xFF; break;
            case 0x3B: this.register.sp = (this.register.sp-1)&0xFFFF; break;
        }

        this.system.consumeClockCycles(8);
    }

    DI() {
        this.pendingDisableInterrupts = 0x11;
        this.system.consumeClockCycles(4);
    }

    EI() {
        this.pendingEnableInterrupts = 0x11;
        this.system.consumeClockCycles(4);
    }

    HALT() {
        this.halt = true;
        this.system.consumeClockCycles(4);
    }

    INC() {
        let original = null;
        let result = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0x3C: original = this.register.a; result = (original+1)&0xFF; this.register.a = result; cycles = 4; break;
            case 0x04: original = this.register.b; result = (original+1)&0xFF; this.register.b = result; cycles = 4; break;
            case 0x0C: original = this.register.c; result = (original+1)&0xFF; this.register.c = result; cycles = 4; break;
            case 0x14: original = this.register.d; result = (original+1)&0xFF; this.register.d = result; cycles = 4; break;
            case 0x1C: original = this.register.e; result = (original+1)&0xFF; this.register.e = result; cycles = 4; break;
            case 0x24: original = this.register.h; result = (original+1)&0xFF; this.register.h = result; cycles = 4; break;
            case 0x2C: original = this.register.l; result = (original+1)&0xFF; this.register.l = result; cycles = 4; break;
            case 0x34: original = this.system.mmu.readByte(this.getHL()); result = (original+1)&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 12; break;
        }        

        if (result) this.clearZ(); else this.setZ();
        this.clearN();
        if ((original&0xF)+1>0xF) this.setH(); else this.clearH();
        this.system.consumeClockCycles(cycles);
    }

    INC_nn() {
        switch (this.instructionCode) {
            case 0x03: this.register.c = (this.register.c+1)&0xFF; if (this.register.c === 0) this.register.b = (this.register.b+1)&0xFF; break;
            case 0x13: this.register.e = (this.register.e+1)&0xFF; if (this.register.e === 0) this.register.d = (this.register.d+1)&0xFF; break;
            case 0x23: this.register.l = (this.register.l+1)&0xFF; if (this.register.l === 0) this.register.h = (this.register.h+1)&0xFF; break;
            case 0x33: this.register.sp = (this.register.sp+1)&0xFFFF; break;
        }

        this.system.consumeClockCycles(8);
    }

    JP_d16() {
        this.register.pc = this.system.mmu.readWord(this.register.pc);
        // Note: GB CPU manual says this instruction is 12 cycles. It's actually 16.
        this.system.consumeClockCycles(16);
    }

    JP_cc_nn() {
        let condition = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xC2: condition = !(this.register.f&0x80); break;
            case 0xCA: condition = this.register.f&0x80; break;
            case 0xD2: condition = !(this.register.f&0x10); break;
            case 0xDA: condition = this.register.f&0x10; break;
        }

        if (condition) {
            this.register.pc = this.system.mmu.readWord(this.register.pc);
            cycles = 16;
        } else {
            this.register.pc += 2;
            cycles = 12;
        }

        this.system.consumeClockCycles(cycles);
    }

    JP_nn() {
        this.register.pc = this.system.mmu.readWord(this.register.pc);
        this.system.consumeClockCycles(16);
    }

    JP_HLmem() {
        this.register.pc = this.getHL();
        this.system.consumeClockCycles(4);
    }

    JR_cc_n() {
        let condition = null;
        let move = this.system.mmu.readByte(this.register.pc++);

        switch (this.instructionCode) {
            case 0x20: condition = !(this.register.f&0x80); break;
            case 0x28: condition = this.register.f&0x80; break;
            case 0x30: condition = !(this.register.f&0x10); break;
            case 0x38: condition = this.register.f&0x10; break;
        }

        if (condition) {
            if (move > 127) move = -((~move+1)&0xFF);
            this.register.pc += move;
            this.system.consumeClockCycles(12);
        } else {
            this.system.consumeClockCycles(8);
        }
    }

    JR_n() {
        let move = this.system.mmu.readByte(this.register.pc++);
        if (move > 127) move = -((~move+1)&0xFF);
        this.register.pc += move; 
        this.system.consumeClockCycles(12);
    }

    LD_d16_SP() {
        const address = this.system.mmu.readWord(this.register.pc); 
        this.register.pc+=2; 
        this.system.mmu.writeWord(address, this.register.sp); 
        this.system.consumeClockCycles(20);
    }

    LD_A_n() {
        let value = null;
        let cycles = null;
        
        switch (this.instructionCode) {
            case 0x78: value = this.register.b; cycles = 4; break;
            case 0x79: value = this.register.c; cycles = 4; break;
            case 0x7A: value = this.register.d; cycles = 4; break;
            case 0x7B: value = this.register.e; cycles = 4; break;
            case 0x7C: value = this.register.h; cycles = 4; break;
            case 0x7D: value = this.register.l; cycles = 4; break;
            case 0x0A: value = this.system.mmu.readByte(this.getBC()); cycles = 8; break;
            case 0x1A: value = this.system.mmu.readByte(this.getDE()); cycles = 8; break;
            case 0x7E: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0x3E: value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
            case 0xFA: value = this.system.mmu.readByte(this.system.mmu.readWord(this.register.pc)); this.register.pc+=2; cycles = 16; break;
        }

        this.register.a = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_B_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x40: value = this.register.b; cycles = 4; break;
            case 0x41: value = this.register.c; cycles = 4; break;
            case 0x42: value = this.register.d; cycles = 4; break;
            case 0x43: value = this.register.e; cycles = 4; break;
            case 0x44: value = this.register.h; cycles = 4; break;
            case 0x45: value = this.register.l; cycles = 4; break;
            case 0x46: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.b = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_C_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x48: value = this.register.b; cycles = 4; break;
            case 0x49: value = this.register.c; cycles = 4; break;
            case 0x4A: value = this.register.d; cycles = 4; break;
            case 0x4B: value = this.register.e; cycles = 4; break;
            case 0x4C: value = this.register.h; cycles = 4; break;
            case 0x4D: value = this.register.l; cycles = 4; break;
            case 0x4E: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.c = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_D_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x50: value = this.register.b; cycles = 4; break;
            case 0x51: value = this.register.c; cycles = 4; break;
            case 0x52: value = this.register.d; cycles = 4; break;
            case 0x53: value = this.register.e; cycles = 4; break;
            case 0x54: value = this.register.h; cycles = 4; break;
            case 0x55: value = this.register.l; cycles = 4; break;
            case 0x56: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.d = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_E_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x58: value = this.register.b; cycles = 4; break;
            case 0x59: value = this.register.c; cycles = 4; break;
            case 0x5A: value = this.register.d; cycles = 4; break;
            case 0x5B: value = this.register.e; cycles = 4; break;
            case 0x5C: value = this.register.h; cycles = 4; break;
            case 0x5D: value = this.register.l; cycles = 4; break;
            case 0x5E: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.e = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_H_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x60: value = this.register.b; cycles = 4; break;
            case 0x61: value = this.register.c; cycles = 4; break;
            case 0x62: value = this.register.d; cycles = 4; break;
            case 0x63: value = this.register.e; cycles = 4; break;
            case 0x64: value = this.register.h; cycles = 4; break;
            case 0x65: value = this.register.l; cycles = 4; break;
            case 0x66: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.h = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_L_n() {
        let value = null;
        let cycles = null;

        switch(this.instructionCode) {
            case 0x68: value = this.register.b; cycles = 4; break;
            case 0x69: value = this.register.c; cycles = 4; break;
            case 0x6A: value = this.register.d; cycles = 4; break;
            case 0x6B: value = this.register.e; cycles = 4; break;
            case 0x6C: value = this.register.h; cycles = 4; break;
            case 0x6D: value = this.register.l; cycles = 4; break;
            case 0x6E: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
        }

        this.register.l = value;
        this.system.consumeClockCycles(cycles);
    }

    LD_HL_SP_r8() {
        let n = this.system.mmu.readByte(this.register.pc++);
        if (n>127) n = -((~n+1)&0xFF);
        const result = (n + this.register.sp)&0xFFFF;
        this.register.h = (result>>8)&0xFF;            
        this.register.l = result&0xFF;            
        this.clearZ(); this.clearN();
        if (((this.register.sp^n^result)&0x100)==0x100) this.setC(); else this.clearC();
        if (((this.register.sp^n^result)&0x10)==0x10) this.setH(); else this.clearH();
        this.system.consumeClockCycles(12);
    }

    LD_HLmem_n() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0x70: value = this.register.b; cycles = 8; break;
            case 0x71: value = this.register.c; cycles = 8; break;
            case 0x72: value = this.register.d; cycles = 8; break;
            case 0x73: value = this.register.e; cycles = 8; break;
            case 0x74: value = this.register.h; cycles = 8; break;
            case 0x75: value = this.register.l; cycles = 8; break;
            case 0x36: value = this.system.mmu.readByte(this.register.pc++); cycles = 12; break;
        }

        this.system.mmu.writeByte(this.getHL(), value);
        this.system.consumeClockCycles(cycles);
    }

    LD_n_nn() {        
        let word = this.system.mmu.readWord(this.register.pc);
        this.register.pc+=2;

        switch (this.instructionCode) {
            case 0x01: this.register.b = (word>>8)&0xFF; this.register.c = word&0xFF; break;
            case 0x11: this.register.d = (word>>8)&0xFF; this.register.e = word&0xFF; break;
            case 0x21: this.register.h = (word>>8)&0xFF; this.register.l = word&0xFF; break;
            case 0x31: this.register.sp = word; break;
        }

        this.system.consumeClockCycles(12);
    }

    LD_nn_n() {
        let value = this.system.mmu.readByte(this.register.pc++);

        switch (this.instructionCode) {
            case 0x06: this.register.b = value; break;
            case 0x0E: this.register.c = value; break;
            case 0x16: this.register.d = value; break;
            case 0x1E: this.register.e = value; break;
            case 0x26: this.register.h = value; break;
            case 0x2E: this.register.l = value; break;
        }

        this.system.consumeClockCycles(8);
    }

    LD_n_A() {
        switch (this.instructionCode) {
            case 0x7F: this.register.a = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x47: this.register.b = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x4F: this.register.c = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x57: this.register.d = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x5F: this.register.e = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x67: this.register.h = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x6F: this.register.l = this.register.a; this.system.consumeClockCycles(4); break;
            case 0x02: this.system.mmu.writeByte(this.getBC(), this.register.a); this.system.consumeClockCycles(8); break;
            case 0x12: this.system.mmu.writeByte(this.getDE(), this.register.a); this.system.consumeClockCycles(8); break;
            case 0x77: this.system.mmu.writeByte(this.getHL(), this.register.a); this.system.consumeClockCycles(8); break;
            case 0xEA: this.system.mmu.writeByte(this.system.mmu.readWord(this.register.pc), this.register.a); this.register.pc+=2; this.system.consumeClockCycles(16); break;
        }
    }

    LD_SP_HL() {
        this.register.sp = (this.register.h<<8)+this.register.l;
        this.system.consumeClockCycles(8);
    }

    LDD_A_HLmem() {
        this.register.a = this.system.mmu.readByte(this.getHL());
        this.register.l = (this.register.l-1)&0xFF;
        if (this.register.l===0xFF) this.register.h = (this.register.h-1)&0xFF;
        this.system.consumeClockCycles(8);
    }

    LDD_HLmem_A() {
        this.system.mmu.writeByte(this.getHL(), this.register.a);
        this.register.l = (this.register.l-1)&0xFF;
        if (this.register.l===0xFF) this.register.h = (this.register.h-1)&0xFF
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

    LDH_A_d8mem() {
        this.register.a = this.system.mmu.readByte(0xFF00+this.system.mmu.readByte(this.register.pc++));
        this.system.consumeClockCycles(12);
    }

    LDH_d8mem_A() {
        this.system.mmu.writeByte(0xFF00+this.system.mmu.readByte(this.register.pc++), this.register.a);
        this.system.consumeClockCycles(12);
    }

    LDI_A_HLmem() {
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

    NOP() {
        this.system.consumeClockCycles(4);
    }

    OR() {
        let value = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xB7: value = this.register.a; cycles = 4; break;
            case 0xB0: value = this.register.b; cycles = 4; break;
            case 0xB1: value = this.register.c; cycles = 4; break;
            case 0xB2: value = this.register.d; cycles = 4; break;
            case 0xB3: value = this.register.e; cycles = 4; break;
            case 0xB4: value = this.register.h; cycles = 4; break;
            case 0xB5: value = this.register.l; cycles = 4; break;
            case 0xB6: value = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xF6: value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        this.register.a = (this.register.a|value)&0xFF;
        if (this.register.a) this.clearZ(); else this.setZ();
        this.clearN(); this.clearH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    POP() {
        switch (this.instructionCode) {
            case 0xF1: this.register.f = this.system.mmu.readByte(this.register.sp++)&0xF0; this.register.a = this.system.mmu.readByte(this.register.sp++); break;
            case 0xC1: this.register.c = this.system.mmu.readByte(this.register.sp++); this.register.b = this.system.mmu.readByte(this.register.sp++); break;
            case 0xD1: this.register.e = this.system.mmu.readByte(this.register.sp++); this.register.d = this.system.mmu.readByte(this.register.sp++); break;
            case 0xE1: this.register.l = this.system.mmu.readByte(this.register.sp++); this.register.h = this.system.mmu.readByte(this.register.sp++); break;
        }
        
        this.system.consumeClockCycles(12);
    }

    PUSH() {
        let value = null;

        switch (this.instructionCode) {
            case 0xF5: value = this.getAF(); break;
            case 0xC5: value = this.getBC(); break;
            case 0xD5: value = this.getDE(); break;
            case 0xE5: value = this.getHL(); break;
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

    RET_cc() {
        let condition = null;

        switch (this.instructionCode) {
            case 0xC0: condition = !(this.register.f&0x80); break;
            case 0xC8: condition = this.register.f&0x80; break;
            case 0xD0: condition = !(this.register.f&0x10); break;
            case 0xD8: condition = this.register.f&0x10; break;
        }

        if (condition) {
            this.register.pc = this.system.mmu.readWord(this.register.sp);
            this.register.sp+=2;
            this.system.consumeClockCycles(20);
        } else {
            this.system.consumeClockCycles(8);
        }
    }

    RETI() {
        const address = this.system.mmu.readWord(this.register.sp);
        this.register.sp+=2;
        this.register.pc = address;
        this.ime = true;
        this.system.consumeClockCycles(16);
    }

    RLA() {
        const a = this.register.a;
        const carryOut = this.register.a&0x80?1:0;
        const carryIn = this.register.f&0x10?1:0; 
        this.register.a = ((a<<1)+carryIn)&0xFF;
        if (carryOut) this.setC(); else this.clearC();
        this.clearZ(); this.clearN(); this.clearH();
        this.system.consumeClockCycles(4);
    }

    RLCA() {
        this.clearN(); this.clearH(); this.clearZ();
        const carryOut = this.register.a&0x80?1:0;
        if (carryOut) this.setC(); else this.clearC();
        this.register.a = ((this.register.a<<1)+carryOut)&0xFF;
        this.system.consumeClockCycles(4);
    }

    RRA() {
        const carryIn = this.register.f&0x10?1:0;
        const carryOut = this.register.a&0x01?1:0;
        this.register.a = ((this.register.a>>1)+(carryIn<<7))&0xFF;
        if (carryOut) this.setC(); else this.clearC();
        this.clearZ(); this.clearN(); this.clearH();
        this.system.consumeClockCycles(4);
    }

    RRCA() {
        this.clearN(); this.clearH(); this.clearZ();
        const carryOut = this.register.a&0x01?1:0;
        if (carryOut) this.setC(); else this.clearC();
        this.register.a = ((this.register.a>>1)+(carryOut<<7))&0xFF;
        this.system.consumeClockCycles(4);
    }

    RST() {
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
        this.system.consumeClockCycles(16);
    }

    SBC() {
        let cycles = null;
        let input = null;
        const a = this.register.a;

        switch (this.instructionCode) {
            case 0x9F: input = this.register.a; cycles = 4; break;
            case 0x98: input = this.register.b; cycles = 4; break;
            case 0x99: input = this.register.c; cycles = 4; break;
            case 0x9A: input = this.register.d; cycles = 4; break;
            case 0x9B: input = this.register.e; cycles = 4; break;
            case 0x9C: input = this.register.h; cycles = 4; break;
            case 0x9D: input = this.register.l; cycles = 4; break;
            case 0x9E: input = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xDE: input = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        const result = a-input-(this.register.f&0x10?1:0);
        this.setN();
        if (result&0xFF) this.clearZ(); else this.setZ();        
        if (result&0x100) this.setC(); else this.clearC();        
        if (((a^input^result)&0x10)!=0) this.setH(); else this.clearH();
        this.register.a = result&0xFF;

        this.system.consumeClockCycles(cycles);
    }

    SCF() {
        this.setC(); this.clearN(); this.clearH();
        this.system.consumeClockCycles(4);
    }

    STOP() {
        this.stop = true;
        this.register.pc++;
        this.system.consumeClockCycles(4);
    }

    SUB() {
        let cycles = null;
        let input = null;

        switch (this.instructionCode) {
            case 0x97: input = this.register.a; cycles = 4; break;
            case 0x90: input = this.register.b; cycles = 4; break;
            case 0x91: input = this.register.c; cycles = 4; break;
            case 0x92: input = this.register.d; cycles = 4; break;
            case 0x93: input = this.register.e; cycles = 4; break;
            case 0x94: input = this.register.h; cycles = 4; break;
            case 0x95: input = this.register.l; cycles = 4; break;
            case 0x96: input = this.system.mmu.readByte(this.getHL()); cycles = 8; break;
            case 0xD6: input = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
        }

        let a = this.register.a;
        this.register.a -= input;
        this.setN();        
        if (this.register.a < 0) this.setC(); else this.clearC();
        this.register.a &= 0xFF;
        if (this.register.a) this.clearZ(); else this.setZ();
        if ((this.register.a^input^a) & 0x10) this.setH(); else this.clearH();

        this.system.consumeClockCycles(cycles);
    }

    XOR() {
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
                value = this.system.mmu.readByte(this.register.pc++); cycles = 8; break;
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

    BIT() {
        let bit = null;
        let value = null;
        let cycles = null;

        const codeHI = (this.instructionCode>>4)&0xF;
        const codeLO = this.instructionCode&0xF;

        switch (codeLO) {
            case 0x7: case 0xF: value = this.register.a; cycles = 8; break;
            case 0x0: case 0x8: value = this.register.b; cycles = 8; break;
            case 0x1: case 0x9: value = this.register.c; cycles = 8; break;
            case 0x2: case 0xA: value = this.register.d; cycles = 8; break;
            case 0x3: case 0xB: value = this.register.e; cycles = 8; break;
            case 0x4: case 0xC: value = this.register.h; cycles = 8; break;
            case 0x5: case 0xD: value = this.register.l; cycles = 8; break;
            case 0x6: case 0xE: value = this.system.mmu.readByte(this.getHL()); cycles = 12; break;
        }

        switch (codeHI) {
            case 0x4: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 0; else bit = 1; break;
            case 0x5: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 2; else bit = 3; break;
            case 0x6: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 4; else bit = 5; break;
            case 0x7: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 6; else bit = 7; break;
        }

        if (value&(1<<bit)) this.clearZ(); else this.setZ(); 
        this.clearN(); this.setH();
        this.system.consumeClockCycles(cycles);
    }

    RES() {
        let bit = null;
        let cycles = null;

        const codeHI = (this.instructionCode>>4)&0xF;
        const codeLO = this.instructionCode&0xF;

        switch (codeHI) {
            case 0x8: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 0; else bit = 1; break;
            case 0x9: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 2; else bit = 3; break;
            case 0xA: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 4; else bit = 5; break;
            case 0xB: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 6; else bit = 7; break;
        }

        switch (codeLO) {
            case 0x7: case 0xF: this.register.a &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x0: case 0x8: this.register.b &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x1: case 0x9: this.register.c &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x2: case 0xA: this.register.d &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x3: case 0xB: this.register.e &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x4: case 0xC: this.register.h &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x5: case 0xD: this.register.l &= (0xFF)-(1<<bit); cycles = 8; break;
            case 0x6: case 0xE: let hl = this.system.mmu.readByte(this.getHL()); this.system.mmu.writeByte(this.getHL(), hl&(0xFF)-(1<<bit)); cycles = 16; break;
        }

        this.system.consumeClockCycles(cycles);
    }

    RL() {
        this.clearN(); this.clearH();
        let cycles = null;
        let result = null;
        
        switch (this.instructionCode) {
            case 0xCB17: this.register.a = result = this._RL(this.register.a); cycles = 8; break;
            case 0xCB10: this.register.b = result = this._RL(this.register.b); cycles = 8; break;
            case 0xCB11: this.register.c = result = this._RL(this.register.c); cycles = 8; break;
            case 0xCB12: this.register.d = result = this._RL(this.register.d); cycles = 8; break;
            case 0xCB13: this.register.e = result = this._RL(this.register.e); cycles = 8; break;
            case 0xCB14: this.register.h = result = this._RL(this.register.h); cycles = 8; break;
            case 0xCB15: this.register.l = result = this._RL(this.register.l); cycles = 8; break;
            case 0xCB16: result = this._RL(this.system.mmu.readByte(this.getHL())); this.system.mmu.writeByte(this.getHL(), result); cycles = 16; break;
        }
            
        if (result) this.clearZ(); else this.setZ();
        this.system.consumeClockCycles(cycles);
    }

    _RL(register) {
        const carryOut = register&0x80?1:0;
        const carryIn = this.register.f&0x10?1:0;
        if (carryOut) this.setC(); else this.clearC();
        return ((register<<1)+carryIn)&0xFF;
    }

    RLC() {
        this.clearN(); this.clearH();
        let cycles = null;

        switch (this.instructionCode) {
            case 0xCB07: this.register.a = this._RLC(this.register.a); cycles = 8; break;
            case 0xCB00: this.register.b = this._RLC(this.register.b); cycles = 8; break;
            case 0xCB01: this.register.c = this._RLC(this.register.c); cycles = 8; break;
            case 0xCB02: this.register.d = this._RLC(this.register.d); cycles = 8; break;
            case 0xCB03: this.register.e = this._RLC(this.register.e); cycles = 8; break;
            case 0xCB04: this.register.h = this._RLC(this.register.h); cycles = 8; break;
            case 0xCB05: this.register.l = this._RLC(this.register.l); cycles = 8; break;
            case 0xCB06: this.system.mmu.writeByte(this.getHL(), this._RLC(this.system.mmu.readByte(this.getHL()))); cycles = 16; break;
        }
            
        this.system.consumeClockCycles(cycles);
    }
    
    _RLC(register) {
        const carryOut = register&0x80?1:0;
        if (carryOut) this.setC(); else this.clearC();
        const result = ((register<<1)+carryOut)&0xFF;
        if (result) this.clearZ(); else this.setZ();
        return result;
    }

    RR() {
        this.clearN(); this.clearH();
        let cycles = null;

        switch (this.instructionCode) {
            case 0xCB1F: this.register.a = this._RR(this.register.a); cycles = 8; break;
            case 0xCB18: this.register.b = this._RR(this.register.b); cycles = 8; break;
            case 0xCB19: this.register.c = this._RR(this.register.c); cycles = 8; break;
            case 0xCB1A: this.register.d = this._RR(this.register.d); cycles = 8; break;
            case 0xCB1B: this.register.e = this._RR(this.register.e); cycles = 8; break;
            case 0xCB1C: this.register.h = this._RR(this.register.h); cycles = 8; break;
            case 0xCB1D: this.register.l = this._RR(this.register.l); cycles = 8; break;
            case 0xCB1E: this.system.mmu.writeByte(this.getHL(), this._RR(this.system.mmu.readByte(this.getHL()))); cycles = 16; break;
        }        

        this.system.consumeClockCycles(cycles);
    }

    _RR(register) {
        const carryOut = register&0x01?1:0;
        const carryIn = this.register.f&0x10?1:0;
        if (carryOut) this.setC(); else this.clearC();
        const result = ((register>>1)+(carryIn<<7))&0xFF;
        if (result) this.clearZ(); else this.setZ();
        return result;
    }

    RRC() {
        let cycles = null;

        this.clearN(); this.clearH();

        switch (this.instructionCode) {
            case 0xCB0F: this.register.a = this._RRC(this.register.a); cycles = 8; break;
            case 0xCB08: this.register.b = this._RRC(this.register.b); cycles = 8; break;
            case 0xCB09: this.register.c = this._RRC(this.register.c); cycles = 8; break;
            case 0xCB0A: this.register.d = this._RRC(this.register.d); cycles = 8; break;
            case 0xCB0B: this.register.e = this._RRC(this.register.e); cycles = 8; break;
            case 0xCB0C: this.register.h = this._RRC(this.register.h); cycles = 8; break;
            case 0xCB0D: this.register.l = this._RRC(this.register.l); cycles = 8; break;
            case 0xCB0E: this.system.mmu.writeByte(this.getHL(), this._RRC(this.system.mmu.readByte(this.getHL()))); cycles = 16; break;
        }

        this.system.consumeClockCycles(cycles);
    }

    _RRC(register) {
        const carryOut = register&0x01?1:0;
        if (carryOut) this.setC(); else this.clearC();
        const result = ((register>>1)+(carryOut<<7))&0xFF;
        if (result) this.clearZ(); else this.setZ();
        return result;
    }

    SET() {
        let bit = null;
        let cycles = null;

        const codeHI = (this.instructionCode>>4)&0xF;
        const codeLO = this.instructionCode&0xF;

        switch (codeHI) {
            case 0xC: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 0; else bit = 1; break;
            case 0xD: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 2; else bit = 3; break;
            case 0xE: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 4; else bit = 5; break;
            case 0xF: if (codeLO >= 0x0 && codeLO <= 0x7) bit = 6; else bit = 7; break;
        }

        switch (codeLO) {
            case 0x7: case 0xF: this.register.a |= (1<<bit); cycles = 8; break;
            case 0x0: case 0x8: this.register.b |= (1<<bit); cycles = 8; break;
            case 0x1: case 0x9: this.register.c |= (1<<bit); cycles = 8; break;
            case 0x2: case 0xA: this.register.d |= (1<<bit); cycles = 8; break;
            case 0x3: case 0xB: this.register.e |= (1<<bit); cycles = 8; break;
            case 0x4: case 0xC: this.register.h |= (1<<bit); cycles = 8; break;
            case 0x5: case 0xD: this.register.l |= (1<<bit); cycles = 8; break;
            case 0x6: case 0xE: let hl = this.system.mmu.readByte(this.getHL()); this.system.mmu.writeByte(this.getHL(), hl|(1<<bit)); cycles = 16; break;
        }

        this.system.consumeClockCycles(cycles);
    }

    SLA() {
        this.clearN(); this.clearH();
        let cycles = null;
        let original = null;
        let result = null;

        switch (this.instructionCode) {
            case 0xCB27: original = this.register.a; result = (original<<1)&0xFF; this.register.a = result; cycles = 8; break;
            case 0xCB20: original = this.register.b; result = (original<<1)&0xFF; this.register.b = result; cycles = 8; break;
            case 0xCB21: original = this.register.c; result = (original<<1)&0xFF; this.register.c = result; cycles = 8; break;
            case 0xCB22: original = this.register.d; result = (original<<1)&0xFF; this.register.d = result; cycles = 8; break;
            case 0xCB23: original = this.register.e; result = (original<<1)&0xFF; this.register.e = result; cycles = 8; break;
            case 0xCB24: original = this.register.h; result = (original<<1)&0xFF; this.register.h = result; cycles = 8; break;
            case 0xCB25: original = this.register.l; result = (original<<1)&0xFF; this.register.l = result; cycles = 8; break;
            case 0xCB26: original = this.system.mmu.readByte(this.getHL()); result = (original<<1)&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 16; break;
        }

        if (original&0x80) this.setC(); else this.clearC();
        if (result) this.clearZ(); else this.setZ();
        this.system.consumeClockCycles(cycles);
    }

    SRA() {
        let cycles = null;
        let original = null;
        let result = null;
        this.clearN(); this.clearH();

        switch (this.instructionCode) {
            case 0xCB2F: original = this.register.a; result = ((original>>1)+(original&0x80))&0xFF; this.register.a = result; cycles = 8; break;
            case 0xCB28: original = this.register.b; result = ((original>>1)+(original&0x80))&0xFF; this.register.b = result; cycles = 8; break;
            case 0xCB29: original = this.register.c; result = ((original>>1)+(original&0x80))&0xFF; this.register.c = result; cycles = 8; break;
            case 0xCB2A: original = this.register.d; result = ((original>>1)+(original&0x80))&0xFF; this.register.d = result; cycles = 8; break;
            case 0xCB2B: original = this.register.e; result = ((original>>1)+(original&0x80))&0xFF; this.register.e = result; cycles = 8; break;
            case 0xCB2C: original = this.register.h; result = ((original>>1)+(original&0x80))&0xFF; this.register.h = result; cycles = 8; break;
            case 0xCB2D: original = this.register.l; result = ((original>>1)+(original&0x80))&0xFF; this.register.l = result; cycles = 8; break;
            case 0xCB2E: original = this.system.mmu.readByte(this.getHL()); result = ((original>>1)+(original&0x80))&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 16; break;
        }
            
        if (original&0x01) this.setC(); else this.clearC();
        if (result) this.clearZ(); else this.setZ();
        this.system.consumeClockCycles(cycles);
    }

    SRL() {
        let cycles = null;
        let original = null;
        let result = null;
        this.clearN(); this.clearH();

        switch (this.instructionCode) {
            case 0xCB3F: original = this.register.a; result = (original>>1)&0xFF; this.register.a = result; cycles = 8; break;
            case 0xCB38: original = this.register.b; result = (original>>1)&0xFF; this.register.b = result; cycles = 8; break;
            case 0xCB39: original = this.register.c; result = (original>>1)&0xFF; this.register.c = result; cycles = 8; break;
            case 0xCB3A: original = this.register.d; result = (original>>1)&0xFF; this.register.d = result; cycles = 8; break;
            case 0xCB3B: original = this.register.e; result = (original>>1)&0xFF; this.register.e = result; cycles = 8; break;
            case 0xCB3C: original = this.register.h; result = (original>>1)&0xFF; this.register.h = result; cycles = 8; break;
            case 0xCB3D: original = this.register.l; result = (original>>1)&0xFF; this.register.l = result; cycles = 8; break;
            case 0xCB3E: original = this.system.mmu.readByte(this.getHL()); result = (original>>1)&0xFF; this.system.mmu.writeByte(this.getHL(), result); cycles = 16; break;
        }

        if (original&0x01) this.setC(); else this.clearC();
        if (result) this.clearZ(); else this.setZ();

        this.system.consumeClockCycles(cycles);
    }

    SWAP() {
        let result = null;
        let cycles = null;

        switch (this.instructionCode) {
            case 0xCB37: result = this._SWAP(this.register.a); this.register.a = result; cycles = 8; break;
            case 0xCB30: result = this._SWAP(this.register.b); this.register.b = result; cycles = 8; break;
            case 0xCB31: result = this._SWAP(this.register.c); this.register.c = result; cycles = 8; break;
            case 0xCB32: result = this._SWAP(this.register.d); this.register.d = result; cycles = 8; break;
            case 0xCB33: result = this._SWAP(this.register.e); this.register.e = result; cycles = 8; break;
            case 0xCB34: result = this._SWAP(this.register.h); this.register.h = result; cycles = 8; break;
            case 0xCB35: result = this._SWAP(this.register.l); this.register.l = result; cycles = 8; break;
            case 0xCB36: result = this._SWAP(this.system.mmu.readByte(this.getHL())); this.system.mmu.writeByte(this.getHL(), result); cycles = 16; break;
        }
        
        if (result) this.clearZ(); else this.setZ(); 
        this.clearN(); this.clearH(); this.clearC();
        this.system.consumeClockCycles(cycles);
    }

    _SWAP(value) { return ((value&0xF)<<4)+(value>>4); }
}