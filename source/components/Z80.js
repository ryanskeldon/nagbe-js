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
            traceLog.write("Z80", "A: 0x" + Z80._register.a.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "B: 0x" + Z80._register.b.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "C: 0x" + Z80._register.c.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "D: 0x" + Z80._register.d.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "E: 0x" + Z80._register.e.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "H: 0x" + Z80._register.h.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "L: 0x" + Z80._register.l.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "F: 0x" + Z80._register.f.toString(16).toUpperCase().padStart(2,"0"));
            traceLog.write("Z80", "PC: 0x" + Z80._register.pc.toString(16).toUpperCase().padStart(4,"0"));
            traceLog.write("Z80", "SP: 0x" + Z80._register.sp.toString(16).toUpperCase().padStart(4,"0"));
            traceLog.write("Z80", "BC: 0x" + ((Z80._register.b<<8)+Z80._register.c).toString(16).toUpperCase().padStart(4,"0"));
            traceLog.write("Z80", "DE: 0x" + ((Z80._register.d<<8)+Z80._register.e).toString(16).toUpperCase().padStart(4,"0"));
            traceLog.write("Z80", "HL: 0x" + ((Z80._register.h<<8)+Z80._register.l).toString(16).toUpperCase().padStart(4,"0"));
        }
    },

    pendingEnableInterrupts: 0,
    pendingDisableInterrupts: 0,

    _halted: false,
    _stopped: false,

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

    // Flag helpers
    setZ: function () { Z80._register.f |= Z80._flags.zero; },
    clearZ: function () { Z80._register.f &= ~Z80._flags.zero; },
    setN: function () { Z80._register.f |= Z80._flags.subtraction; },
    clearN: function () { Z80._register.f &= ~Z80._flags.subtraction; },
    setH: function () { Z80._register.f |= Z80._flags.halfCarry; },
    clearH: function () { Z80._register.f &= ~Z80._flags.halfCarry; },
    setC: function () { Z80._register.f |= Z80._flags.carry; },
    clearC: function () { Z80._register.f &= ~Z80._flags.carry; },

    opCode: 0,
    verbose: false,
    stopAt: null,

    frame: function () {
        let frameClock = Z80._clock.t + 70224;

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
    },

    step: function () {
        if (Z80._register.pc < 0 || Z80._register.pc > 0xFFFF) throw "Program counter out of range.";

        Z80.checkInterrupts();

        if (Z80._halted) {
            // CPU "powered down". Only wake up if there's an interrupt.
            Z80._register.t = 4;
        } else {
            Z80.opCode = MMU.readByte(Z80._register.pc++);
            
            if (!MMU._biosEnabled && Z80.verbose) traceLog.write("Z80", "$" + (Z80._register.pc-1).toString(16).toUpperCase().padStart(4,"0") + "\tOP: 0x" + Z80.opCode.toString(16).toUpperCase().padStart(2,"0"));
            
            try {            
                Z80._map[Z80.opCode]();
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
                else { Z80._ime = true; Z80.pendingEnableInterrupts = 0; }
            }
            
            if (Z80.pendingDisableInterrupts) {
                if (Z80.pendingDisableInterrupts&0xF>0) Z80.pendingDisableInterrupts--;
                else { Z80._ime = false; Z80.pendingDisableInterrupts = 0; }
            }
        }
            
        Z80._clock.t += Z80._register.t;
        Timer.update();
        GPU.step();
    },

    run: function (stopAt) {
        if (!!stopAt) Z80.stopAt = stopAt;

        if (!Z80._interval) {
            Z80._interval = setInterval(Z80.frame, 1);            
        } else {
            traceLog.write("Z80", "$0x" + (Z80._register.pc).toString(16));
            clearInterval(Z80._interval);
            Z80._interval = null;
        }
    },
    
    checkInterrupts: function () {
        // Check if interrupts are enabled.
        if (!Z80._ime) return;

        try {            
            if (MMU.readByte(0xFFFF) == 0) return; // Check if anything is allowed to interrupt.
            let interrupts = MMU.readByte(0xFF0F); // Get active interrupt flags.
            if (!interrupts) return; // Leave if nothing to handle.

            for (var i = 0; i < 5; i++) {
                // Check if the IE flag is set for the given interrupt.
                if (interrupts&1<<i && MMU.readByte(0xFFFF)&1<<i) {                
                    Z80.handleInterrupt(i);
                }
            }
        } catch (error) {
            console.log(error);
        }
    },

    handleInterrupt: function (interrupt) {
        // TODO: Implement clock timings for interrupt handling.
        Z80._ime = false; // Disable interrupt handling.  
        Z80._halted = false;      

        Z80._register.sp -= 2; // Push program counter to stack.
        MMU.writeWord(Z80._register.sp, Z80._register.pc); 

        interrupt &= ~(1<<interrupt); // Reset interrupt flag.
        MMU.writeByte(0xFF0F, interrupt);

        switch (interrupt) {
            case 0: Z80._register.pc = 0x40; break; // V-blank
            case 1: Z80._register.pc = 0x48; console.log("lcdc int");   break; // LCD
            case 2: Z80._register.pc = 0x50; console.log("timer int");  break; // Timer
            case 3:                                                     break; // Serial (not implemented)
            case 4: Z80._register.pc = 0x60; console.log("joypad int"); break; // Joypad
        }

        Z80._register.t = 12;
    },

    requestInterrupt: function (id) {     
        //console.log(`int req ${id}`);
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
        LD_B_n: function () { // 0x06 LD B, n
            Z80._register.b = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_C_n: function () { // 0x0E LD C, n
            Z80._register.c = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_D_n: function () { // 0x16 LD D, n
            Z80._register.d = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_E_n: function () { // 0x1E LD E, n
            Z80._register.e = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_H_n: function () { // 0x26 LD H, n
            Z80._register.h = MMU.readByte(Z80._register.pc++); Z80._register.t = 8; },
        LD_L_n: function () { // 0x2E LD L, n
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
            Z80._register.a = MMU.readByte((Z80._register.b<<8)+Z80._register.c); Z80._register.t = 8; },
        LD_A_DEmem: function () { // 0x1A LD A, (DE)
            Z80._register.a = MMU.readByte((Z80._register.d<<8)+Z80._register.e); Z80._register.t = 8; },
        LD_A_HLmem: function () { // 0x7E LD A, (HL)
            Z80._register.a = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },
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
            Z80._register.b = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },

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
            Z80._register.c = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },

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
            Z80._register.d = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },

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
            Z80._register.e = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },

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
            Z80._register.h = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },

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
            Z80._register.l = MMU.readByte((Z80._register.h<<8)+Z80._register.l); Z80._register.t = 8; },

        LD_HLmem_B: function () { // 0x70 LD (HL), B
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.b); Z80._register.t = 8; },
        LD_HLmem_C: function () { // 0x71 LD (HL), C
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.c); Z80._register.t = 8; },
        LD_HLmem_D: function () { // 0x72 LD (HL), D
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.d); Z80._register.t = 8; },
        LD_HLmem_E: function () { // 0x73 LD (HL), E
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.e); Z80._register.t = 8; },
        LD_HLmem_H: function () { // 0x74 LD (HL), H
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.h); Z80._register.t = 8; },
        LD_HLmem_L: function () { // 0x75 LD (HL), L
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.l); Z80._register.t = 8; },
        LD_HLmem_d8: function () { // 0x36 LD (HL), n
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, MMU.readByte(Z80._register.pc++)); Z80._register.t = 12; },            

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
            MMU.writeByte((Z80._register.b<<8)+Z80._register.c, Z80._register.a); Z80._register.t = 8; },
        LD_DEmem_A: function () { // 0x12 LD (DE), A
            MMU.writeByte((Z80._register.d<<8)+Z80._register.e, Z80._register.a); Z80._register.t = 8; },
        LD_HLmem_A: function () { // 0x77 LD (HL), A
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, Z80._register.a); Z80._register.t = 8; },
        LD_a16mem_A: function () { // 0xEA LD (nn), A
            MMU.writeByte(MMU.readWord(Z80._register.pc), Z80._register.a); Z80._register.pc+=2; Z80._register.t = 16; },

        LD_A_Cmem: function () { // 0xF2 LD A, (C)
            Z80._register.a = MMU.readByte(0xFF00 + Z80._register.c); Z80._register.t = 8; },
        LD_Cmem_A: function () { // 0xE2 LD A, (C)
            MMU.writeByte(0xFF00 + Z80._register.c, Z80._register.a); Z80._register.t = 8; },

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
            MMU.writeByte(0xFF00+MMU.readByte(Z80._register.pc++), Z80._register.a); Z80._register.t = 12; },
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

        SUB_A: function () { // 0x97
            ALU.SUB_n(Z80._register.a, 4); },
        SUB_B: function () { // 0x90
            ALU.SUB_n(Z80._register.b, 4); },
        SUB_C: function () { // 0x91
            ALU.SUB_n(Z80._register.c, 4); },
        SUB_D: function () { // 0x92
            ALU.SUB_n(Z80._register.d, 4); },
        SUB_E: function () { // 0x93
            ALU.SUB_n(Z80._register.e, 4); },
        SUB_H: function () { // 0x94
            ALU.SUB_n(Z80._register.h, 4); },
        SUB_L: function () { // 0x95
            ALU.SUB_n(Z80._register.l, 4); },
        SUB_HLmem: function () { // 0x96
            ALU.SUB_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l), 8); },
        SUB_d8: function () { // 0xD6
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
        SBC_A_d8: function () { // 0xDE
            ALU.SBC_A_n(MMU.readByte(Z80._register.pc++), 8); },

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
        XOR_E: function () { // 0xAB            
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
            Z80._register.pc = (Z80._register.h<<8)+Z80._register.l; Z80._register.t = 4; },

        RET: function () { // 0xC9 RET            
            Z80._register.pc = MMU.readWord(Z80._register.sp); Z80._register.sp+=2; Z80._register.t = 8; },

        RET_NZ: function () { // 0xC0
            Z80._ops.RET_cc(!(Z80._register.f&Z80._flags.zero), 20, 8); },
        RET_Z: function () { // 0xC8
            Z80._ops.RET_cc(Z80._register.f&Z80._flags.zero, 20, 8); },
        RET_NC: function () { // 0xD0
            Z80._ops.RET_cc(!(Z80._register.f&Z80._flags.carry), 20, 8); },
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
            Z80.setN(); Z80.setH();
            Z80._register.a ^= 255;
            Z80._register.t = 4;
        },

        RST_n: function (address) {            
            Z80._register.sp-=2; MMU.writeWord(Z80._register.sp, Z80._register.pc); Z80._register.pc = address; Z80._register.t = 32; },
        RST_00: function () { // 0xC7
            Z80._ops.RST_n(0x00); },
        RST_08: function () { // 0xCF
            Z80._ops.RST_n(0x08); },
        RST_10: function () { // 0xD7
            Z80._ops.RST_n(0x10); },
        RST_18: function () { // 0xDF
            Z80._ops.RST_n(0x18); },
        RST_20: function () { // 0xE7
            Z80._ops.RST_n(0x20); },
        RST_28: function () { // 0xEF
            Z80._ops.RST_n(0x28); },
        RST_30: function () { // 0xF7
            Z80._ops.RST_n(0x30); },
        RST_38: function () { // 0xFF
            Z80._ops.RST_n(0x38); },

        ADD_HL_BC: function () { // 0x09
            ALU.ADD_HL_n((Z80._register.b<<8)+Z80._register.c); },
        ADD_HL_DE: function () { // 0x19
            ALU.ADD_HL_n((Z80._register.d<<8)+Z80._register.e); },
        ADD_HL_HL: function () { // 0x29
            ALU.ADD_HL_n((Z80._register.h<<8)+Z80._register.l); },
        ADD_HL_SP: function () { // 0x39
            ALU.ADD_HL_n(Z80._register.sp); },

        ADD_SP_n: function () { // 0xE8
            let n = MMU.readByte(Z80._register.pc++);
            if (n>127) n = -((~n+1)&255);
            let result = Z80._register.sp + n;
            Z80.clearZ(); Z80.clearN();            
            if (((Z80._register.sp ^ n ^ result)&0x100)==0x100) Z80.setC();
            else Z80.clearC();
            if (((Z80._register.sp ^ n ^ result)&0x10)==0x10) Z80.setH();
            else Z80.clearH();
            Z80._register.sp = result&0xFFFF;
            Z80._register.t = 12;
        },

        JR_n: function () { // 0x18 JR n
            let move = MMU.readByte(Z80._register.pc++); if (move > 127) move = -((~move+1)&255); Z80._register.pc += move; Z80._register.t = 12; },
        JR_NZ_n: function () { // 0x20
            ALU.JR_cc_n(!(Z80._register.f&Z80._flags.zero), 12, 8); },
        JR_Z_N: function () { // 0x28
            ALU.JR_cc_n(Z80._register.f&Z80._flags.zero, 12, 8); },            
        JR_NC_n: function () { // 0x30
            ALU.JR_cc_n(!(Z80._register.f&Z80._flags.carry), 12, 8); },
        JR_C_n: function () { // 0x38
            ALU.JR_cc_n(Z80._register.f&Z80._flags.carry, 12, 8); },    

        // Jumps
        JP_d16: function () { // 0xC3 JP nn
            Z80._register.pc = MMU.readWord(Z80._register.pc); Z80._register.t = 12; },
        JP_NZ_nn: function () { // 0xC2            
            Z80._ops.JP_cc_nn((Z80._register.f&Z80._flags.zero) == 0, 16, 12); },
        JP_Z_nn: function () { // 0xCA
            Z80._ops.JP_cc_nn((Z80._register.f&Z80._flags.zero) == 1, 16, 12); },
        JP_NC_nn: function () { // 0xD2
            Z80._ops.JP_cc_nn((Z80._register.f&Z80._flags.carry) == 0, 16, 12); },
        JP_C_nn: function () { // 0xDA
            Z80._ops.JP_cc_nn((Z80._register.f&Z80._flags.carry) == 1, 16, 12); },

        JP_cc_nn: function (condition, trueTime, falseTime) {
            if (condition) {
                Z80._register.pc = MMU.readWord(Z80._register.pc);                
                Z80._register.t = trueTime;
            } else {
                Z80._register.pc+=2;
                Z80._register.t = falseTime;
            }
        },

        // Calls
        CALL_nn: function() { // 0xCD CALL nn            
            Z80._register.sp-=2; MMU.writeWord(Z80._register.sp, Z80._register.pc+2); Z80._register.pc = MMU.readWord(Z80._register.pc); Z80._register.t = 12; },

        // CP n
        CP_A: function () { // 0xBF
            Z80._ops.CP_n(Z80._register.a, 4); },
        CP_B: function () { // 0xB8
            Z80._ops.CP_n(Z80._register.b, 4); },
        CP_C: function () { // 0xB9
            Z80._ops.CP_n(Z80._register.c, 4); },
        CP_D: function () { // 0xBA
            Z80._ops.CP_n(Z80._register.d, 4); },
        CP_E: function () { // 0xBB
            Z80._ops.CP_n(Z80._register.e, 4); },
        CP_H: function () { // 0xBC
            Z80._ops.CP_n(Z80._register.h, 4); },
        CP_L: function () { // 0xBD
            Z80._ops.CP_n(Z80._register.l, 4); },
        CP_HLmem: function () { // 0xBE CP (HL)
            Z80._ops.CP_n(MMU.readByte((Z80._register.h<<8)+Z80._register.l), 8); },
        CP_d8: function () { // 0xFE CP #                        
            Z80._ops.CP_n(MMU.readByte(Z80._register.pc++), 8); },
        CP_n: function (input, cycles) {
            let result = Z80._register.a - input;
            if ((result&255) === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if (Z80._register.a < input) Z80.setC(); else Z80.clearC();
            if ((Z80._register.a&0xf) < (input&0xf)) Z80.setH(); else Z80.clearH();
            Z80._register.t = cycles;
        },
        
        // INC n
        INC_A: function () { // 0x3C
            let result = (Z80._register.a+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.a&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.a = result;
            Z80._register.t = 4;
        },
        INC_B: function () { // 0x04            
            let result = (Z80._register.b+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.b&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.b = result;
            Z80._register.t = 4;
        },
        INC_C: function () { // 0x0C            
            let result = (Z80._register.c+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.c&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.c = result;
            Z80._register.t = 4;
        },
        INC_D: function () { // 0x14            
            let result = (Z80._register.d+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.d&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.d = result;
            Z80._register.t = 4;
        },
        INC_E: function () { // 0x1C            
            let result = (Z80._register.e+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.e&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.e = result;
            Z80._register.t = 4;
        },
        INC_H: function () { // 0x24
            let result = (Z80._register.h+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.h&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.h = result;
            Z80._register.t = 4;
        },
        INC_L: function () { // 0x2C            
            let result = (Z80._register.l+1)&255;            
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((Z80._register.l&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            Z80._register.l = result;
            Z80._register.t = 4;
        },
        INC_HLmem: function () { // 0x34
            let value = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let result = (value+1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.clearN();
            if ((value&0xf)+1 > 0xf) Z80.setH(); else Z80.clearH();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, result);
            Z80._register.t = 12;
        },        

        INC_BC: function () { // 0x03 INC BC
            Z80._register.c = (Z80._register.c+1)&255; if (Z80._register.c == 0) Z80._register.b = (Z80._register.b + 1) & 255; Z80._register.t = 8; },
        INC_DE: function () { // 0x13 INC DE
            Z80._register.e = (Z80._register.e+1)&255; if (Z80._register.e == 0) Z80._register.d = (Z80._register.d + 1) & 255; Z80._register.t = 8; },
        INC_HL: function () { // 0x23 INC HL
            Z80._register.l = (Z80._register.l+1)&255; if (Z80._register.l == 0) Z80._register.h = (Z80._register.h + 1) & 255; Z80._register.t = 8; },
        INC_SP: function () { // 0x33 INC SP
            Z80._register.sp++; Z80._register.t = 8; },

        // DEC n
        DEC_A: function () { // 0x3D DEC A
            let result = (Z80._register.a-1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.a&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.a = result;
            Z80._register.t = 4;
        },
        DEC_B: function () { // 0x05 DEC B
            let result = (Z80._register.b-1)&255;
            if (result == 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.b&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.b = result;
            Z80._register.t = 4;
        },
        DEC_C: function () { // 0x0D DEC C
            let result = (Z80._register.c-1)&255;
            if (result == 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.c&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.c = result;
            Z80._register.t = 4;
        },
        DEC_D: function () { // 0x15 DEC D
            let result = (Z80._register.d-1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.d&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.d = result;
            Z80._register.t = 4;
        },
        DEC_E: function () { // 0x1D DEC e
            let result = (Z80._register.e-1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.e&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.e = result;
            Z80._register.t = 4;
        },
        DEC_H: function () { // 0x25 DEC H
            let result = (Z80._register.h-1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.h&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.h = result;
            Z80._register.t = 4;
        },
        DEC_L: function () { // 0x2D DEC L
            let result = (Z80._register.l-1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((Z80._register.l&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            Z80._register.l = result;
            Z80._register.t = 4;
        },
        DEC_HL: function () { // 0x35
            let value = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let result = (value-1)&255;
            if (result === 0) Z80.setZ(); else Z80.clearZ();
            Z80.setN();
            if ((value&0xf)-1 < 0) Z80.setH(); else Z80.clearH();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, result);
            Z80._register.t = 12;
        },

        // Rotations 
        RLCA: function () { // 0x07
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.a&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();            
            Z80._register.a = ((Z80._register.a<<1)+carryOut)&255;
            Z80._register.t = 4;
        },
        RLA: function () { // 0x17
            let a = Z80._register.a;
            let carryOut = Z80._register.a&0x80?1:0;
            let carryIn = Z80._register.f & Z80._flags.carry ? 1 : 0; 
            Z80._register.a = ((a<<1)+carryIn)&255;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80.clearZ(); Z80.clearN(); Z80.clearH();
            Z80._register.t = 4;
        },
        RRCA: function () { // 0x0F
            Z80.clearN(); Z80.clearH(); // NOTE: Should this clear Z?
            let carryOut = Z80._register.a&0x01?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.a = ((Z80._register.a>>1)+(carryOut<<7))&255;
            Z80._register.t = 4;
        },
        RRA: function () { // 0x1F
            let carryIn = Z80._register.f & Z80._flags.carry ? 1 : 0;
            let carryOut = Z80._register.a & 0x01 ? 1 : 0;
            Z80._register.a = ((Z80._register.a>>1)+(carryIn<<7))&255;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80.clearZ(); Z80.clearN(); Z80.clearH();
            Z80._register.t = 4;
        },

        CCF: function () { // 0x3F
            Z80.clearN(); Z80.clearH(); if (Z80._register.f&Z80._flags.carry) Z80.clearC(); else Z80.setC(); Z80._register.t = 4; },
        SCF: function () { // 0x37
            Z80.setC(); Z80._register.t = 4; },

        NOP: function () { // 0x00
            Z80._register.t = 4; },
        DI: function () { // 0xF3            
            Z80.pendingDisableInterrupts = 0x11; Z80._register.t = 4; },
        EI: function () { // 0xFB
            Z80.pendingEnableInterrupts = 0x11; Z80._register.t = 4; },

        HALT: function () { // 0x76
            Z80._halted = true; Z80._register.t = 4; },
        STOP: function () { // 0x10
            Z80._stopped = true; Z80._register.pc++; Z80._register.t = 4; },

        RETI: function () { // 0xD9
            let address = MMU.readWord(Z80._register.sp);
            Z80._register.sp+=2;
            Z80._register.pc = address;
            Z80._ime = true;
            Z80._register.t = 8;
        },

        DAA: function () { // 0x27
            Z80.clearH();
            if (Z80._register.f&Z80._flags.halfCarry || (Z80._register.a&0x0f)>9) 
                Z80._register.a += 0x06;
            if (Z80._register.f&Z80._flags.carry || (Z80._register.a&0xf0)>9) 
                Z80._register.a += 0x60;
            if (Z80._register.a > 0x99) Z80.setC();
            if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 4;
        },

        // CB Instructions
        CB: function () { // 0xCB            
            let cbAddress = MMU.readByte(Z80._register.pc++);
            try {
                Z80._cbMap[cbAddress]();
            } catch (error) {
                console.log("CB OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + cbAddress.toString(16));
                throw error;
            }
        },

        // RLC n
        RLC_A: function () { // CB 0x07
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.a&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.a = ((Z80._register.a<<1)+carryOut)&255;
            if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_B: function () { // CB 0x00
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.b&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.b = ((Z80._register.b<<1)+carryOut)&255;
            if (!Z80._register.b) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_C: function () { // CB 0x01
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.c&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.c = ((Z80._register.c<<1)+carryOut)&255;
            if (!Z80._register.c) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_D: function () { // CB 0x02
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.d&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.d = ((Z80._register.d<<1)+carryOut)&255;
            if (!Z80._register.d) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_E: function () { // CB 0x03
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.e&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.e = ((Z80._register.e<<1)+carryOut)&255;
            if (!Z80._register.e) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_H: function () { // CB 0x04
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.h&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.h = ((Z80._register.h<<1)+carryOut)&255;
            if (!Z80._register.h) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_L: function () { // CB 0x05
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.l&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.l = ((Z80._register.l<<1)+carryOut)&255;
            if (!Z80._register.l) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RLC_HLmem: function () { // CB 0x06
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let carryOut = hl&0x80?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            hl = ((hl<<1)+carryOut)&255;
            if (!hl) Z80.setZ(); else Z80.clearZ();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, hl);
            Z80._register.t = 16;
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

        // RL n
        RL_A: function () { // CB 0x17
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.a&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.a = ((Z80._register.a<<1)+carryIn)&255;
            if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_B: function () { // CB 0x10
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.b&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.b = ((Z80._register.b<<1)+carryIn)&255;
            if (!Z80._register.b) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_C: function () { // CB 0x11            
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.c&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.c = ((Z80._register.c<<1)+carryIn)&255;
            if (!Z80._register.c) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_D: function () { // CB 0x12
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.d&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.d = ((Z80._register.d<<1)+carryIn)&255;
            if (!Z80._register.d) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_E: function () { // CB 0x13
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.e&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.e = ((Z80._register.e<<1)+carryIn)&255;
            if (!Z80._register.e) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_H: function () { // CB 0x14
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.h&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.h = ((Z80._register.h<<1)+carryIn)&255;
            if (!Z80._register.h) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_L: function () { // CB 0x15
            Z80.clearN(); Z80.clearH();
            let carryOut = Z80._register.l&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            Z80._register.l = ((Z80._register.l<<1)+carryIn)&255;
            if (!Z80._register.l) Z80.setZ(); else Z80.clearZ();
            Z80._register.t = 8;
        },
        RL_HLmem: function () { // CB 0x16
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            let carryOut = hl&0x80?1:0;
            let carryIn = Z80._register.f&Z80._flags.carry?1:0;
            if (carryOut) Z80.setC(); else Z80.clearC();
            hl = ((hl<<1)+carryIn)&255;
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

        // SLA n
        SLA_A: function () { // CB 0x27            
            Z80.clearN(); Z80.clearH();
            if (Z80._register.a&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.a = (Z80._register.a<<1)&255;
            if (Z80._register.a) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_B: function () { // CB 0x20
            Z80.clearN(); Z80.clearH();
            if (Z80._register.b&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.b = (Z80._register.b<<1)&255;
            if (Z80._register.b) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_C: function () { // CB 0x21
            Z80.clearN(); Z80.clearH();
            if (Z80._register.c&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.c = (Z80._register.c<<1)&255;
            if (Z80._register.c) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_D: function () { // CB 0x22
            Z80.clearN(); Z80.clearH();
            if (Z80._register.d&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.d = (Z80._register.d<<1)&255;
            if (Z80._register.d) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_E: function () { // CB 0x23
            Z80.clearN(); Z80.clearH();
            if (Z80._register.e&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.e = (Z80._register.e<<1)&255;
            if (Z80._register.e) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_H: function () { // CB 0x24
            Z80.clearN(); Z80.clearH();
            if (Z80._register.h&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.h = (Z80._register.h<<1)&255;
            if (Z80._register.h) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_L: function () { // CB 0x25
            Z80.clearN(); Z80.clearH();
            if (Z80._register.l&0x80) Z80.setC(); else Z80.clearC();
            Z80._register.l = (Z80._register.l<<1)&255;
            if (Z80._register.l) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SLA_HLmem: function () { // CB 0x26
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            if (hl&0x80) Z80.setC(); else Z80.clearC();
            hl = (hl<<1)&255;
            if (hl) Z80.clearZ(); else Z80.setZ();
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

        // SRL n
        SRL_A: function () { // CB 0x3F            
            Z80.clearN(); Z80.clearH();
            if (Z80._register.a&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.a = (Z80._register.a>>1)&255;
            if (Z80._register.a) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_B: function () { // CB 0x38
            Z80.clearN(); Z80.clearH();
            if (Z80._register.b&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.b = (Z80._register.b>>1)&255;
            if (Z80._register.b) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_C: function () { // CB 0x39
            Z80.clearN(); Z80.clearH();
            if (Z80._register.c&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.c = (Z80._register.c>>1)&255;
            if (Z80._register.c) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_D: function () { // CB 0x3A
            Z80.clearN(); Z80.clearH();
            if (Z80._register.d&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.d = (Z80._register.d>>1)&255;
            if (Z80._register.d) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_E: function () { // CB 0x3B
            Z80.clearN(); Z80.clearH();
            if (Z80._register.e&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.e = (Z80._register.e>>1)&255;
            if (Z80._register.e) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_H: function () { // CB 0x3C
            Z80.clearN(); Z80.clearH();
            if (Z80._register.h&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.h = (Z80._register.h>>1)&255;
            if (Z80._register.h) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_L: function () { // CB 0x3D
            Z80.clearN(); Z80.clearH();
            if (Z80._register.l&0x01) Z80.setC(); else Z80.clearC();
            Z80._register.l = (Z80._register.l>>1)&255;
            if (Z80._register.l) Z80.clearZ(); else Z80.setZ();
            Z80._register.t = 8;
        },
        SRL_HLmem: function () { // CB 0x3E
            Z80.clearN(); Z80.clearH();
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l);
            if (hl&0x01) Z80.setC(); else Z80.clearC();
            hl = (hl>>1)&255;
            if (hl) Z80.clearZ(); else Z80.setZ();
            MMU.writeByte((Z80._register.h<<8)+Z80._register.l, hl);
            Z80._register.t = 16;
        }, 

        // SWAP n
        SWAP_n: function (input) {
            let upper = input>>4;
            let lower = input&0xF; 
            let value = (lower<<4)+upper; 
            if (value) Z80.clearZ(); else Z80.setZ(); 
            Z80.clearN(); Z80.clearH();; Z80.clearC();
            return value; 
        },
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

        // Bits
        BIT_b_r: function (value, bit, cycles) {
            if (value&(1<<bit)) Z80.clearZ(); else Z80.setZ(); Z80.clearN(); Z80.setH();Z80._register.t = cycles; },
        BIT_b0_A: function () { // CB 0x47
            Z80._ops.BIT_b_r(Z80._register.a, 0, 8); },
        BIT_b0_B: function () { // CB 0x40
            Z80._ops.BIT_b_r(Z80._register.b, 0, 8); },
        BIT_b0_C: function () { // CB 0x41
            Z80._ops.BIT_b_r(Z80._register.c, 0, 8); },
        BIT_b0_D: function () { // CB 0x42
            Z80._ops.BIT_b_r(Z80._register.d, 0, 8); },
        BIT_b0_E: function () { // CB 0x43
            Z80._ops.BIT_b_r(Z80._register.e, 0, 8); },
        BIT_b0_H: function () { // CB 0x44
            Z80._ops.BIT_b_r(Z80._register.h, 0, 8); },
        BIT_b0_L: function () { // CB 0x45
            Z80._ops.BIT_b_r(Z80._register.l, 0, 8); },
        BIT_b0_HLmem: function () { // CB 0x46
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 0, 16); },
        BIT_b1_A: function () { // CB 0x4F
            Z80._ops.BIT_b_r(Z80._register.a, 1, 8); },
        BIT_b1_B: function () { // CB 0x48
            Z80._ops.BIT_b_r(Z80._register.b, 1, 8); },
        BIT_b1_C: function () { // CB 0x49
            Z80._ops.BIT_b_r(Z80._register.c, 1, 8); },
        BIT_b1_D: function () { // CB 0x4A
            Z80._ops.BIT_b_r(Z80._register.d, 1, 8); },
        BIT_b1_E: function () { // CB 0x4B
            Z80._ops.BIT_b_r(Z80._register.e, 1, 8); },
        BIT_b1_H: function () { // CB 0x4C
            Z80._ops.BIT_b_r(Z80._register.h, 1, 8); },
        BIT_b1_L: function () { // CB 0x4D
            Z80._ops.BIT_b_r(Z80._register.l, 1, 8); },
        BIT_b1_HLmem: function () { // CB 0x4E
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 1, 16); },
        BIT_b2_A: function () { // CB 0x57
            Z80._ops.BIT_b_r(Z80._register.a, 2, 8); },
        BIT_b2_B: function () { // CB 0x50
            Z80._ops.BIT_b_r(Z80._register.b, 2, 8); },
        BIT_b2_C: function () { // CB 0x51
            Z80._ops.BIT_b_r(Z80._register.c, 2, 8); },
        BIT_b2_D: function () { // CB 0x52
            Z80._ops.BIT_b_r(Z80._register.d, 2, 8); },
        BIT_b2_E: function () { // CB 0x53
            Z80._ops.BIT_b_r(Z80._register.e, 2, 8); },
        BIT_b2_H: function () { // CB 0x54
            Z80._ops.BIT_b_r(Z80._register.h, 2, 8); },
        BIT_b2_L: function () { // CB 0x55
            Z80._ops.BIT_b_r(Z80._register.l, 2, 8); },
        BIT_b2_HLmem: function () { // CB 0x56
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 2, 16); },
        BIT_b3_A: function () { // CB 0x5F
            Z80._ops.BIT_b_r(Z80._register.a, 3, 8); },
        BIT_b3_B: function () { // CB 0x58
            Z80._ops.BIT_b_r(Z80._register.b, 3, 8); },
        BIT_b3_C: function () { // CB 0x59
            Z80._ops.BIT_b_r(Z80._register.c, 3, 8); },
        BIT_b3_D: function () { // CB 0x5A
            Z80._ops.BIT_b_r(Z80._register.d, 3, 8); },
        BIT_b3_E: function () { // CB 0x5B
            Z80._ops.BIT_b_r(Z80._register.e, 3, 8); },
        BIT_b3_H: function () { // CB 0x5C
            Z80._ops.BIT_b_r(Z80._register.h, 3, 8); },
        BIT_b3_L: function () { // CB 0x5D
            Z80._ops.BIT_b_r(Z80._register.l, 3, 8); },
        BIT_b3_HLmem: function () { // CB 0x5E
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 3, 16); },
        BIT_b4_A: function () { // CB 0x67
            Z80._ops.BIT_b_r(Z80._register.a, 4, 8); },
        BIT_b4_B: function () { // CB 0x60
            Z80._ops.BIT_b_r(Z80._register.b, 4, 8); },
        BIT_b4_C: function () { // CB 0x61
            Z80._ops.BIT_b_r(Z80._register.c, 4, 8); },
        BIT_b4_D: function () { // CB 0x62
            Z80._ops.BIT_b_r(Z80._register.d, 4, 8); },
        BIT_b4_E: function () { // CB 0x63
            Z80._ops.BIT_b_r(Z80._register.e, 4, 8); },
        BIT_b4_H: function () { // CB 0x64
            Z80._ops.BIT_b_r(Z80._register.h, 4, 8); },
        BIT_b4_L: function () { // CB 0x65
            Z80._ops.BIT_b_r(Z80._register.l, 4, 8); },
        BIT_b4_HLmem: function () { // CB 0x66
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 4, 16); },
        BIT_b5_A: function () { // CB 0x6F
            Z80._ops.BIT_b_r(Z80._register.a, 5, 8); },
        BIT_b5_B: function () { // CB 0x68
            Z80._ops.BIT_b_r(Z80._register.b, 5, 8); },
        BIT_b5_C: function () { // CB 0x69
            Z80._ops.BIT_b_r(Z80._register.c, 5, 8); },
        BIT_b5_D: function () { // CB 0x6A
            Z80._ops.BIT_b_r(Z80._register.d, 5, 8); },
        BIT_b5_E: function () { // CB 0x6B
            Z80._ops.BIT_b_r(Z80._register.e, 5, 8); },
        BIT_b5_H: function () { // CB 0x6C
            Z80._ops.BIT_b_r(Z80._register.h, 5, 8); },
        BIT_b5_L: function () { // CB 0x6D
            Z80._ops.BIT_b_r(Z80._register.l, 5, 8); },
        BIT_b5_HLmem: function () { // CB 0x6E
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 5, 16); },
        BIT_b6_A: function () { // CB 0x77
            Z80._ops.BIT_b_r(Z80._register.a, 6, 8); },
        BIT_b6_B: function () { // CB 0x70
            Z80._ops.BIT_b_r(Z80._register.b, 6, 8); },
        BIT_b6_C: function () { // CB 0x71
            Z80._ops.BIT_b_r(Z80._register.c, 6, 8); },
        BIT_b6_D: function () { // CB 0x72
            Z80._ops.BIT_b_r(Z80._register.d, 6, 8); },
        BIT_b6_E: function () { // CB 0x73
            Z80._ops.BIT_b_r(Z80._register.e, 6, 8); },
        BIT_b6_H: function () { // CB 0x74
            Z80._ops.BIT_b_r(Z80._register.h, 6, 8); },
        BIT_b6_L: function () { // CB 0x75
            Z80._ops.BIT_b_r(Z80._register.l, 6, 8); },
        BIT_b6_HLmem: function () { // CB 0x76
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 6, 16); },
        BIT_b7_A: function () { // CB 0x7F
            Z80._ops.BIT_b_r(Z80._register.a, 7, 8); },
        BIT_b7_B: function () { // CB 0x78
            Z80._ops.BIT_b_r(Z80._register.b, 7, 8); },
        BIT_b7_C: function () { // CB 0x79
            Z80._ops.BIT_b_r(Z80._register.c, 7, 8); },
        BIT_b7_D: function () { // CB 0x7A
            Z80._ops.BIT_b_r(Z80._register.d, 7, 8); },
        BIT_b7_E: function () { // CB 0x7B
            Z80._ops.BIT_b_r(Z80._register.e, 7, 8); },
        BIT_b7_H: function () { // CB 0x7C
            Z80._ops.BIT_b_r(Z80._register.h, 7, 8); },
        BIT_b7_L: function () { // CB 0x7D
            Z80._ops.BIT_b_r(Z80._register.l, 7, 8); },
        BIT_b7_HLmem: function () { // CB 0x7E
            let hl = (Z80._register.h<<8)+Z80._register.l; Z80._ops.BIT_b_r(MMU.readByte(hl), 7, 16); },

        // RES b, r
        RES_b0_A: function () { // CB 0x87            
            Z80._register.a &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_B: function () { // CB 0x80
            Z80._register.b &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_C: function () { // CB 0x81
            Z80._register.c &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_D: function () { // CB 0x82
            Z80._register.d &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_E: function () { // CB 0x83
            Z80._register.e &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_H: function () { // CB 0x84
            Z80._register.h &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_L: function () { // CB 0x85
            Z80._register.l &= (0xFF)-(1<<0); Z80._register.t = 8; },
        RES_b0_HLmem: function () { // CB 0x86
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<0)); Z80._register.t = 16; },

        RES_b1_A: function () { // CB 0x8F
            Z80._register.a &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_B: function () { // CB 0x88
            Z80._register.b &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_C: function () { // CB 0x89
            Z80._register.c &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_D: function () { // CB 0x8A
            Z80._register.d &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_E: function () { // CB 0x8B
            Z80._register.e &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_H: function () { // CB 0x8C
            Z80._register.h &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_L: function () { // CB 0x8D
            Z80._register.l &= (0xFF)-(1<<1); Z80._register.t = 8; },
        RES_b1_HLmem: function () { // CB 0x8E
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<1)); Z80._register.t = 16; },

        RES_b2_A: function () { // CB 0x97
            Z80._register.a &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_B: function () { // CB 0x90
            Z80._register.b &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_C: function () { // CB 0x91
            Z80._register.c &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_D: function () { // CB 0x92
            Z80._register.d &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_E: function () { // CB 0x93
            Z80._register.e &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_H: function () { // CB 0x94
            Z80._register.h &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_L: function () { // CB 0x95
            Z80._register.l &= (0xFF)-(1<<2); Z80._register.t = 8; },
        RES_b2_HLmem: function () { // CB 0x96
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<2)); Z80._register.t = 16; },

        RES_b3_A: function () { // CB 0x9F
            Z80._register.a &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_B: function () { // CB 0x98
            Z80._register.b &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_C: function () { // CB 0x99
            Z80._register.c &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_D: function () { // CB 0x9A
            Z80._register.d &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_E: function () { // CB 0x9B
            Z80._register.e &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_H: function () { // CB 0x9C
            Z80._register.h &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_L: function () { // CB 0x9D
            Z80._register.l &= (0xFF)-(1<<3); Z80._register.t = 8; },
        RES_b3_HLmem: function () { // CB 0x9E
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<3)); Z80._register.t = 16; },

        RES_b4_A: function () { // CB 0xA7
            Z80._register.a &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_B: function () { // CB 0xA0
            Z80._register.b &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_C: function () { // CB 0xA1
            Z80._register.c &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_D: function () { // CB 0xA2
            Z80._register.d &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_E: function () { // CB 0xA3
            Z80._register.e &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_H: function () { // CB 0xA4
            Z80._register.h &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_L: function () { // CB 0xA5
            Z80._register.l &= (0xFF)-(1<<4); Z80._register.t = 8; },
        RES_b4_HLmem: function () { // CB 0xA6
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<4)); Z80._register.t = 16; },

        RES_b5_A: function () { // CB 0xAF
            Z80._register.a &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_B: function () { // CB 0xA8
            Z80._register.b &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_C: function () { // CB 0xA9
            Z80._register.c &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_D: function () { // CB 0xAA
            Z80._register.d &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_E: function () { // CB 0xAB
            Z80._register.e &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_H: function () { // CB 0xAC
            Z80._register.h &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_L: function () { // CB 0xAD
            Z80._register.l &= (0xFF)-(1<<5); Z80._register.t = 8; },
        RES_b5_HLmem: function () { // CB 0xAE
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<5)); Z80._register.t = 16; },

        RES_b6_A: function () { // CB 0xB7
            Z80._register.a &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_B: function () { // CB 0xB0
            Z80._register.b &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_C: function () { // CB 0xB1
            Z80._register.c &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_D: function () { // CB 0xB2
            Z80._register.d &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_E: function () { // CB 0xB3
            Z80._register.e &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_H: function () { // CB 0xB4
            Z80._register.h &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_L: function () { // CB 0xB5
            Z80._register.l &= (0xFF)-(1<<6); Z80._register.t = 8; },
        RES_b6_HLmem: function () { // CB 0xB6
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<6)); Z80._register.t = 16; },

        RES_b7_A: function () { // CB 0xBF
            Z80._register.a &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_B: function () { // CB 0xB8
            Z80._register.b &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_C: function () { // CB 0xB9
            Z80._register.c &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_D: function () { // CB 0xBA
            Z80._register.d &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_E: function () { // CB 0xBB
            Z80._register.e &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_H: function () { // CB 0xBC
            Z80._register.h &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_L: function () { // CB 0xBD
            Z80._register.l &= (0xFF)-(1<<7); Z80._register.t = 8; },
        RES_b7_HLmem: function () { // CB 0xBE
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)&(0xFF)-(1<<7)); Z80._register.t = 16; },    

        // SET b, r
        SET_b0_A: function () { // CB 0xC7            
            Z80._register.a |= (1<<0); Z80._register.t = 8; },
        SET_b0_B: function () { // CB 0xC0            
            Z80._register.b |= (1<<0); Z80._register.t = 8; },
        SET_b0_C: function () { // CB 0xC1            
            Z80._register.c |= (1<<0); Z80._register.t = 8; },
        SET_b0_D: function () { // CB 0xC2            
            Z80._register.d |= (1<<0); Z80._register.t = 8; },
        SET_b0_E: function () { // CB 0xC3            
            Z80._register.e |= (1<<0); Z80._register.t = 8; },
        SET_b0_H: function () { // CB 0xC4                        
            Z80._register.h |= (1<<0); Z80._register.t = 8; },        
        SET_b0_L: function () { // CB 0xC5                        
            Z80._register.l |= (1<<0); Z80._register.t = 8; },    
        SET_b0_HLmem: function () { // CB 0xC6
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<0)); Z80._register.t = 16; },
        SET_b1_A: function () { // CB 0xCF            
            Z80._register.a |= (1<<1); Z80._register.t = 8; },
        SET_b1_B: function () { // CB 0xC8            
            Z80._register.b |= (1<<1); Z80._register.t = 8; },
        SET_b1_C: function () { // CB 0xC9            
            Z80._register.c |= (1<<1); Z80._register.t = 8; },
        SET_b1_D: function () { // CB 0xCA            
            Z80._register.d |= (1<<1); Z80._register.t = 8; },
        SET_b1_E: function () { // CB 0xCB            
            Z80._register.e |= (1<<1); Z80._register.t = 8; },
        SET_b1_H: function () { // CB 0xCC                        
            Z80._register.h |= (1<<1); Z80._register.t = 8; },        
        SET_b1_L: function () { // CB 0xCD                        
            Z80._register.l |= (1<<1); Z80._register.t = 8; },    
        SET_b1_HLmem: function () { // CB 0xCE
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<1)); Z80._register.t = 16; },
        SET_b2_A: function () { // CB 0xD7            
            Z80._register.a |= (1<<2); Z80._register.t = 8; },
        SET_b2_B: function () { // CB 0xD0            
            Z80._register.b |= (1<<2); Z80._register.t = 8; },
        SET_b2_C: function () { // CB 0xD1            
            Z80._register.c |= (1<<2); Z80._register.t = 8; },
        SET_b2_D: function () { // CB 0xD2            
            Z80._register.d |= (1<<2); Z80._register.t = 8; },
        SET_b2_E: function () { // CB 0xD3            
            Z80._register.e |= (1<<2); Z80._register.t = 8; },
        SET_b2_H: function () { // CB 0xD4                        
            Z80._register.h |= (1<<2); Z80._register.t = 8; },        
        SET_b2_L: function () { // CB 0xD5                        
            Z80._register.l |= (1<<2); Z80._register.t = 8; },    
        SET_b2_HLmem: function () { // CB 0xD6
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<2)); Z80._register.t = 16; },
        SET_b3_A: function () { // CB 0xDF            
            Z80._register.a |= (1<<3); Z80._register.t = 8; },
        SET_b3_B: function () { // CB 0xD8            
            Z80._register.b |= (1<<3); Z80._register.t = 8; },
        SET_b3_C: function () { // CB 0xD9            
            Z80._register.c |= (1<<3); Z80._register.t = 8; },
        SET_b3_D: function () { // CB 0xDA            
            Z80._register.d |= (1<<3); Z80._register.t = 8; },
        SET_b3_E: function () { // CB 0xDB            
            Z80._register.e |= (1<<3); Z80._register.t = 8; },
        SET_b3_H: function () { // CB 0xDC                        
            Z80._register.h |= (1<<3); Z80._register.t = 8; },        
        SET_b3_L: function () { // CB 0xDD                        
            Z80._register.l |= (1<<3); Z80._register.t = 8; },    
        SET_b3_HLmem: function () { // CB 0xDE
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<3)); Z80._register.t = 16; },
        SET_b4_A: function () { // CB 0xE7            
            Z80._register.a |= (1<<4); Z80._register.t = 8; },
        SET_b4_B: function () { // CB 0xE0            
            Z80._register.b |= (1<<4); Z80._register.t = 8; },
        SET_b4_C: function () { // CB 0xE1            
            Z80._register.c |= (1<<4); Z80._register.t = 8; },
        SET_b4_D: function () { // CB 0xE2            
            Z80._register.d |= (1<<4); Z80._register.t = 8; },
        SET_b4_E: function () { // CB 0xE3            
            Z80._register.e |= (1<<4); Z80._register.t = 8; },
        SET_b4_H: function () { // CB 0xE4                        
            Z80._register.h |= (1<<4); Z80._register.t = 8; },        
        SET_b4_L: function () { // CB 0xE5                        
            Z80._register.l |= (1<<4); Z80._register.t = 8; },    
        SET_b4_HLmem: function () { // CB 0xE6
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<4)); Z80._register.t = 16; },
        SET_b5_A: function () { // CB 0xEF            
            Z80._register.a |= (1<<5); Z80._register.t = 8; },
        SET_b5_B: function () { // CB 0xE8            
            Z80._register.b |= (1<<5); Z80._register.t = 8; },
        SET_b5_C: function () { // CB 0xE9            
            Z80._register.c |= (1<<5); Z80._register.t = 8; },
        SET_b5_D: function () { // CB 0xEA            
            Z80._register.d |= (1<<5); Z80._register.t = 8; },
        SET_b5_E: function () { // CB 0xEB            
            Z80._register.e |= (1<<5); Z80._register.t = 8; },
        SET_b5_H: function () { // CB 0xEC                        
            Z80._register.h |= (1<<5); Z80._register.t = 8; },        
        SET_b5_L: function () { // CB 0xED                        
            Z80._register.l |= (1<<5); Z80._register.t = 8; },    
        SET_b5_HLmem: function () { // CB 0xEE
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<5)); Z80._register.t = 16; },
        SET_b6_A: function () { // CB 0xF7            
            Z80._register.a |= (1<<6); Z80._register.t = 8; },
        SET_b6_B: function () { // CB 0xF0            
            Z80._register.b |= (1<<6); Z80._register.t = 8; },
        SET_b6_C: function () { // CB 0xF1            
            Z80._register.c |= (1<<6); Z80._register.t = 8; },
        SET_b6_D: function () { // CB 0xF2            
            Z80._register.d |= (1<<6); Z80._register.t = 8; },
        SET_b6_E: function () { // CB 0xF3            
            Z80._register.e |= (1<<6); Z80._register.t = 8; },
        SET_b6_H: function () { // CB 0xF4                        
            Z80._register.h |= (1<<6); Z80._register.t = 8; },        
        SET_b6_L: function () { // CB 0xF5                        
            Z80._register.l |= (1<<6); Z80._register.t = 8; },    
        SET_b6_HLmem: function () { // CB 0xF6
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<6)); Z80._register.t = 16; },
        SET_b7_A: function () { // CB 0xFF            
            Z80._register.a |= (1<<7); Z80._register.t = 8; },
        SET_b7_B: function () { // CB 0xF8            
            Z80._register.b |= (1<<7); Z80._register.t = 8; },
        SET_b7_C: function () { // CB 0xF9            
            Z80._register.c |= (1<<7); Z80._register.t = 8; },
        SET_b7_D: function () { // CB 0xFA            
            Z80._register.d |= (1<<7); Z80._register.t = 8; },
        SET_b7_E: function () { // CB 0xFB            
            Z80._register.e |= (1<<7); Z80._register.t = 8; },
        SET_b7_H: function () { // CB 0xFC                        
            Z80._register.h |= (1<<7); Z80._register.t = 8; },        
        SET_b7_L: function () { // CB 0xFD                        
            Z80._register.l |= (1<<7); Z80._register.t = 8; },    
        SET_b7_HLmem: function () { // CB 0xFE
            let hl = (Z80._register.h<<8)+Z80._register.l; MMU.writeByte(hl, MMU.readByte(hl)|(1<<7)); Z80._register.t = 16; },

        NOT_IMPLEMENTED: function () {
            throw "FUNCTION NOT IMPLEMENTED";
        }
    }
};

// Main Instruction Map
Z80._map = [
    // 00 - 0F
    Z80._ops.NOP, Z80._ops.LD_BC_d16, Z80._ops.LD_BCmem_A, Z80._ops.INC_BC, 
    Z80._ops.INC_B, Z80._ops.DEC_B, Z80._ops.LD_B_n, Z80._ops.RLCA, 
    Z80._ops.LD_d16mem_SP, Z80._ops.ADD_HL_BC, Z80._ops.LD_A_BCmem, Z80._ops.DEC_BC, 
    Z80._ops.INC_C, Z80._ops.DEC_C, Z80._ops.LD_C_n, Z80._ops.RRCA, 

    // 10 - 1F
    Z80._ops.STOP, Z80._ops.LD_DE_d16, Z80._ops.LD_DEmem_A, Z80._ops.INC_DE, 
    Z80._ops.INC_D, Z80._ops.DEC_D, Z80._ops.LD_D_n, Z80._ops.RLA, 
    Z80._ops.JR_n, Z80._ops.ADD_HL_DE, Z80._ops.LD_A_DEmem, Z80._ops.DEC_DE, 
    Z80._ops.INC_E, Z80._ops.DEC_E, Z80._ops.LD_E_n, Z80._ops.RRA, 

    // 20 - 2F
    Z80._ops.JR_NZ_n, Z80._ops.LD_HL_nn, Z80._ops.LDI_HLmem_A, Z80._ops.INC_HL, 
    Z80._ops.INC_H, Z80._ops.DEC_H, Z80._ops.LD_H_n, Z80._ops.DAA, 
    Z80._ops.JR_Z_N, Z80._ops.ADD_HL_HL, Z80._ops.LDI_A_HLmem, Z80._ops.DEC_HL, 
    Z80._ops.INC_L, Z80._ops.DEC_L, Z80._ops.LD_L_n, Z80._ops.CPL, 

    // 30 - 3F
    Z80._ops.JR_NC_n, Z80._ops.LD_SP_nn, Z80._ops.LDD_HLmem_A, Z80._ops.INC_SP, 
    Z80._ops.INC_HLmem, Z80._ops.DEC_HL, Z80._ops.LD_HLmem_d8, Z80._ops.SCF, 
    Z80._ops.JR_C_n, Z80._ops.ADD_HL_SP, Z80._ops.LDD_A_HLmem, Z80._ops.DEC_SP, 
    Z80._ops.INC_A, Z80._ops.DEC_A, Z80._ops.LD_A_d8, Z80._ops.CCF, 

    // 40 - 4F
    Z80._ops.LD_B_B, Z80._ops.LD_B_C, Z80._ops.LD_B_D, Z80._ops.LD_B_E, 
    Z80._ops.LD_B_H, Z80._ops.LD_B_L, Z80._ops.LD_B_HLmem, Z80._ops.LD_B_A, 
    Z80._ops.LD_C_B, Z80._ops.LD_C_C, Z80._ops.LD_C_D, Z80._ops.LD_C_E, 
    Z80._ops.LD_C_H, Z80._ops.LD_C_L, Z80._ops.LD_C_HLmem, Z80._ops.LD_C_A, 

    // 50 - 5F
    Z80._ops.LD_D_B, Z80._ops.LD_D_C, Z80._ops.LD_D_D, Z80._ops.LD_D_E, 
    Z80._ops.LD_D_H, Z80._ops.LD_D_L, Z80._ops.LD_D_HLmem, Z80._ops.LD_D_A, 
    Z80._ops.LD_E_B, Z80._ops.LD_E_C, Z80._ops.LD_E_D, Z80._ops.LD_E_E, 
    Z80._ops.LD_E_H, Z80._ops.LD_E_L, Z80._ops.LD_E_HLmem, Z80._ops.LD_E_A, 

    // 60 - 6F
    Z80._ops.LD_H_B, Z80._ops.LD_H_C, Z80._ops.LD_H_D, Z80._ops.LD_H_E, 
    Z80._ops.LD_H_H, Z80._ops.LD_H_L, Z80._ops.LD_H_HLmem, Z80._ops.LD_H_A, 
    Z80._ops.LD_L_B, Z80._ops.LD_L_C, Z80._ops.LD_L_D, Z80._ops.LD_L_E, 
    Z80._ops.LD_L_H, Z80._ops.LD_L_L, Z80._ops.LD_L_HLmem, Z80._ops.LD_L_A, 

    // 70 - 7F
    Z80._ops.LD_HLmem_B, Z80._ops.LD_HLmem_C, Z80._ops.LD_HLmem_D, Z80._ops.LD_HLmem_E, 
    Z80._ops.LD_HLmem_H, Z80._ops.LD_HLmem_L, Z80._ops.HALT, Z80._ops.LD_HLmem_A, 
    Z80._ops.LD_A_B, Z80._ops.LD_A_C, Z80._ops.LD_A_D, Z80._ops.LD_A_E, 
    Z80._ops.LD_A_H, Z80._ops.LD_A_L, Z80._ops.LD_A_HLmem, Z80._ops.LD_A_A, 

    // 80 - 8F
    Z80._ops.ADD_A_B, Z80._ops.ADD_A_C, Z80._ops.ADD_A_D, Z80._ops.ADD_A_E, 
    Z80._ops.ADD_A_H, Z80._ops.ADD_A_L, Z80._ops.ADD_A_HLmem, Z80._ops.ADD_A_A, 
    Z80._ops.ADC_A_B, Z80._ops.ADC_A_C, Z80._ops.ADC_A_D, Z80._ops.ADC_A_E, 
    Z80._ops.ADC_A_H, Z80._ops.ADC_A_L, Z80._ops.ADC_A_HLmem, Z80._ops.ADC_A_A, 

    // 90 - 9F
    Z80._ops.SUB_B, Z80._ops.SUB_C, Z80._ops.SUB_D, Z80._ops.SUB_E, 
    Z80._ops.SUB_H, Z80._ops.SUB_L, Z80._ops.SUB_HLmem, Z80._ops.SUB_A, 
    Z80._ops.SBC_A_B, Z80._ops.SBC_A_C, Z80._ops.SBC_A_D, Z80._ops.SBC_A_E, 
    Z80._ops.SBC_A_H, Z80._ops.SBC_A_L, Z80._ops.SBC_A_HLmem, Z80._ops.SBC_A_A, 

    // A0 - AF
    Z80._ops.AND_B, Z80._ops.AND_C, Z80._ops.AND_D, Z80._ops.AND_E, 
    Z80._ops.AND_H, Z80._ops.AND_L, Z80._ops.AND_HLmem, Z80._ops.AND_A, 
    Z80._ops.XOR_B, Z80._ops.XOR_C, Z80._ops.XOR_D, Z80._ops.XOR_E, 
    Z80._ops.XOR_H, Z80._ops.XOR_L, Z80._ops.XOR_HLmem, Z80._ops.XOR_A, 

    // B0 - BF
    Z80._ops.OR_B, Z80._ops.OR_C, Z80._ops.OR_D, Z80._ops.OR_E, 
    Z80._ops.OR_H, Z80._ops.OR_L, Z80._ops.OR_HLmem, Z80._ops.OR_A, 
    Z80._ops.CP_B, Z80._ops.CP_C, Z80._ops.CP_D, Z80._ops.CP_E, 
    Z80._ops.CP_H, Z80._ops.CP_L, Z80._ops.CP_HLmem, Z80._ops.CP_A, 

    // C0 - CF
    Z80._ops.RET_NZ, Z80._ops.POP_BC, Z80._ops.JP_NZ_nn, Z80._ops.JP_d16, 
    Z80._ops.CALL_NZ_nn, Z80._ops.PUSH_BC, Z80._ops.ADD_A_d8, Z80._ops.RST_00, 
    Z80._ops.RET_Z, Z80._ops.RET, Z80._ops.JP_Z_nn, Z80._ops.CB, 
    Z80._ops.CALL_Z_nn, Z80._ops.CALL_nn, Z80._ops.ADC_A_d8, Z80._ops.RST_08, 

    // D0 - DF
    Z80._ops.RET_NC, Z80._ops.POP_DE, Z80._ops.JP_NC_nn, Z80._ops.NOT_IMPLEMENTED, 
    Z80._ops.CALL_NC_nn, Z80._ops.PUSH_DE, Z80._ops.SUB_d8, Z80._ops.RST_10, 
    Z80._ops.RET_C, Z80._ops.RETI, Z80._ops.JP_C_nn, Z80._ops.NOT_IMPLEMENTED, 
    Z80._ops.CALL_C_nn, Z80._ops.NOT_IMPLEMENTED, Z80._ops.SBC_A_d8, Z80._ops.RST_18, 

    // E0 - EF
    Z80._ops.LDH_d8mem_A, Z80._ops.POP_HL, Z80._ops.LD_Cmem_A, Z80._ops.NOT_IMPLEMENTED, 
    Z80._ops.NOT_IMPLEMENTED, Z80._ops.PUSH_HL, Z80._ops.AND_d8, Z80._ops.RST_20, 
    Z80._ops.ADD_SP_n, Z80._ops.JP_HLmem, Z80._ops.LD_a16mem_A, Z80._ops.NOT_IMPLEMENTED, 
    Z80._ops.NOT_IMPLEMENTED, Z80._ops.NOT_IMPLEMENTED, Z80._ops.XOR_d8, Z80._ops.RST_28,

    // F0 - FF
    Z80._ops.LDH_A_d8mem, Z80._ops.POP_AF, Z80._ops.LD_A_Cmem, Z80._ops.DI, 
    Z80._ops.NOT_IMPLEMENTED, Z80._ops.PUSH_AF, Z80._ops.OR_d8, Z80._ops.RST_30, 
    Z80._ops.LDHL_SP_n, Z80._ops.LD_SP_HL, Z80._ops.LD_A_d16mem, Z80._ops.EI, 
    Z80._ops.NOT_IMPLEMENTED, Z80._ops.NOT_IMPLEMENTED, Z80._ops.CP_d8, Z80._ops.RST_38
];

// Z80._map[0x00] = Z80._ops.NOP;
// Z80._map[0x01] = Z80._ops.LD_BC_d16;
// Z80._map[0x02] = Z80._ops.LD_BCmem_A;
// Z80._map[0x03] = Z80._ops.INC_BC;
// Z80._map[0x04] = Z80._ops.INC_B;
// Z80._map[0x05] = Z80._ops.DEC_B;
// Z80._map[0x06] = Z80._ops.LD_B_n;
// Z80._map[0x07] = Z80._ops.RLCA;
// Z80._map[0x08] = Z80._ops.LD_d16mem_SP;
// Z80._map[0x09] = Z80._ops.ADD_HL_BC;
// Z80._map[0x0A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x0B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x0C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x0D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x0E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x0F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x10] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x11] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x12] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x13] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x14] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x15] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x16] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x17] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x18] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x19] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x1A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x1B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x1C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x1D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x1E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x1F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x20] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x21] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x22] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x23] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x24] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x25] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x26] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x27] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x28] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x29] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x2A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x2B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x2C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x2D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x2E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x2F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x30] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x31] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x32] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x33] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x34] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x35] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x36] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x37] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x38] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x39] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x3A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x3B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x3C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x3D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x3E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x3F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x40] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x41] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x42] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x43] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x44] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x45] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x46] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x47] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x48] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x49] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x4A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x4B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x4C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x4D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x4E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x4F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x50] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x51] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x52] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x53] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x54] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x55] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x56] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x57] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x58] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x59] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x5A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x5B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x5C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x5D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x5E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x5F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x60] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x61] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x62] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x63] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x64] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x65] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x66] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x67] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x68] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x69] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x6A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x6B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x6C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x6D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x6E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x6F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x70] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x71] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x72] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x73] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x74] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x75] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x76] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x77] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x78] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x79] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x7A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x7B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x7C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x7D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x7E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x7F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x80] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x81] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x82] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x83] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x84] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x85] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x86] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x87] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x88] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x89] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x8A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x8B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x8C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x8D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x8E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x8F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x90] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x91] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x92] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x93] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x94] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x95] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x96] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x97] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x98] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x99] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x9A] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x9B] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x9C] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x9D] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x9E] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0x9F] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA0] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA1] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA2] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA3] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA4] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA5] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA6] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA7] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA8] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xA9] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xAA] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xAB] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xAC] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xAD] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xAE] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xAF] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB0] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB1] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB2] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB3] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB4] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB5] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB6] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB7] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB8] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xB9] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xBA] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xBB] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xBC] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xBD] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xBE] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xBF] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC0] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC1] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC2] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC3] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC4] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC5] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC6] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC7] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC8] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xC9] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xCA] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xCB] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xCC] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xCD] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xCE] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xCF] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD0] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD1] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD2] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD3] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD4] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD5] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD6] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD7] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD8] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xD9] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xDA] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xDB] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xDC] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xDD] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xDE] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xDF] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE0] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE1] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE2] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE3] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE4] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE5] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE6] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE7] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE8] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xE9] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xEA] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xEB] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xEC] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xED] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xEE] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xEF] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF0] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF1] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF2] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF3] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF4] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF5] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF6] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF7] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF8] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xF9] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xFA] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xFB] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xFC] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xFD] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xFE] = Z80._ops.NOT_IMPLEMENTED;
// Z80._map[0xFF] = Z80._ops.NOT_IMPLEMENTED;

// CB Instruction Map
Z80._cbMap[0x00] = Z80._ops.RLC_B;
Z80._cbMap[0x01] = Z80._ops.RLC_C;
Z80._cbMap[0x02] = Z80._ops.RLC_D;
Z80._cbMap[0x03] = Z80._ops.RLC_E;
Z80._cbMap[0x04] = Z80._ops.RLC_H;
Z80._cbMap[0x05] = Z80._ops.RLC_L;
Z80._cbMap[0x06] = Z80._ops.RLC_HLmem;
Z80._cbMap[0x07] = Z80._ops.RLC_A;
Z80._cbMap[0x08] = Z80._ops.RRC_B;
Z80._cbMap[0x09] = Z80._ops.RRC_C;
Z80._cbMap[0x0A] = Z80._ops.RRC_D;
Z80._cbMap[0x0B] = Z80._ops.RRC_E;
Z80._cbMap[0x0C] = Z80._ops.RRC_H;
Z80._cbMap[0x0D] = Z80._ops.RRC_L;
Z80._cbMap[0x0E] = Z80._ops.RRC_HLmem;
Z80._cbMap[0x0F] = Z80._ops.RRC_A;
Z80._cbMap[0x10] = Z80._ops.RL_B;
Z80._cbMap[0x11] = Z80._ops.RL_C;
Z80._cbMap[0x12] = Z80._ops.RL_D;
Z80._cbMap[0x13] = Z80._ops.RL_E;
Z80._cbMap[0x14] = Z80._ops.RL_H;
Z80._cbMap[0x15] = Z80._ops.RL_L;
Z80._cbMap[0x16] = Z80._ops.RL_HLmem;
Z80._cbMap[0x17] = Z80._ops.RL_A;
Z80._cbMap[0x18] = Z80._ops.RR_B;
Z80._cbMap[0x19] = Z80._ops.RR_C;
Z80._cbMap[0x1A] = Z80._ops.RR_D;
Z80._cbMap[0x1B] = Z80._ops.RR_E;
Z80._cbMap[0x1C] = Z80._ops.RR_H;
Z80._cbMap[0x1D] = Z80._ops.RR_L;
Z80._cbMap[0x1E] = Z80._ops.RR_HLmem;
Z80._cbMap[0x1F] = Z80._ops.RR_A;
Z80._cbMap[0x20] = Z80._ops.SLA_B;
Z80._cbMap[0x21] = Z80._ops.SLA_C;
Z80._cbMap[0x22] = Z80._ops.SLA_D;
Z80._cbMap[0x23] = Z80._ops.SLA_E;
Z80._cbMap[0x24] = Z80._ops.SLA_H;
Z80._cbMap[0x25] = Z80._ops.SLA_L;
Z80._cbMap[0x26] = Z80._ops.SLA_HLmem;
Z80._cbMap[0x27] = Z80._ops.SLA_A;
Z80._cbMap[0x28] = Z80._ops.SRA_B;
Z80._cbMap[0x29] = Z80._ops.SRA_C;
Z80._cbMap[0x2A] = Z80._ops.SRA_D;
Z80._cbMap[0x2B] = Z80._ops.SRA_E;
Z80._cbMap[0x2C] = Z80._ops.SRA_H;
Z80._cbMap[0x2D] = Z80._ops.SRA_L;
Z80._cbMap[0x2E] = Z80._ops.SRA_HLmem;
Z80._cbMap[0x2F] = Z80._ops.SRA_A;
Z80._cbMap[0x30] = Z80._ops.SWAP_B; 
Z80._cbMap[0x31] = Z80._ops.SWAP_C; 
Z80._cbMap[0x32] = Z80._ops.SWAP_D; 
Z80._cbMap[0x33] = Z80._ops.SWAP_E;
Z80._cbMap[0x34] = Z80._ops.SWAP_H; 
Z80._cbMap[0x35] = Z80._ops.SWAP_L; 
Z80._cbMap[0x36] = Z80._ops.SWAP_HLmem; 
Z80._cbMap[0x37] = Z80._ops.SWAP_A;
Z80._cbMap[0x38] = Z80._ops.SLA_B;
Z80._cbMap[0x39] = Z80._ops.SLA_C;
Z80._cbMap[0x3A] = Z80._ops.SLA_D;
Z80._cbMap[0x3B] = Z80._ops.SLA_E;
Z80._cbMap[0x3C] = Z80._ops.SLA_H;
Z80._cbMap[0x3D] = Z80._ops.SLA_L;
Z80._cbMap[0x3E] = Z80._ops.SLA_HLmem;
Z80._cbMap[0x3F] = Z80._ops.SLA_A;
Z80._cbMap[0x40] = Z80._ops.BIT_b0_B;
Z80._cbMap[0x41] = Z80._ops.BIT_b0_C;
Z80._cbMap[0x42] = Z80._ops.BIT_b0_D;
Z80._cbMap[0x43] = Z80._ops.BIT_b0_E;
Z80._cbMap[0x44] = Z80._ops.BIT_b0_H;
Z80._cbMap[0x45] = Z80._ops.BIT_b0_L;
Z80._cbMap[0x46] = Z80._ops.BIT_b0_HLmem;
Z80._cbMap[0x47] = Z80._ops.BIT_b0_A;
Z80._cbMap[0x48] = Z80._ops.BIT_b1_B;
Z80._cbMap[0x49] = Z80._ops.BIT_b1_C;
Z80._cbMap[0x4A] = Z80._ops.BIT_b1_D;
Z80._cbMap[0x4B] = Z80._ops.BIT_b1_E;
Z80._cbMap[0x4C] = Z80._ops.BIT_b1_H;
Z80._cbMap[0x4D] = Z80._ops.BIT_b1_L;
Z80._cbMap[0x4E] = Z80._ops.BIT_b1_HLmem;
Z80._cbMap[0x4F] = Z80._ops.BIT_b1_A;
Z80._cbMap[0x50] = Z80._ops.BIT_b2_B;
Z80._cbMap[0x51] = Z80._ops.BIT_b2_C;
Z80._cbMap[0x52] = Z80._ops.BIT_b2_D;
Z80._cbMap[0x53] = Z80._ops.BIT_b2_E;
Z80._cbMap[0x54] = Z80._ops.BIT_b2_H;
Z80._cbMap[0x55] = Z80._ops.BIT_b2_L;
Z80._cbMap[0x56] = Z80._ops.BIT_b2_HLmem;
Z80._cbMap[0x57] = Z80._ops.BIT_b2_A;
Z80._cbMap[0x58] = Z80._ops.BIT_b3_B;
Z80._cbMap[0x59] = Z80._ops.BIT_b3_C;
Z80._cbMap[0x5A] = Z80._ops.BIT_b3_D;
Z80._cbMap[0x5B] = Z80._ops.BIT_b3_E;
Z80._cbMap[0x5C] = Z80._ops.BIT_b3_H;
Z80._cbMap[0x5D] = Z80._ops.BIT_b3_L;
Z80._cbMap[0x5E] = Z80._ops.BIT_b3_HLmem;
Z80._cbMap[0x5F] = Z80._ops.BIT_b3_A;
Z80._cbMap[0x60] = Z80._ops.BIT_b4_B;
Z80._cbMap[0x61] = Z80._ops.BIT_b4_C;
Z80._cbMap[0x62] = Z80._ops.BIT_b4_D;
Z80._cbMap[0x63] = Z80._ops.BIT_b4_E;
Z80._cbMap[0x64] = Z80._ops.BIT_b4_H;
Z80._cbMap[0x65] = Z80._ops.BIT_b4_L;
Z80._cbMap[0x66] = Z80._ops.BIT_b4_HLmem;
Z80._cbMap[0x67] = Z80._ops.BIT_b4_A;
Z80._cbMap[0x68] = Z80._ops.BIT_b5_B;
Z80._cbMap[0x69] = Z80._ops.BIT_b5_C;
Z80._cbMap[0x6A] = Z80._ops.BIT_b5_D;
Z80._cbMap[0x6B] = Z80._ops.BIT_b5_E;
Z80._cbMap[0x6C] = Z80._ops.BIT_b5_H;
Z80._cbMap[0x6D] = Z80._ops.BIT_b5_L;
Z80._cbMap[0x6E] = Z80._ops.BIT_b5_HLmem;
Z80._cbMap[0x6F] = Z80._ops.BIT_b5_A;
Z80._cbMap[0x70] = Z80._ops.BIT_b6_B;
Z80._cbMap[0x71] = Z80._ops.BIT_b6_C;
Z80._cbMap[0x72] = Z80._ops.BIT_b6_D;
Z80._cbMap[0x73] = Z80._ops.BIT_b6_E;
Z80._cbMap[0x74] = Z80._ops.BIT_b6_H;
Z80._cbMap[0x75] = Z80._ops.BIT_b6_L;
Z80._cbMap[0x76] = Z80._ops.BIT_b6_HLmem;
Z80._cbMap[0x77] = Z80._ops.BIT_b6_A;
Z80._cbMap[0x78] = Z80._ops.BIT_b7_B;
Z80._cbMap[0x79] = Z80._ops.BIT_b7_C;
Z80._cbMap[0x7A] = Z80._ops.BIT_b7_D;
Z80._cbMap[0x7B] = Z80._ops.BIT_b7_E;
Z80._cbMap[0x7C] = Z80._ops.BIT_b7_H;
Z80._cbMap[0x7D] = Z80._ops.BIT_b7_L;
Z80._cbMap[0x7E] = Z80._ops.BIT_b7_HLmem;
Z80._cbMap[0x7F] = Z80._ops.BIT_b7_A;
Z80._cbMap[0x80] = Z80._ops.RES_b0_B;
Z80._cbMap[0x81] = Z80._ops.RES_b0_C;
Z80._cbMap[0x82] = Z80._ops.RES_b0_D;
Z80._cbMap[0x83] = Z80._ops.RES_b0_E;
Z80._cbMap[0x84] = Z80._ops.RES_b0_H;
Z80._cbMap[0x85] = Z80._ops.RES_b0_L;
Z80._cbMap[0x86] = Z80._ops.RES_b0_HLmem;
Z80._cbMap[0x87] = Z80._ops.RES_b0_A;
Z80._cbMap[0x88] = Z80._ops.RES_b1_B;
Z80._cbMap[0x89] = Z80._ops.RES_b1_C;
Z80._cbMap[0x8A] = Z80._ops.RES_b1_D;
Z80._cbMap[0x8B] = Z80._ops.RES_b1_E;
Z80._cbMap[0x8C] = Z80._ops.RES_b1_H;
Z80._cbMap[0x8D] = Z80._ops.RES_b1_L;
Z80._cbMap[0x8E] = Z80._ops.RES_b1_HLmem;
Z80._cbMap[0x8F] = Z80._ops.RES_b1_A;
Z80._cbMap[0x90] = Z80._ops.RES_b2_B;
Z80._cbMap[0x91] = Z80._ops.RES_b2_C;
Z80._cbMap[0x92] = Z80._ops.RES_b2_D;
Z80._cbMap[0x93] = Z80._ops.RES_b2_E;
Z80._cbMap[0x94] = Z80._ops.RES_b2_H;
Z80._cbMap[0x95] = Z80._ops.RES_b2_L;
Z80._cbMap[0x96] = Z80._ops.RES_b2_HLmem;
Z80._cbMap[0x97] = Z80._ops.RES_b2_A;
Z80._cbMap[0x98] = Z80._ops.RES_b3_B;
Z80._cbMap[0x99] = Z80._ops.RES_b3_C;
Z80._cbMap[0x9A] = Z80._ops.RES_b3_D;
Z80._cbMap[0x9B] = Z80._ops.RES_b3_E;
Z80._cbMap[0x9C] = Z80._ops.RES_b3_H;
Z80._cbMap[0x9D] = Z80._ops.RES_b3_L;
Z80._cbMap[0x9E] = Z80._ops.RES_b3_HLmem;
Z80._cbMap[0x9F] = Z80._ops.RES_b3_A;
Z80._cbMap[0xA0] = Z80._ops.RES_b4_B;
Z80._cbMap[0xA1] = Z80._ops.RES_b4_C;
Z80._cbMap[0xA2] = Z80._ops.RES_b4_D;
Z80._cbMap[0xA3] = Z80._ops.RES_b4_E;
Z80._cbMap[0xA4] = Z80._ops.RES_b4_H;
Z80._cbMap[0xA5] = Z80._ops.RES_b4_L;
Z80._cbMap[0xA6] = Z80._ops.RES_b4_HLmem;
Z80._cbMap[0xA7] = Z80._ops.RES_b4_A;
Z80._cbMap[0xA8] = Z80._ops.RES_b5_B;
Z80._cbMap[0xA9] = Z80._ops.RES_b5_C;
Z80._cbMap[0xAA] = Z80._ops.RES_b5_D;
Z80._cbMap[0xAB] = Z80._ops.RES_b5_E;
Z80._cbMap[0xAC] = Z80._ops.RES_b5_H;
Z80._cbMap[0xAD] = Z80._ops.RES_b5_L;
Z80._cbMap[0xAE] = Z80._ops.RES_b5_HLmem;
Z80._cbMap[0xAF] = Z80._ops.RES_b5_A;
Z80._cbMap[0xB0] = Z80._ops.RES_b6_B;
Z80._cbMap[0xB1] = Z80._ops.RES_b6_C;
Z80._cbMap[0xB2] = Z80._ops.RES_b6_D;
Z80._cbMap[0xB3] = Z80._ops.RES_b6_E;
Z80._cbMap[0xB4] = Z80._ops.RES_b6_H;
Z80._cbMap[0xB5] = Z80._ops.RES_b6_L;
Z80._cbMap[0xB6] = Z80._ops.RES_b6_HLmem;
Z80._cbMap[0xB7] = Z80._ops.RES_b6_A;
Z80._cbMap[0xB8] = Z80._ops.RES_b7_B;
Z80._cbMap[0xB9] = Z80._ops.RES_b7_C;
Z80._cbMap[0xBA] = Z80._ops.RES_b7_D;
Z80._cbMap[0xBB] = Z80._ops.RES_b7_E;
Z80._cbMap[0xBC] = Z80._ops.RES_b7_H;
Z80._cbMap[0xBD] = Z80._ops.RES_b7_L;
Z80._cbMap[0xBE] = Z80._ops.RES_b7_HLmem;
Z80._cbMap[0xBF] = Z80._ops.RES_b7_A;
Z80._cbMap[0xC0] = Z80._ops.SET_b0_B;
Z80._cbMap[0xC1] = Z80._ops.SET_b0_C;
Z80._cbMap[0xC2] = Z80._ops.SET_b0_D;
Z80._cbMap[0xC3] = Z80._ops.SET_b0_E;
Z80._cbMap[0xC4] = Z80._ops.SET_b0_H;
Z80._cbMap[0xC5] = Z80._ops.SET_b0_L;
Z80._cbMap[0xC6] = Z80._ops.SET_b0_HLmem;
Z80._cbMap[0xC7] = Z80._ops.SET_b0_A;
Z80._cbMap[0xC8] = Z80._ops.SET_b1_B;
Z80._cbMap[0xC9] = Z80._ops.SET_b1_C;
Z80._cbMap[0xCA] = Z80._ops.SET_b1_D;
Z80._cbMap[0xCB] = Z80._ops.SET_b1_E;
Z80._cbMap[0xCC] = Z80._ops.SET_b1_H;
Z80._cbMap[0xCD] = Z80._ops.SET_b1_L;
Z80._cbMap[0xCE] = Z80._ops.SET_b1_HLmem;
Z80._cbMap[0xCF] = Z80._ops.SET_b1_A;
Z80._cbMap[0xD0] = Z80._ops.SET_b2_B;
Z80._cbMap[0xD1] = Z80._ops.SET_b2_C;
Z80._cbMap[0xD2] = Z80._ops.SET_b2_D;
Z80._cbMap[0xD3] = Z80._ops.SET_b2_E;
Z80._cbMap[0xD4] = Z80._ops.SET_b2_H;
Z80._cbMap[0xD5] = Z80._ops.SET_b2_L;
Z80._cbMap[0xD6] = Z80._ops.SET_b2_HLmem;
Z80._cbMap[0xD7] = Z80._ops.SET_b2_A;
Z80._cbMap[0xD8] = Z80._ops.SET_b3_B;
Z80._cbMap[0xD9] = Z80._ops.SET_b3_C;
Z80._cbMap[0xDA] = Z80._ops.SET_b3_D;
Z80._cbMap[0xDB] = Z80._ops.SET_b3_E;
Z80._cbMap[0xDC] = Z80._ops.SET_b3_H;
Z80._cbMap[0xDD] = Z80._ops.SET_b3_L;
Z80._cbMap[0xDE] = Z80._ops.SET_b3_HLmem;
Z80._cbMap[0xDF] = Z80._ops.SET_b3_A;
Z80._cbMap[0xE0] = Z80._ops.SET_b4_B;
Z80._cbMap[0xE1] = Z80._ops.SET_b4_C;
Z80._cbMap[0xE2] = Z80._ops.SET_b4_D;
Z80._cbMap[0xE3] = Z80._ops.SET_b4_E;
Z80._cbMap[0xE4] = Z80._ops.SET_b4_H;
Z80._cbMap[0xE5] = Z80._ops.SET_b4_L;
Z80._cbMap[0xE6] = Z80._ops.SET_b4_HLmem;
Z80._cbMap[0xE7] = Z80._ops.SET_b4_A;
Z80._cbMap[0xE8] = Z80._ops.SET_b5_B;
Z80._cbMap[0xE9] = Z80._ops.SET_b5_C;
Z80._cbMap[0xEA] = Z80._ops.SET_b5_D;
Z80._cbMap[0xEB] = Z80._ops.SET_b5_E;
Z80._cbMap[0xEC] = Z80._ops.SET_b5_H;
Z80._cbMap[0xED] = Z80._ops.SET_b5_L;
Z80._cbMap[0xEE] = Z80._ops.SET_b5_HLmem;
Z80._cbMap[0xEF] = Z80._ops.SET_b5_A;
Z80._cbMap[0xF0] = Z80._ops.SET_b6_B;
Z80._cbMap[0xF1] = Z80._ops.SET_b6_C;
Z80._cbMap[0xF2] = Z80._ops.SET_b6_D;
Z80._cbMap[0xF3] = Z80._ops.SET_b6_E;
Z80._cbMap[0xF4] = Z80._ops.SET_b6_H;
Z80._cbMap[0xF5] = Z80._ops.SET_b6_L;
Z80._cbMap[0xF6] = Z80._ops.SET_b6_HLmem;
Z80._cbMap[0xF7] = Z80._ops.SET_b6_A;
Z80._cbMap[0xF8] = Z80._ops.SET_b7_B;
Z80._cbMap[0xF9] = Z80._ops.SET_b7_C;
Z80._cbMap[0xFA] = Z80._ops.SET_b7_D;
Z80._cbMap[0xFB] = Z80._ops.SET_b7_E;
Z80._cbMap[0xFC] = Z80._ops.SET_b7_H;
Z80._cbMap[0xFD] = Z80._ops.SET_b7_L;
Z80._cbMap[0xFE] = Z80._ops.SET_b7_HLmem;
Z80._cbMap[0xFF] = Z80._ops.SET_b7_A;