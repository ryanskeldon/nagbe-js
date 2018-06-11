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

    _debug: {
        reg_dump: function () {
            traceLog.write("Z80", "--- DUMP--- ");
            traceLog.write("Z80", "A: 0x" + Z80._register.a.toString(16));
            traceLog.write("Z80", "B: 0x" + Z80._register.b.toString(16));
            traceLog.write("Z80", "C: 0x" + Z80._register.c.toString(16));
            traceLog.write("Z80", "D: 0x" + Z80._register.d.toString(16));
            traceLog.write("Z80", "E: 0x" + Z80._register.e.toString(16));
            traceLog.write("Z80", "H: 0x" + Z80._register.h.toString(16));
            traceLog.write("Z80", "L: 0x" + Z80._register.l.toString(16));
            traceLog.write("Z80", "F: 0x" + Z80._register.f.toString(16));
            traceLog.write("Z80", "PC: 0x" + Z80._register.pc.toString(16));
            traceLog.write("Z80", "SP: 0x" + Z80._register.sp.toString(16));
            traceLog.write("Z80", "BC: 0x" + ((Z80._register.b<<8)+Z80._register.c).toString(16));
            traceLog.write("Z80", "DE: 0x" + ((Z80._register.d<<8)+Z80._register.e).toString(16));
            traceLog.write("Z80", "HL: 0x" + ((Z80._register.h<<8)+Z80._register.l).toString(16));
        }
    },

    _register: {
        // Basic registers
        a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0,

        _ime: false, // Interrupt Master Enable

        // Carry flags
        // Flag types:
        // 0x80 - Zero
        // 0x40 - Subtraction
        // 0x20 - Half-carry
        // 0x10 - Carry
        f: 0,
        
        // Stack pointer
        sp: 0,

        // Program counter
        pc: 0,

        // Cycles for last instruction
        t: 0
    },

    frame: function () {
        let frameClock = Z80._clock.t + 70224;
        let targetInstruction = 0xffff;

        do {
            // if (!MMU._biosEnabled) { // Stop the CPU while still in dev.
            //     console.log("BIOS load complete!");
            //     traceLog.write("Z80", "BIOS load complete!");
            //     clearInterval(Z80._interval);
            //     Z80._interval = null;
            //     break;
            // }

            // TODO: Implement HALT check
            try {
                Z80.checkInterrupts();

                var opCode = MMU.readByte(Z80._register.pc++);
                Z80._register.pc &= 0xFFFF;
                //if (Z80._register.pc >= 0x100) traceLog.write("Z80", "$0x" + (Z80._register.pc-1).toString(16) + "\tOP: 0x" + opCode.toString(16));
                if (Z80._register.pc == targetInstruction) {Z80.run(); console.log("breaking");break;}
                Z80._map[opCode]();
                Z80._clock.t += Z80._register.t;

                GPU.step();
            } catch (error) {
                console.log("OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + opCode.toString(16));
                console.log(error);
                traceLog.write("Z80", "OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + opCode.toString(16));                
                clearInterval(Z80._interval);
                Z80._interval = null;
                break;
            }
        } while (Z80._clock.t < frameClock);
    },

    _interval: null,

    run: function () {
        if (!Z80._interval) {
            Z80._interval = setInterval(Z80.frame, 1);
        } else {
            clearInterval(Z80._interval);
            Z80._interval = null;
        }
    },

    start: function () {
        while (true) {
            if (Z80._register.pc === 0x100) { // Stop the CPU while still in dev.
                console.log("BIOS load complete!");
                traceLog.write("Z80", "BIOS load complete!");
                break;
            }

            Z80.checkInterrupts();

            var opCode = MMU.readByte(Z80._register.pc++);
            Z80._register.pc &= 0xFFFF;

            try {
                traceLog.write("Z80", "$0x" + (Z80._register.pc-1).toString(16) + "\tOP: 0x" + opCode.toString(16));
                Z80._map[opCode]();
                Z80._clock.t += Z80._register.t;
                GPU.step();
                
                if (Z80._clock.t >= 70224) {
                    Z80._clock.t = 0;
                    break;
                }                    
            } catch (error) {
                console.log("OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + opCode.toString(16));
                console.log(error);
                traceLog.write("Z80", "OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + opCode.toString(16));                
                break;
            }            
        }
    },
    
    checkInterrupts: function () {
        // Check if interrupts are enabled.
        if (!Z80._register._ime) return;

        // Check if anything is allowed to interrupt.
        if (!MMU.readByte(0xFFFF)) return; 

        let interrupts = MMU.readByte(0xFF0F); // Get active interrupt flags.

        if (!interupts) return; // Leave if nothing to handle.

        for (var i = 0; i < 5; i++) {
            // Check if the IE flag is set for the given interrupt.
            if (interrupts&1<<i && MMU.readByte(0xFFFF)&1<<i) {                
                Z80.handleInterrupt(i);
            }
        }
    },

    handleInterrupt: function (interrupt) {
        // TODO: Implement clock timings for interrupt handling.
        Z80.readByte._ime = false; // Disable interrupt handling.

        Z80._register.sp -= 2; // Push program counter to stack.
        MMU.writeWord(Z80._register.sp, Z80._register.pc); 

        interrupts &= ~(1<<interrupt); // Reset interrupt flag.
        MMU.writeByte(0xFF0F, interrupts);

        switch (interrupt) {
            case 0: Z80._register.pc = 0x40; break; // V-blank
            case 1: Z80._register.pc = 0x48; break; // LCD
            case 2: Z80._register.pc = 0x50; break; // Timer
            case 3:                          break; // Serial (not implemented)
            case 4: Z80._register.pc = 0x60; break; // Joypad
        }
    },

    requestInterrupt: function (id) {
        let interrupts = MMU.readByte(0xFF0F);
        interrupts |= id;
        MMU.writeByte(0xFF0F, interrupts);
    },

    reset: function () {
        Z80._register.a = 0;
        Z80._register.b = 0;
        Z80._register.c = 0;
        Z80._register.d = 0;
        Z80._register.e = 0;
        Z80._register.h = 0;
        Z80._register.l = 0;

        Z80._register.f = 0;

        Z80._register.pc = 0;
        Z80._register.sp = 0;

        Z80._register.t = 0;

        Z80._clock.t = 0;
    },

    _ops: {
        // LD nn, n
        LD_B_n: function () { // 0x06 LD b, n
            Z80._register.b = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_C_n: function () { // 0x0E LD c, n
            Z80._register.c = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_D_n: function () { // 0x16 LD d, n
            Z80._register.d = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_E_n: function () { // 0x1E LD e, n
            Z80._register.e = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_H_n: function () { // 0x26 LD h, n
            Z80._register.h = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_L_n: function () { // 0x2E LD l, n
            Z80._register.l = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },

        // LD r1, r2
        LD_A_A: function () { // 0x7F LD A, A
            Z80._register.a = Z80._register.a; Z80._register.t = 4; },
        LD_A_B: function () { // 0x78 LD A, B
            Z80._register.a = Z80._register.b; Z80._register.t = 4; },
        LD_A_C: function () { // 0x79 LD A, C
            Z80._register.a = Z80._register.c; Z80._register.t = 4; },
        LD_A_D: function () { // 0x7A LD A, D
            Z80._register.a = Z80._register.d; Z80._register.t = 4; },
        LD_A_E: function () { // 0x7B LD A, E
            Z80._register.a = Z80._register.e; Z80._register.t = 4; },
        LD_A_H: function () { // 0x7C LD A, H
            Z80._register.a = Z80._register.h; Z80._register.t = 4; },
        LD_A_L: function () { // 0x7D LD A, L
            Z80._register.a = Z80._register.l; Z80._register.t = 4; },
        LD_A_BCmem: function () { // 0x0A LD A, (BC)
            Z80._register.a = MMU.readByte((Z80._register.b<<8) + Z80._register.c); Z80._register.t = 8; },
        LD_A_DEmem: function () { // 0x1A LD A, (DE)
            Z80._register.a = MMU.readByte((Z80._register.d<<8) + Z80._register.e); Z80._register.t = 8; },
        LD_A_HLmem: function () { // 0x7E LD A, (HL)
            Z80._register.a = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },
        LD_A_d16mem: function () { // 0xFA LD A, (nn)
            Z80._register.a = MMU.readByte(MMU.readWord(Z80._register.pc)); Z80._register.pc+=2; Z80._register.t = 16; },    
        LD_A_d8: function () { // 0x3E LD A, n
            Z80._register.a = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
    
        LD_B_B: function () { // 0x40 LD B, B
            Z80._register.b = Z80._register.b; Z80._register.t = 4; },
        LD_B_C: function () { // 0x41 LD B, C
            Z80._register.b = Z80._register.c; Z80._register.t = 4; },
        LD_B_D: function () { // 0x42 LD B, D
            Z80._register.b = Z80._register.d; Z80._register.t = 4; },
        LD_B_E: function () { // 0x43 LD B, E
            Z80._register.b = Z80._register.e; Z80._register.t = 4; },
        LD_B_H: function () { // 0x44 LD B, H
            Z80._register.b = Z80._register.h; Z80._register.t = 4; },
        LD_B_L: function () { // 0x45 LD B, L
            Z80._register.b = Z80._register.l; Z80._register.t = 4; },
        LD_B_HLmem: function () { // 0x46 LD B, (HL)
            Z80._register.b = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },

        LD_C_B: function () { // 0x48 LD C, B
            Z80._register.c = Z80._register.b; Z80._register.t = 4; },
        LD_C_C: function () { // 0x49 LD C, C
            Z80._register.c = Z80._register.c; Z80._register.t = 4; },
        LD_C_D: function () { // 0x4A LD C, D
            Z80._register.c = Z80._register.d; Z80._register.t = 4; },
        LD_C_E: function () { // 0x4B LD C, E
            Z80._register.c = Z80._register.e; Z80._register.t = 4; },
        LD_C_H: function () { // 0x4C LD C, H
            Z80._register.c = Z80._register.h; Z80._register.t = 4; },
        LD_C_L: function () { // 0x4D LD C, L
            Z80._register.c = Z80._register.l; Z80._register.t = 4; },
        LD_C_HLmem: function () { // 0x4E LD C, (HL)
            Z80._register.c = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },

        LD_D_B: function () { // 0x50 LD D, B
            Z80._register.d = Z80._register.b; Z80._register.t = 4; },
        LD_D_C: function () { // 0x51 LD D, C
            Z80._register.d = Z80._register.c; Z80._register.t = 4; },
        LD_D_D: function () { // 0x52 LD D, D
            Z80._register.d = Z80._register.d; Z80._register.t = 4; },
        LD_D_E: function () { // 0x53 LD D, E
            Z80._register.d = Z80._register.e; Z80._register.t = 4; },
        LD_D_H: function () { // 0x54 LD D, H
            Z80._register.d = Z80._register.h; Z80._register.t = 4; },
        LD_D_L: function () { // 0x55 LD D, L
            Z80._register.d = Z80._register.l; Z80._register.t = 4; },
        LD_D_HLmem: function () { // 0x56 LD D, (HL)
            Z80._register.d = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },

        LD_E_B: function () { // 0x58 LD E, B
            Z80._register.e = Z80._register.b; Z80._register.t = 4; },
        LD_E_C: function () { // 0x59 LD E, C
            Z80._register.e = Z80._register.c; Z80._register.t = 4; },
        LD_E_D: function () { // 0x5A LD E, D
            Z80._register.e = Z80._register.d; Z80._register.t = 4; },
        LD_E_E: function () { // 0x5B LD E, E
            Z80._register.e = Z80._register.e; Z80._register.t = 4; },
        LD_E_H: function () { // 0x5C LD E, H
            Z80._register.e = Z80._register.h; Z80._register.t = 4; },
        LD_E_L: function () { // 0x5E LD E, L
            Z80._register.e = Z80._register.l; Z80._register.t = 4; },
        LD_E_HLmem: function () { // 0x5E LD E, (HL)
            Z80._register.e = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },

        LD_H_B: function () { // 0x60 LD H, B
            Z80._register.h = Z80._register.b; Z80._register.t = 4; },
        LD_H_C: function () { // 0x61 LD H, C
            Z80._register.h = Z80._register.c; Z80._register.t = 4; },
        LD_H_D: function () { // 0x62 LD H, D
            Z80._register.h = Z80._register.d; Z80._register.t = 4; },
        LD_H_E: function () { // 0x63 LD H, E
            Z80._register.h = Z80._register.e; Z80._register.t = 4; },
        LD_H_H: function () { // 0x64 LD H, H
            Z80._register.h = Z80._register.h; Z80._register.t = 4; },
        LD_H_L: function () { // 0x65 LD H, L
            Z80._register.h = Z80._register.l; Z80._register.t = 4; },
        LD_H_HLmem: function () { // 0x66 LD H, (HL)
            Z80._register.h = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },

        LD_L_B: function () { // 0x68 LD L, B
            Z80._register.l = Z80._register.b; Z80._register.t = 4; },
        LD_L_C: function () { // 0x69 LD L, C
            Z80._register.l = Z80._register.c; Z80._register.t = 4; },
        LD_L_D: function () { // 0x6A LD L, D
            Z80._register.l = Z80._register.d; Z80._register.t = 4; },
        LD_L_E: function () { // 0x6B LD L, E
            Z80._register.l = Z80._register.e; Z80._register.t = 4; },
        LD_L_H: function () { // 0x6C LD L, H
            Z80._register.l = Z80._register.h; Z80._register.t = 4; },
        LD_L_L: function () { // 0x6D LD L, L
            Z80._register.l = Z80._register.l; Z80._register.t = 4; },
        LD_L_HLmem: function () { // 0x6E LD L, (HL)
            Z80._register.l = MMU.readByte((Z80._register.h<<8) + Z80._register.l); Z80._register.t = 8; },

        LD_HLmem_B: function () { // 0x70 LD (HL), B
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, Z80._register.b); Z80._register.t = 8; },
        LD_HLmem_C: function () { // 0x71 LD (HL), C
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, Z80._register.c); Z80._register.t = 8; },
        LD_HLmem_D: function () { // 0x72 LD (HL), D
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, Z80._register.d); Z80._register.t = 8; },
        LD_HLmem_E: function () { // 0x73 LD (HL), E
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, Z80._register.e); Z80._register.t = 8; },
        LD_HLmem_H: function () { // 0x74 LD (HL), H
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, Z80._register.h); Z80._register.t = 8; },
        LD_HLmem_L: function () { // 0x75 LD (HL), L
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, Z80._register.l); Z80._register.t = 8; },
        LD_HLmem_d8: function () { // 0x36 LD (HL), n
            MMU.writeByte((Z80._register.h<<8) + Z80._register.l, MMU.readByte(Z80._register.pc++)); Z80._register.t = 12; },            

        // LD n, A
        LD_B_A: function () { // 0x47 LD B, A
            Z80._register.b = Z80._register.a; Z80._register.t = 4; },
        LD_C_A: function () { // 0x4F LD C, A
            Z80._register.c = Z80._register.a; Z80._register.t = 4; },
        LD_D_A: function () { // 0x57 LD D, A
            Z80._register.d = Z80._register.a; Z80._register.t = 4; },
        LD_E_A: function () { // 0x5F LD E, A
            Z80._register.e = Z80._register.a; Z80._register.t = 4; },
        LD_H_A: function () { // 0x67 LD H, A
            Z80._register.h = Z80._register.a; Z80._register.t = 4; },
        LD_L_A: function () { // 0x6F LD L, A
            Z80._register.l = Z80._register.a; Z80._register.t = 4; },
        LD_BCmem_A: function () { // 0x02 LD (BC), A
            MMU.writeWord((Z80._register.b<<8)+Z80._register.c, Z80._register.a); Z80._register.t = 8; },
        LD_DEmem_A: function () { // 0x12 LD (DE), A
            MMU.writeWord((Z80._register.d<<8)+Z80._register.e, Z80._register.a); Z80._register.t = 8; },
        LD_HLmem_A: function () { // 0x77 LD (HL), A
            MMU.writeWord((Z80._register.h<<8)+Z80._register.l, Z80._register.a); Z80._register.t = 8; },
        LD_a16mem_A: function () { // 0xEA LD (nn), A
            MMU.writeByte(MMU.readWord(Z80._register.pc), Z80._register.a); Z80._register.pc+=2; Z80._register.t = 16; },    

        LD_A_Cmem: function () { // 0xF2 LD A, (C)
            Z80._register.a = MMU.readByte(0xFF00 + Z80._register.c); Z80._register.t = 8; },
        LD_Cmem_A: function () { // 0xE2 LD A, (C)
            MMU.writeByte(0xFF00 + Z80._register.c, 0xFF00 + Z80._register.a); Z80._register.t = 8; },

        LDD_A_HLmem: function () { // 0x3A LDD A, (HL)
            Z80._register.a = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            Z80._register.l = (Z80._register.l-1)&255;
            if (Z80._register.l == 255) Z80._register.h = (Z80._register.h-1)&255;
            Z80._register.t = 8;
        },
        LDD_HLmem_A: function () { // 0x32 LDD (HL), A
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.a);
            Z80._register.l = (Z80._register.l-1)&255;
            if (Z80._register.l == 255) Z80._register.h = (Z80._register.h-1)&255;
            Z80._register.t = 8;
        },
        LDI_A_HLmem: function () { // 0x2A LDA A, (HL)
            Z80._register.a = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            Z80._register.l = (Z80._register.l+1)&255;
            if (Z80._register.l == 0) Z80._register.h = (Z80._register.h+1)&255;
            Z80._register.t = 8;
        },
        LDI_HLmem_A: function () { // 0x22 LDI (HL), A
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.a);
            Z80._register.l = (Z80._register.l+1)&255;
            if (Z80._register.l == 0) Z80._register.h = (Z80._register.h+1)&255;
            Z80._register.t = 8;
        },
        LDH_d8mem_A: function () { // 0xE0 LDH ($FF00+n), A
            MMU.writeByte(MMU.readByte(Z80._register.pc++)+0xFF00, Z80._register.a); Z80._register.t = 12; },
        LDH_A_d8mem: function () { // 0xF0 LDH A, ($FF00+n)
            Z80._register.a = MMU.readByte(0xFF00+MMU.readByte(Z80._register.pc++)); Z80._register.t = 12; },
        LD_BC_d16: function () { // 0x01 LD BC, nn
            Z80._register.c = MMU.readByte(Z80._register.pc++); Z80._register.b = MMU.readByte(Z80._register.pc++); Z80._register.t = 12; },
        LD_DE_d16: function () { // 0x11 LD DE, nn
            Z80._register.e = MMU.readByte(Z80._register.pc++); Z80._register.d = MMU.readByte(Z80._register.pc++); Z80._register.t = 12; },
        LD_HL_nn: function () { // 0x21 LD HL, nn
            Z80._register.l = MMU.readByte(Z80._register.pc++); Z80._register.h = MMU.readByte(Z80._register.pc++); Z80._register.t = 12; },
        LD_SP_nn: function () { // 0x31 LD SP, nn
            Z80._register.sp = MMU.readWord(Z80._register.pc); Z80._register.pc += 2; Z80._register.t = 12; },
        LD_SP_HL: function () { // 0xF9 LD SP, HL
            Z80._register.sp = (Z80._register.h<<8)+Z80._register.l; Z80._register.t = 8; },
        LDHL_SP_n: function () { // 0xF8 LDHL SP, n
            Z80._register.f &= ~(Z80._flags.zero+Z80._flags.subtraction);
            let value = MMU.readByte(Z80._register.pc++);
            if (value>127) value = -((~value+1)&255);
            value += Z80._register.sp;
            Z80._register.h = (value>>8)&255;
            Z80._register.l = value&255;
            Z80._register.t = 12;
        },
        LD_d16mem_SP: function () { // 0x08 LD (nn), SP
            let address = MMU.readWord(Z80._register.pc); Z80._register.pc+=2; MMU.writeWord(address, Z80._register.sp); Z80._register.t = 20; },
        PUSH_AF: function () { // 0xF5 PUSH AF
            Z80._register.sp-=2; MMU.writeWord(Z80._register.sp, (Z80._register.a<<8)+Z80._register.f); Z80._register.t = 16; },    
        PUSH_BC: function () { // 0xC5 PUSH BC
            Z80._register.sp-=2; MMU.writeWord(Z80._register.sp, (Z80._register.b<<8)+Z80._register.c); Z80._register.t = 16; },
        PUSH_DE: function () { // 0xD5 PUSH DE
            Z80._register.sp-=2; MMU.writeWord(Z80._register.sp, (Z80._register.d<<8)+Z80._register.e); Z80._register.t = 16; },        
        PUSH_HL: function () { // 0xE5 PUSH HL
            Z80._register.sp-=2; MMU.writeWord(Z80._register.sp, (Z80._register.h<<8)+Z80._register.l); Z80._register.t = 16; },

        POP_AF: function () { // 0xF1 POP AF
            Z80._register.f = MMU.readByte(Z80._register.sp++); Z80._register.a = MMU.readByte(Z80._register.sp++); Z80._register.t = 12; },
        POP_BC: function () { // 0xC1 POP BC
            Z80._register.c = MMU.readByte(Z80._register.sp++); Z80._register.b = MMU.readByte(Z80._register.sp++); Z80._register.t = 12; },
        POP_DE: function () { // 0xD1 POP DE
            Z80._register.e = MMU.readByte(Z80._register.sp++); Z80._register.d = MMU.readByte(Z80._register.sp++); Z80._register.t = 12; },
        POP_HL: function () { // 0xE1 POP HL
            Z80._register.l = MMU.readByte(Z80._register.sp++); Z80._register.h = MMU.readByte(Z80._register.sp++); Z80._register.t = 12; },

        ADD_A_A: function () { // 0x87
            ALU.ADD_A_n(Z80._register.a, 4); },
        ADD_A_B: function () { // 0x80
            ALU.ADD_A_n(Z80._register.b, 4); },
        ADD_A_C: function () { // 0x81
            ALU.ADD_A_n(Z80._register.c, 4); },
        ADD_A_D: function () { // 0x82
            ALU.ADD_A_n(Z80._register.d, 4); },
        ADD_A_E: function () { // 0x83
            ALU.ADD_A_n(Z80._register.e, 4); },
        ADD_A_H: function () { // 0x84
            ALU.ADD_A_n(Z80._register.h, 4); },
        ADD_A_L: function () { // 0x85
            ALU.ADD_A_n(Z80._register.l, 4); },
        ADD_A_HLmem: function () { // 0x86
            ALU.ADD_A_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l), 8); },
        ADD_A_d8: function () { // 0xC6
            ALU.ADD_A_n(MMU.readByte(Z80._register.pc++), 8); },

        ADC_A_A: function () { // 0x8F ADC A, A
            ALU.ADC_A_n(Z80._register.a, 4); },
        ADC_A_B: function () { // 0x88 ADC A, B
            ALU.ADC_A_n(Z80._register.b, 4); },
        ADC_A_C: function () { // 0x89 ADC A, C
            ALU.ADC_A_n(Z80._register.c, 4); },
        ADC_A_D: function () { // 0x8A ADC A, D
            ALU.ADC_A_n(Z80._register.d, 4); },
        ADC_A_E: function () { // 0x8B ADC A, E
            ALU.ADC_A_n(Z80._register.e, 4); },
        ADC_A_H: function () { // 0x8C ADC A, H
            ALU.ADC_A_n(Z80._register.h, 4); },
        ADC_A_L: function () { // 0x8D ADC A, L
            ALU.ADC_A_n(Z80._register.l, 4); },
        ADC_A_HLmem: function () { // 0x8E ADC A, (HL)
            ALU.ADC_A_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l), 8); },
        ADC_A_d8: function () { // 0xCE ADC A, d8
            ALU.ADC_A_n(MMU.readByte(Z80._register.pc++), 8); },

        SUB_A: function (input, time) { // 0x97
            ALU.SUB_n(Z80._register.a, 4); },
        SUB_B: function (input, time) { // 0x90
            ALU.SUB_n(Z80._register.b, 4); },
        SUB_C: function (input, time) { // 0x91
            ALU.SUB_n(Z80._register.c, 4); },
        SUB_D: function (input, time) { // 0x92
            ALU.SUB_n(Z80._register.d, 4); },
        SUB_E: function (input, time) { // 0x93
            ALU.SUB_n(Z80._register.e, 4); },
        SUB_H: function (input, time) { // 0x94
            ALU.SUB_n(Z80._register.h, 4); },
        SUB_L: function (input, time) { // 0x95
            ALU.SUB_n(Z80._register.l, 4); },
        SUB_HLmem: function (input, time) { // 0x96
            ALU.SUB_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l), 8); },
        SUB_d8: function (input, time) { // 0xD6
            ALU.SUB_n(MMU.readByte(Z80._register.pc++), 8); },
                                                                                                                                                                                    
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

        DEC_BC: function () { // 0x0B
            Z80._register.c = (Z80._register.c-1)&255; if (Z80._register.c == 255) Z80._register.b--; Z80._register.t = 8; },
        DEC_DE: function () { // 0x1B
            Z80._register.e = (Z80._register.e-1)&255; if (Z80._register.e == 255) Z80._register.d--; Z80._register.t = 8; },
        DEC_HL: function () { // 0x2B
            Z80._register.l = (Z80._register.l-1)&255; if (Z80._register.l == 255) Z80._register.h--; Z80._register.t = 8; },
        DEC_SP: function () { // 0x3B
            Z80._register.sp--; Z80._register.t = 8; },
                                        
        OR_A: function () { // 0xB7
            ALU.OR_n(Z80._register.a, 4); },
        OR_B: function () { // 0xB0
            ALU.OR_n(Z80._register.b, 4); },
        OR_C: function () { // 0xB1
            ALU.OR_n(Z80._register.c, 4); },
        OR_D: function () { // 0xB2
            ALU.OR_n(Z80._register.d, 4); },
        OR_E: function () { // 0xB3
            ALU.OR_n(Z80._register.e, 4); },
        OR_H: function () { // 0xB4
            ALU.OR_n(Z80._register.h, 4); },
        OR_L: function () { // 0xB5
            ALU.OR_n(Z80._register.l, 4); },
        OR_HLmem: function () { // 0xB6
            ALU.OR_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l, 8)); },
        OR_d8: function () { // 0xF6
            ALU.OR_n(MMU.readByte(Z80._register.pc++), 8); },
                                                                                                                                                
        AND_A: function () { // 0xA7
            ALU.AND_n(Z80._register.a, 4); },
        AND_B: function () { // 0xA0
            ALU.AND_n(Z80._register.b, 4); },
        AND_C: function () { // 0xA1
            ALU.AND_n(Z80._register.c, 4); },
        AND_D: function () { // 0xA2
            ALU.AND_n(Z80._register.d, 4); },
        AND_E: function () { // 0xA3
            ALU.AND_n(Z80._register.e, 4); },
        AND_H: function () { // 0xA4
            ALU.AND_n(Z80._register.h, 4); },
        AND_L: function () { // 0xA5
            ALU.AND_n(Z80._register.l, 4); },
        AND_HLmem: function () { // 0xA6
            ALU.AND_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l, 8)); },
        AND_d8: function () { // 0xE6
            ALU.AND_n(MMU.readByte(Z80._register.pc++), 8); },
                                                                                                                                                
        CALL_NZ_nn: function () { // 0xC4
            ALU.CALL_cc_nn((Z80._register.f&Z80._flags.zero)==0, 24, 12); },
        CALL_Z_nn: function () { // 0xCC
            ALU.CALL_cc_nn(Z80._register.f&Z80._flags.zero, 24, 12); },
        CALL_NC_nn: function () { // 0xD4
            ALU.CALL_cc_nn((Z80._register.f&Z80._flags.carry)==0, 24, 12); },
        CALL_C_nn: function () { // 0xDC
            ALU.CALL_cc_nn(Z80._register.f&Z80._flags.zero, 24, 12); },                    
            
        XOR_A: function () { // 0xAF            
            ALU.XOR_n(Z80._register.a, 4); },
        XOR_B: function () { // 0xA8            
            ALU.XOR_n(Z80._register.b, 4); },
        XOR_C: function () { // 0xA9            
            ALU.XOR_n(Z80._register.c, 4); },
        XOR_D: function () { // 0xAA            
            ALU.XOR_n(Z80._register.d, 4); },
        XOR_E: function () { // 0xAC            
            ALU.XOR_n(Z80._register.e, 4); },
        XOR_H: function () { // 0xAC            
            ALU.XOR_n(Z80._register.h, 4); },
        XOR_L: function () { // 0xAD            
            ALU.XOR_n(Z80._register.l, 4); },
        XOR_HLmem: function () { // 0xAE            
            ALU.XOR_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l, 8)); },
        XOR_d8: function () { // 0xEE
            ALU.XOR_n(MMU.readByte(Z80._register.pc++), 8); },
    
        JP_HLmem: function () { // 0xE9
            Z80._register.pc = MMU.readWord(Z80._register.pc); Z80._register.t = 4; },

        RET: function () { // 0xC9 RET
            Z80._register.pc = MMU.readWord(Z80._register.sp); Z80._register.sp+=2; Z80._register.t = 8; },

        RET_NZ: function () { // 0xC0
            Z80._ops.RET_cc((Z80._register.f&Z80._flags.zero)==0, 20, 8); },
        RET_Z: function () { // 0xC8
            Z80._ops.RET_cc(Z80._register.f&Z80._flags.zero, 20, 8); },
        RET_NC: function () { // 0xD0
            Z80._ops.RET_cc((Z80._register.f&Z80._flags.carry)==0, 20, 8); },
        RET_C: function () { // 0xD8
            Z80._ops.RET_cc(Z80._register.f&Z80._flags.carry, 20, 8); },
                        
        RET_cc: function (condition, trueTime, falseTime) {
            if (condition) {
                Z80._register.pc = MMU.readWord(Z80._register.sp); Z80._register.sp+=2;
                Z80._register.t = trueTime;
            } else {
                Z80._register.t = falseTime;
            }
        },

        CPL: function () { // 0x2F
            Z80._register.f |= Z80._flags.subtraction + Z80._flags.halfCarry;
            Z80._register.a = ~Z80._register.a;
            Z80._register.t = 4;
        },


        // Jumps
        JP_d16: function () { // 0xC3 JP nn
            // Jump to the position of the next word.
            Z80._register.pc = MMU.readWord(Z80._register.pc);
        
            Z80._register.t = 12;
        },
        JR_n: function () { // 0x18 JR n
            let move = MMU.readByte(Z80._register.pc++);

            if (move > 127) { // move is signed byte.
                // Calculate the 2's compliment and make it a negative.
                move = -((~move+1)&255);
            }

            Z80._register.pc = Z80._register.pc + move; // Move PC the number of bytes in the next address.
            Z80._register.t = 12;                       // Set operation time.
        },
        JR_nz_n: function () { // 0x20
            let move = MMU.readByte(Z80._register.pc++);

            // Check if Zero flag is set.
            if (!(Z80._register.f & Z80._flags.zero)) {                
                if (move > 127) { // move is signed byte.
                    // Calculate the 2's compliment and make it a negative.
                    move = -((~move+1)&255);
                }

                Z80._register.pc = Z80._register.pc + move; // Move PC the number of bytes in the next address.
                Z80._register.t = 12;                       // Set operation time.
            } else {
                Z80._register.t = 8;                        // Set operation time.
            }
        },
        JR_z_n: function () { // 0x28
            let move = MMU.readByte(Z80._register.pc++);

            // Check if Zero flag is set.
            if (Z80._register.f & Z80._flags.zero) {
                if (move > 127) { // move is signed byte.
                    // Calculate the 2's compliment and make it a negative.
                    move = -((~move+1)&255);
                }

                Z80._register.pc = Z80._register.pc + move; // Move PC the number of bytes in the next address.
                Z80._register.t = 12;                       // Set operation time.
            } else {
                Z80._register.t = 8;                        // Set operation time.
            }
        },

                                                                                                       


        // Calls
        CALL_nn: function() { // 0xCD CALL nn
            let address = MMU.readWord(Z80._register.pc);       // Get address of new instruction.
            Z80._register.pc+=2;
            Z80._register.sp-=2;                                // Move down 1 word.
            MMU.writeWord(Z80._register.sp, Z80._register.pc);  // Push address of next instruction
            Z80._register.pc = address;                         // Jump to new instruction.
        },



        // CP n
        CP_HLmem: function () { // 0xBE CP (HL)
            let value = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let result = Z80._register.a-value;
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= result&255 ? 0 : Z80._flags.zero;
            Z80._register.f |= Z80._register.a < value ? Z80._flags.carry : 0;
            Z80._register.f |= ((Z80._register.a&0xf) - (value&0xf)) < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.t = 8;
        },
        CP_d8: function () { // 0xFE CP #
            let value = MMU.readByte(Z80._register.pc++); // Read next byte to use as comparison.
            let result = Z80._register.a-value;           // Don't mask to 8-bit.
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= result&255 ? 0 : Z80._flags.zero;
            Z80._register.f |= Z80._register.a < value ? Z80._flags.carry : 0;
            Z80._register.f |= ((Z80._register.a&0xf) - (value&0xf)) < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.t = 8;
        },

        
        // INC n
        INC_A: function () { // 0x3C                        
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.a&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.a = (Z80._register.a+1)&255;
            Z80._register.f |= Z80._register.a ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_B: function () { // 0x04            
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.b&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.b = (Z80._register.b+1)&255;
            Z80._register.f |= Z80._register.b ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_C: function () { // 0x0C            
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.c&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.c = (Z80._register.c+1)&255;
            Z80._register.f |= Z80._register.c ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_D: function () { // 0x14            
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.d&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.d = (Z80._register.d+1)&255;
            Z80._register.f |= Z80._register.d ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_E: function () { // 0x1C            
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.e&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.e = (Z80._register.e+1)&255;
            Z80._register.f |= Z80._register.e ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_H: function () { // 0x24
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.h&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.h = (Z80._register.h+1)&255;
            Z80._register.f |= Z80._register.h ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_L: function () { // 0x2C            
            Z80._register.f = 0;
            Z80._register.f |= (Z80._register.l&0xf)+1 > 0xf ? Z80._flags.halfCarry : 0;
            Z80._register.l = (Z80._register.l+1)&255;
            Z80._register.f |= Z80._register.l ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },        

        INC_BC: function () { // 0x03 INC BC
            Z80._register.c = (Z80._register.c + 1) & 255;                              // Add 1 then mask to 8-bit;
            if (Z80._register.c == 0) Z80._register.b = (Z80._register.b + 1) & 255;    // Check for overflow of L, increase H by 1.
            Z80._register.t = 8;                                                        // Set operation time.
        },
        INC_DE: function () { // 0x13 INC DE
            Z80._register.e = (Z80._register.e + 1) & 255;                              // Add 1 then mask to 8-bit;
            if (Z80._register.e == 0) Z80._register.d = (Z80._register.d + 1) & 255;    // Check for overflow of L, increase H by 1.
            Z80._register.t = 8;                                                        // Set operation time.
        },
        INC_HL: function () { // 0x23 INC HL
            Z80._register.l = (Z80._register.l + 1) & 255;                              // Add 1 then mask to 8-bit;
            if (Z80._register.l == 0) Z80._register.h = (Z80._register.h + 1) & 255;    // Check for overflow of L, increase H by 1.
            Z80._register.t = 8;                                                        // Set operation time.
        },


        // DEC n
        DEC_A: function () { // 0x3D DEC A
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.a&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.a = (Z80._register.a-1)&255;
            Z80._register.f |= Z80._register.a ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        DEC_B: function () { // 0x05 DEC B
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.b&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.b = (Z80._register.b-1)&255;
            Z80._register.f |= Z80._register.b ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        DEC_C: function () { // 0x0D DEC C
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.c&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.c = (Z80._register.c-1)&255;
            Z80._register.f |= Z80._register.c ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        DEC_D: function () { // 0x15 DEC D
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.d&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.d = (Z80._register.d-1)&255;
            Z80._register.f |= Z80._register.d ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        DEC_E: function () { // 0x1D DEC e
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.e&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.e = (Z80._register.e-1)&255;
            Z80._register.f |= Z80._register.e ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        DEC_H: function () { // 0x25 DEC H
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.h&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.h = (Z80._register.h-1)&255;
            Z80._register.f |= Z80._register.h ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        DEC_L: function () { // 0x2D DEC L
            Z80._register.f = Z80._flags.subtraction;
            Z80._register.f |= (Z80._register.l&0xf)-1 < 0 ? 0 : Z80._flags.halfCarry;
            Z80._register.l = (Z80._register.l-1)&255;
            Z80._register.f |= Z80._register.l ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },


        // Rotations 
        RLA: function () { // 0x17
            let carryIn = Z80._register.f & Z80._flags.carry ? 1 : 0;
            let carryOut = Z80._register.a & 0x80 ? Z80._flags.carry : 0;
            Z80._register.a = (Z80._register.a<<1) + carryIn;
            Z80._register.a &= 255;
            Z80._register.f = carryOut;
            Z80._register.t = 4;
        },

        // RL n
        RL_C: function () { // CB 0x11            
            let carryIn = Z80._register.f & Z80._flags.carry ? 1 : 0;
            let carryOut = Z80._register.c & 0x80 ? Z80._flags.carry : 0;
            Z80._register.c = (Z80._register.c<<1) + carryIn;
            Z80._register.c &= 255;
            Z80._register.f = carryOut;
            Z80._register.t = 8;
        },


        // Bits
        BIT_7_h: function () { // CB 0x7C
            Z80._register.f = Z80._flags.halfCarry;                                     // Enable just the half-carry flag.
            Z80._register.f |= (Z80._register.h & 0x80) === 0 ? Z80._flags.zero : 0;    // Check if bit 7 is zero, set flag if true.
            Z80._register.m = 2; Z80._register.t = 8;                                   // Set operation time.
        },


        // Misc OpCodes
        map_to_CB: function () { // 0xCB            
            let cbAddress = MMU.readByte(Z80._register.pc++);   // Read next byte for the address of the CB code.            
            //traceLog.write("Z80", "\tCB OP: 0x" + cbAddress.toString(16));
            try {
                Z80._cbMap[cbAddress]();                            // Run the OpCode in the CB map.            
                Z80._register.pc &= 65535;                          // Mask the PC to 16-bit.
                Z80._register.m = 1; Z80._register.t = 4;           // Set operation time.
            } catch (error) {
                console.log("CB OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + cbAddress.toString(16));
            }
        },
        NOP: function () { // 0x00
            Z80._register.t = 4; },
        DI: function () { // 0xF3
            Z80._ime = false; Z80._register.t = 4; },
        EI: function () { // 0xFB
            Z80._ime = true; Z80._register.t = 4; },

        SWAP_A: function () { // CB 0x37
            Z80._register.a = Z80._ops.SWAP_n(Z80._register.a); Z80._register.t = 8; },
        SWAP_B: function () { // CB 0x30
            Z80._register.b = Z80._ops.SWAP_n(Z80._register.b); Z80._register.t = 8; },
        SWAP_C: function () { // CB 0x31
            Z80._register.c = Z80._ops.SWAP_n(Z80._register.c); Z80._register.t = 8; },
        SWAP_D: function () { // CB 0x32
            Z80._register.d = Z80._ops.SWAP_n(Z80._register.d); Z80._register.t = 8; },
        SWAP_E: function () { // CB 0x33
            Z80._register.e = Z80._ops.SWAP_n(Z80._register.e); Z80._register.t = 8; },
        SWAP_H: function () { // CB 0x34
            Z80._register.h = Z80._ops.SWAP_n(Z80._register.h); Z80._register.t = 8; },
        SWAP_L: function () { // CB 0x35
            Z80._register.l = Z80._ops.SWAP_n(Z80._register.l); Z80._register.t = 8; },
        SWAP_HLmem: function () { // CB 0x36
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._ops.SWAP_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l))); Z80._register.t = 16; },
                                                                                                                                                


        SWAP_n: function (input) {
            let upper = input>>4;
            let lower = input&0xF;
            let value = (lower<<4)+upper;

            Z80._register.f = value ? 0 : Z80._flags.zero;

            return value;
        }
    },

    _map: [],
    _cbMap: []
};

Z80._map = [
    // 00 - 0F
    Z80._ops.NOP, Z80._ops.LD_BC_d16, Z80._ops.LD_BCmem_A, Z80._ops.INC_BC, Z80._ops.INC_B, Z80._ops.DEC_B, Z80._ops.LD_B_n, null, Z80._ops.LD_d16mem_SP, null, Z80._ops.LD_A_BCmem, Z80._ops.DEC_BC, Z80._ops.INC_C, Z80._ops.DEC_C, Z80._ops.LD_C_n, null, 
    // 10 - 1F
    null, Z80._ops.LD_DE_d16, Z80._ops.LD_DEmem_A, Z80._ops.INC_DE, Z80._ops.INC_D, Z80._ops.DEC_D, Z80._ops.LD_D_n, Z80._ops.RLA, Z80._ops.JR_n, null, Z80._ops.LD_A_DEmem, Z80._ops.DEC_DE, Z80._ops.INC_E, Z80._ops.DEC_E, Z80._ops.LD_E_n, null, 
    // 20 - 2F
    Z80._ops.JR_nz_n, Z80._ops.LD_HL_nn, Z80._ops.LDI_HLmem_A, Z80._ops.INC_HL, Z80._ops.INC_H, Z80._ops.DEC_H, Z80._ops.LD_H_n, null, Z80._ops.JR_z_n, null, Z80._ops.LDI_A_HLmem, Z80._ops.DEC_HL, Z80._ops.INC_L, Z80._ops.DEC_L, Z80._ops.LD_L_n, Z80._ops.CPL, 
    // 30 - 3F
    null, Z80._ops.LD_SP_nn, Z80._ops.LDD_HLmem_A, null, null, null, Z80._ops.LD_HLmem_d8, null, null, null, Z80._ops.LDD_A_HLmem, Z80._ops.DEC_SP, Z80._ops.INC_A, Z80._ops.DEC_A, Z80._ops.LD_A_d8, null, 
    // 40 - 4F
    Z80._ops.LD_B_B, Z80._ops.LD_B_C, Z80._ops.LD_B_D, Z80._ops.LD_B_E, Z80._ops.LD_B_H, Z80._ops.LD_B_L, Z80._ops.LD_B_HLmem, Z80._ops.LD_B_A, Z80._ops.LD_C_B, Z80._ops.LD_C_C, Z80._ops.LD_C_D, Z80._ops.LD_C_E, Z80._ops.LD_C_H, Z80._ops.LD_C_L, Z80._ops.LD_C_HLmem, Z80._ops.LD_C_A, 
    // 50 - 5F
    Z80._ops.LD_D_B, Z80._ops.LD_D_C, Z80._ops.LD_D_D, Z80._ops.LD_D_E, Z80._ops.LD_D_H, Z80._ops.LD_D_L, Z80._ops.LD_D_HLmem, Z80._ops.LD_D_A, Z80._ops.LD_E_B, Z80._ops.LD_E_C, Z80._ops.LD_E_D, Z80._ops.LD_E_E, Z80._ops.LD_E_H, Z80._ops.LD_E_L, Z80._ops.LD_E_HLmem, Z80._ops.LD_E_A, 
    // 60 - 6F
    Z80._ops.LD_H_B, Z80._ops.LD_H_C, Z80._ops.LD_H_D, Z80._ops.LD_H_E, Z80._ops.LD_H_H, Z80._ops.LD_H_L, Z80._ops.LD_H_HLmem, Z80._ops.LD_H_A, Z80._ops.LD_L_B, Z80._ops.LD_L_C, Z80._ops.LD_L_D, Z80._ops.LD_L_E, Z80._ops.LD_L_H, Z80._ops.LD_L_L, Z80._ops.LD_L_HLmem, Z80._ops.LD_L_A, 
    // 70 - 7F
    Z80._ops.LD_HLmem_B, Z80._ops.LD_HLmem_C, Z80._ops.LD_HLmem_D, Z80._ops.LD_HLmem_E, Z80._ops.LD_HLmem_H, Z80._ops.LD_HLmem_L, null, Z80._ops.LD_HLmem_A, Z80._ops.LD_A_B, Z80._ops.LD_A_C, Z80._ops.LD_A_D, Z80._ops.LD_A_E, Z80._ops.LD_A_H, Z80._ops.LD_A_L, Z80._ops.LD_A_HLmem, Z80._ops.LD_A_A, 
    // 80 - 8F
    Z80._ops.ADD_A_B, Z80._ops.ADD_A_C, Z80._ops.ADD_A_D, Z80._ops.ADD_A_E, Z80._ops.ADD_h, Z80._ops.ADD_A_L, Z80._ops.ADD_A_HLmem, Z80._ops.ADD_A_A, Z80._ops.ADC_A_B, Z80._ops.ADC_A_C, Z80._ops.ADC_A_D, Z80._ops.ADC_A_E, Z80._ops.ADC_A_H, Z80._ops.ADC_A_L, Z80._ops.ADC_A_HLmem, Z80._ops.ADC_A_A, 
    // 90 - 9F
    Z80._ops.SUB_B, Z80._ops.SUB_C, Z80._ops.SUB_D, Z80._ops.SUB_E, Z80._ops.SUB_H, Z80._ops.SUB_L, Z80._ops.SUB_HLmem, Z80._ops.SUB_A, Z80._ops.SBC_A_B, Z80._ops.SBC_A_C, Z80._ops.SBC_A_D, Z80._ops.SBC_A_E, Z80._ops.SBC_A_H, Z80._ops.SBC_A_L, Z80._ops.SBC_A_HLmem, Z80._ops.SBC_A_A, 
    // A0 - AF
    Z80._ops.AND_B, Z80._ops.AND_C, Z80._ops.AND_D, Z80._ops.AND_E, Z80._ops.AND_H, Z80._ops.AND_L, Z80._ops.AND_HLmem, Z80._ops.AND_A, Z80._ops.XOR_B, Z80._ops.XOR_C, Z80._ops.XOR_D, Z80._ops.XOR_E, Z80._ops.XOR_H, Z80._ops.XOR_L, Z80._ops.XOR_HLmem, Z80._ops.XOR_A, 
    // B0 - BF
    Z80._ops.OR_B, Z80._ops.OR_C, Z80._ops.OR_D, Z80._ops.OR_E, Z80._ops.OR_H, Z80._ops.OR_L, Z80._ops.OR_HLmem, Z80._ops.OR_A, null, null, null, null, null, null, Z80._ops.CP_HLmem, null, 
    // C0 - CF
    Z80._ops.RET_NZ, Z80._ops.POP_BC, null, Z80._ops.JP_d16, Z80._ops.CALL_NZ_nn, Z80._ops.PUSH_BC, Z80._ops.ADD_A_d8, null, Z80._ops.RET_Z, Z80._ops.RET, null, Z80._ops.map_to_CB, Z80._ops.CALL_Z_nn, Z80._ops.CALL_nn, Z80._ops.ADC_A_d8, null, 
    // D0 - DF
    Z80._ops.RET_NC, Z80._ops.POP_DE, null, null, Z80._ops.CALL_NC_nn, Z80._ops.PUSH_DE, Z80._ops.SUB_d8, null, Z80._ops.RET_C, null, null, null, Z80._ops.CALL_C_nn, null, null, null, 
    // E0 - EF
    Z80._ops.LDH_d8mem_A, Z80._ops.POP_HL, Z80._ops.LD_Cmem_A, null, null, Z80._ops.PUSH_HL, Z80._ops.AND_d8, null, null, Z80._ops.JP_HLmem, Z80._ops.LD_a16mem_A, null, null, null, Z80._ops.XOR_d8, null, 
    // F0 - FF
    Z80._ops.LDH_A_d8mem, Z80._ops.POP_AF, Z80._ops.LD_A_Cmem, Z80._ops.DI, null, Z80._ops.PUSH_AF, Z80._ops.OR_d8, null, Z80._ops.LDHL_SP_n, Z80._ops.LD_SP_HL, Z80._ops.LD_A_d16mem, Z80._ops.EI, null, null, Z80._ops.CP_d8, null
];

Z80._cbMap = [
    // 00 - 0F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 10 - 1F
    null, Z80._ops.RL_C, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 20 - 2F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 30 - 3F
    Z80._ops.SWAP_B, Z80._ops.SWAP_C, Z80._ops.SWAP_D, Z80._ops.SWAP_E, Z80._ops.SWAP_H, Z80._ops.SWAP_L, Z80._ops.SWAP_HLmem, Z80._ops.SWAP_A, null, null, null, null, null, null, null, null, 
    // 40 - 4F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 50 - 5F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 60 - 6F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 70 - 7F
    null, null, null, null, null, null, null, null, null, null, null, null, Z80._ops.BIT_7_h, null, null, null, 
    // 80 - 8F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 90 - 9F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // A0 - AF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,  
    // B0 - BF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // C0 - CF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // D0 - DF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // E0 - EF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // F0 - FF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
];

let opCodes = 512-11;
for (let i = 0; i < 512; i++)
    if (!!Z80._map[i]) opCodes--;

let cbCodes = 512;
for (let i = 0; i < 512; i++)
    if (!!Z80._cbMap[i]) cbCodes--;

console.log(`Missing ${opCodes} op codes`);
console.log(`Missing ${cbCodes} cb codes`);