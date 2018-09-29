Z80 = {
    _flags: {
        zero: 0x80,
        subtraction: 0x40,
        halfCarry: 0x20,
        carry: 0x10
    },

    _clock: {
        t: 0
    },

    _map: [],
    _cbMap: [],

    _interval: null,

    _debug: {
        reg_dump: function () {
            traceLog.write("Z80", "--- DUMP--- ");
            traceLog.write("Z80", "A: 0x" + Z80._register.a.toHex(2));
            traceLog.write("Z80", "B: 0x" + Z80._register.b.toHex(2));
            traceLog.write("Z80", "C: 0x" + Z80._register.c.toHex(2));
            traceLog.write("Z80", "D: 0x" + Z80._register.d.toHex(2));
            traceLog.write("Z80", "E: 0x" + Z80._register.e.toHex(2));
            traceLog.write("Z80", "H: 0x" + Z80._register.h.toHex(2));
            traceLog.write("Z80", "L: 0x" + Z80._register.l.toHex(2));
            traceLog.write("Z80", "F: 0x" + Z80._register.f.toHex(2));
            traceLog.write("Z80", "PC: 0x" + Z80._register.pc.toHex(4));
            traceLog.write("Z80", "SP: 0x" + Z80._register.sp.toHex(4));
            traceLog.write("Z80", "BC: 0x" + ((Z80._register.b<<8)+Z80._register.c).toHex(4));
            traceLog.write("Z80", "DE: 0x" + ((Z80._register.d<<8)+Z80._register.e).toHex(4));
            traceLog.write("Z80", "HL: 0x" + ((Z80._register.h<<8)+Z80._register.l).toHex(4));
        }
    },



    opCode: 0,
    verbose: false,
    stopAt: null,

    frame: function () {
        let normalSpeed = 70224;
        let mode = 1;
        let frameClock = Z80._clock.t + (normalSpeed * mode);

        do {
            if (Z80._register.pc == Z80.stopAt && !MMU._biosEnabled) {
                clearInterval(Z80._interval);
                Z80._interval = null;            
                console.log(`Stop address reached: ${Z80.stopAt.toString(16).toUpperCase().padStart(4,"0")}`);
                break;
            }

            try {            
                Z80.step();
            } catch (error) {
                console.log(error);
                clearInterval(Z80._interval);
                Z80._interval = null;            
                break;
            }
        } while (Z80._clock.t < frameClock);
		Z80._clock.t = 0;

        // Save RAM to storage if there's a battery in the cartridge.
        if (Cartridge._memory.hasBattery && Cartridge._memory.ramIsDirty) {
            console.log(`Cart: saving ram`);
            localStorage.setItem(Cartridge._header.title, Cartridge._memory.ram);
            Cartridge._memory.ramIsDirty = false;
        }

        // GPU.renderTileMap();
        // GPU.renderBackgroundTileMap();
        // GPU.renderSpriteMap();
    },

    step: function () {
        if (Z80._register.pc < 0 || Z80._register.pc > 0xFFFF) throw "Program counter out of range.";        

        if (Z80._halted) {
            // CPU "powered down". Only wake up if there's an interrupt.
            Z80._register.t = 4;
        } else {
            Z80.opCode = MMU.readByte(Z80._register.pc++);
            
            if (!MMU._biosEnabled && Z80.verbose) traceLog.write("Z80", "$" + (Z80._register.pc-1).toString(16).toUpperCase().padStart(4,"0") + "\tOP: 0x" + Z80.opCode.toString(16).toUpperCase().padStart(2,"0"));
            
            try {
                Z80._map[Z80.opCode]();

                if (this._register.a == undefined) throw "reg a is undefined";
            } catch (error) {
                console.log("OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + Z80.opCode.toString(16));
                console.log(error);
                traceLog.write("Z80", "OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + Z80.opCode.toString(16));
                Z80._debug.reg_dump();
                clearInterval(Z80._interval);
                Z80._interval = null;            
                throw error;
            }        
            
            if (Z80.pendingEnableInterrupts) {
                if (Z80.pendingEnableInterrupts&0xF>0) Z80.pendingEnableInterrupts--;
                else { Z80._register.ime = true; Z80.pendingEnableInterrupts = 0; }
            }
            
            if (Z80.pendingDisableInterrupts) {
                if (Z80.pendingDisableInterrupts&0xF>0) Z80.pendingDisableInterrupts--;
                else { Z80._register.ime = false; Z80.pendingDisableInterrupts = 0; }
            }
        }
            
        Z80._clock.t += Z80._register.t;
        Z80._clock.t &= 0xFFFFFFFF;
        Timer.update();
        GPU.step();
        Z80.checkInterrupts();
    },



    _ops: {
        LDHL_SP_n: function () { // 0xF8 LDHL SP, n            
            let n = MMU.readByte(Z80._register.pc++);
            if (n>127) n = -((~n+1)&255);
            let result = (n + Z80._register.sp)&0xFFFF;
            Z80._register.h = (result>>8)&255;            
            Z80._register.l = result&255;            
            Z80.clearZ(); Z80.clearN();
            if (((Z80._register.sp ^ n ^ result)&0x100)==0x100) Z80.setC();
            else Z80.clearC();
            if (((Z80._register.sp ^ n ^ result)&0x10)==0x10) Z80.setH();
            else Z80.clearH();
            Z80._register.t = 12;
        },
        LD_d16mem_SP: function () { // 0x08 LD (nn), SP
            let address = MMU.readWord(Z80._register.pc); Z80._register.pc+=2; MMU.writeWord(address, Z80._register.sp); Z80._register.t = 20; },

        SBC_A_A: function () { // 0x9F
            ALU.SBC_A_n(Z80._register.a, 4); },
        SBC_A_B: function () { // 0x98
            ALU.SBC_A_n(Z80._register.b, 4); },
        SBC_A_C: function () { // 0x99
            ALU.SBC_A_n(Z80._register.c, 4); },
        SBC_A_D: function () { // 0x9A
            ALU.SBC_A_n(Z80._register.d, 4); },
        SBC_A_E: function () { // 0x9B
            ALU.SBC_A_n(Z80._register.e, 4); },
        SBC_A_H: function () { // 0x9C
            ALU.SBC_A_n(Z80._register.h, 4); },
        SBC_A_L: function () { // 0x9D
            ALU.SBC_A_n(Z80._register.l, 4); },
        SBC_A_HLmem: function () { // 0x9E
            ALU.SBC_A_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l), 8); },
        SBC_A_d8: function () { // 0xDE
            ALU.SBC_A_n(MMU.readByte(Z80._register.pc++), 8); },


                                        
                                                                                                                                                
    





     
        RRA: function () { // 0x1F

        },

        

        // RRC n
        RRC_A: function () { // CB 0x0F
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.a&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.a = ((Z80._register.a>>1)+(carryOut<<7))&255;
            if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_B: function () { // CB 0x08
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.b&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.b = ((Z80._register.b>>1)+(carryOut<<7))&255;
            if (!Z80._register.b) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_C: function () { // CB 0x09
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.c&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.c = ((Z80._register.c>>1)+(carryOut<<7))&255;
            if (!Z80._register.c) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_D: function () { // CB 0x0A
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.d&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.d = ((Z80._register.d>>1)+(carryOut<<7))&255;
            if (!Z80._register.d) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_E: function () { // CB 0x0B
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.e&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.e = ((Z80._register.e>>1)+(carryOut<<7))&255;
            if (!Z80._register.e) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_H: function () { // CB 0x0C
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.h&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.h = ((Z80._register.h>>1)+(carryOut<<7))&255;
            if (!Z80._register.h) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_L: function () { // CB 0x0D
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.l&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.l = ((Z80._register.l>>1)+(carryOut<<7))&255;
            if (!Z80._register.l) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RRC_HLmem: function () { // CB 0x0E
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let carryOut = hl&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            hl = ((hl>>1)+(carryOut<<7))&255;
            if (!hl) Z80.setZ(); else Z80.clearZ();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, hl);
            Z80._register.t = 16;
        },

      

        // RRC n
        RR_A: function () { // CB 0x1F
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.a&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.a = ((Z80._register.a>>1)+(carryIn<<7))&255;
            if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_B: function () { // CB 0x18
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.b&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.b = ((Z80._register.b>>1)+(carryIn<<7))&255;
            if (!Z80._register.b) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_C: function () { // CB 0x19
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.c&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.c = ((Z80._register.c>>1)+(carryIn<<7))&255;
            if (!Z80._register.c) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_D: function () { // CB 0x1A
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.d&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.d = ((Z80._register.d>>1)+(carryIn<<7))&255;
            if (!Z80._register.d) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_E: function () { // CB 0x1B
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.e&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.e = ((Z80._register.e>>1)+(carryIn<<7))&255;
            if (!Z80._register.e) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_H: function () { // CB 0x1C
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.h&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.h = ((Z80._register.h>>1)+(carryIn<<7))&255;
            if (!Z80._register.h) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_L: function () { // CB 0x1D
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.l&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.l = ((Z80._register.l>>1)+(carryIn<<7))&255;
            if (!Z80._register.l) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RR_HLmem: function () { // CB 0x1E
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let carryOut = hl&0x01?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            hl = ((hl>>1)+(carryIn<<7))&255;
            if (!hl) Z80.setZ(); else Z80.clearZ();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, hl);
            Z80._register.t = 16;
        },

        // SRA n
        SRA_A: function () { // CB 0x2F            
            Z80.clearN(); Z80.clearH();
            if (Z80._register.a&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.a = ((Z80._register.a>>1)+(Z80._register.a&0x80))&255;
            if (Z80._register.a) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_B: function () { // CB 0x28
            Z80.clearN(); Z80.clearH();
            if (Z80._register.b&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.b = ((Z80._register.b>>1)+(Z80._register.b&0x80))&255;
            if (Z80._register.b) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_C: function () { // CB 0x29
            Z80.clearN(); Z80.clearH();
            if (Z80._register.c&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.c = ((Z80._register.c>>1)+(Z80._register.c&0x80))&255;
            if (Z80._register.c) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_D: function () { // CB 0x2A
            Z80.clearN(); Z80.clearH();
            if (Z80._register.d&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.d = ((Z80._register.d>>1)+(Z80._register.d&0x80))&255;
            if (Z80._register.d) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_E: function () { // CB 0x2B
            Z80.clearN(); Z80.clearH();
            if (Z80._register.e&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.e = ((Z80._register.e>>1)+(Z80._register.e&0x80))&255;
            if (Z80._register.e) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_H: function () { // CB 0x2C
            Z80.clearN(); Z80.clearH();
            if (Z80._register.h&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.h = ((Z80._register.h>>1)+(Z80._register.h&0x80))&255;
            if (Z80._register.h) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_L: function () { // CB 0x2D
            Z80.clearN(); Z80.clearH();
            if (Z80._register.l&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.l = ((Z80._register.l>>1)+(Z80._register.l&0x80))&255;
            if (Z80._register.l) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRA_HLmem: function () { // CB 0x2E
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            if (hl&0x01) Z80.setC(); else Z80.clearC();
            hl = ((hl>>1)+(hl&0x80))&255;
            if (hl) Z80.clearZ(); else Z80.setZ();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, hl);
            Z80._register.t = 16;
        },

        NOT_IMPLEMENTED: function () {
            throw "FUNCTION NOT IMPLEMENTED";
        }
    }
};