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
            log.write("Z80", "--- DUMP--- ");
            log.write("Z80", "A: 0x" + Z80._register.a.toString(16));
            log.write("Z80", "B: 0x" + Z80._register.b.toString(16));
            log.write("Z80", "C: 0x" + Z80._register.c.toString(16));
            log.write("Z80", "D: 0x" + Z80._register.d.toString(16));
            log.write("Z80", "E: 0x" + Z80._register.e.toString(16));
            log.write("Z80", "H: 0x" + Z80._register.h.toString(16));
            log.write("Z80", "L: 0x" + Z80._register.l.toString(16));
            log.write("Z80", "F: 0x" + Z80._register.f.toString(16));
            log.write("Z80", "PC: 0x" + Z80._register.pc.toString(16));
            log.write("Z80", "SP: 0x" + Z80._register.sp.toString(16));
            log.write("Z80", "BC: 0x" + ((Z80._register.b<<8)+Z80._register.c).toString(16));
            log.write("Z80", "DE: 0x" + ((Z80._register.d<<8)+Z80._register.e).toString(16));
            log.write("Z80", "HL: 0x" + ((Z80._register.h<<8)+Z80._register.l).toString(16));
        }
    },

    _register: {
        // Basic registers
        a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0,
        
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

    start: function () {
        while (true) {
            var opCode = MMU.readByte(Z80._register.pc++);
            
            try {
                log.write("Z80", "$0x" + (Z80._register.pc-1).toString(16) + "\tOP: 0x" + opCode.toString(16));
                Z80._map[opCode]();
                Z80._clock.t += Z80._register.t;
            } catch (error) {
                console.log(error);
                log.write("Z80", "OpCode error @ $0x" + (Z80._register.pc-1).toString(16) + "\tOpcode 0x" + opCode.toString(16));
                
                break;
            }
        }

        if (Z80._register.pc === 0x100) log.write("Z80", "BIOS load complete!");
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
        // Adders
        ADD_a: function () { // 0x87
            let a = Z80._register.a;                                                        // Store original value for reference.        
            Z80._register.f = 0;                                                            // Clear flags.
            Z80._register.a += Z80._register.a;                                             // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                 // Check for carry.        
            Z80._register.a &= 255;                                                         // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;               // Check for zero.        
            if (((a & 0xf) + (a & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;    // Check for half-carry.        
            Z80._register.t = 4;                                                            // Set operation time.
        },
        ADD_b: function () { // 0x80
            let a = Z80._register.a;                                                                    // Store original value for reference.        
            Z80._register.f = 0;                                                                        // Clear flags.
            Z80._register.a += Z80._register.b;                                                         // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                             // Check for carry.        
            Z80._register.a &= 255;                                                                     // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;                           // Check for zero.        
            if (((a & 0xf) + (Z80._register.b & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;  // Check for half-carry.        
            Z80._register.t = 4;                                                                        // Set operation time.
        },
        ADD_c: function () { // 0x81
            let a = Z80._register.a;                                                                    // Store original value for reference.        
            Z80._register.f = 0;                                                                        // Clear flags.
            Z80._register.a += Z80._register.c;                                                         // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                             // Check for carry.        
            Z80._register.a &= 255;                                                                     // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;                           // Check for zero.        
            if (((a & 0xf) + (Z80._register.c & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;  // Check for half-carry.        
            Z80._register.t = 4;                                                                        // Set operation time.
        },
        ADD_d: function () { // 0x82
            let a = Z80._register.a;                                                                    // Store original value for reference.        
            Z80._register.f = 0;                                                                        // Clear flags.
            Z80._register.a += Z80._register.d;                                                         // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                             // Check for carry.        
            Z80._register.a &= 255;                                                                     // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;                           // Check for zero.        
            if (((a & 0xf) + (Z80._register.d & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;  // Check for half-carry.        
            Z80._register.t = 4;                                                                        // Set operation time.
        },
        ADD_e: function () { // 0x83
            let a = Z80._register.a;                                                                    // Store original value for reference.        
            Z80._register.f = 0;                                                                        // Clear flags.
            Z80._register.a += Z80._register.e;                                                         // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                             // Check for carry.        
            Z80._register.a &= 255;                                                                     // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;                           // Check for zero.        
            if (((a & 0xf) + (Z80._register.e & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;  // Check for half-carry.        
            Z80._register.t = 4;                                                                        // Set operation time.
        },
        ADD_h: function () { // 0x84
            let a = Z80._register.a;                                                                    // Store original value for reference.        
            Z80._register.f = 0;                                                                        // Clear flags.
            Z80._register.a += Z80._register.h;                                                         // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                             // Check for carry.        
            Z80._register.a &= 255;                                                                     // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;                           // Check for zero.        
            if (((a & 0xf) + (Z80._register.h & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;  // Check for half-carry.        
            Z80._register.t = 4;                                                                        // Set operation time.
        },
        ADD_l: function () { // 0x85
            let a = Z80._register.a;                                                                    // Store original value for reference.        
            Z80._register.f = 0;                                                                        // Clear flags.
            Z80._register.a += Z80._register.l;                                                         // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                             // Check for carry.        
            Z80._register.a &= 255;                                                                     // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;                           // Check for zero.        
            if (((a & 0xf) + (Z80._register.l & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;  // Check for half-carry.        
            Z80._register.t = 4;                                                                        // Set operation time.
        },
        ADD_hl: function () { // 0x86
            let a = Z80._register.a;                                                        // Store original value for reference.        
            let hl = MMU.readByte((Z80._register.h<<8)+Z80._register.l); 
            Z80._register.f = 0;                                                            // Clear flags.
            Z80._register.a += hl;                                                          // Add B to A.                              
            if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;                 // Check for carry.        
            Z80._register.a &= 255;                                                         // Mask to 8-bit.       
            if (!(Z80._register.a & 255)) Z80._register.f |= Z80._flags.zero;               // Check for zero.        
            if (((a & 0xf) + (hl & 0xf)) & 0x10) Z80._register.f |= Z80._flags.halfCarry;   // Check for half-carry.        
            Z80._register.t = 8;                                                            // Set operation time.
        },


        // 8-bit Loads
        LD_a_n: function () { // 0x3E LD a, n
            Z80._register.a = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        LD_b_n: function () { // 0x06 LD b, n
            Z80._register.b = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        LD_c_n: function () { // 0x0E LD c, n
            Z80._register.c = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        LD_d_n: function () { // 0x16 LD d, n
            Z80._register.d = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        LD_e_n: function () { // 0x1E LD e, n
            Z80._register.e = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        LD_h_n: function () { // 0x26 LD h, n
            Z80._register.h = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        LD_l_n: function () { // 0x2E LD l, n
            Z80._register.l = MMU.readByte(Z80._register.pc++); Z80._register.t = 8;
        },
        
        LD_a_a: function () { // 0x7F LD A, A
            Z80._register.a = Z80._register.a; Z80._register.t = 4;
        },
        LD_b_a: function () { // 0x47 LD B, A
            Z80._register.b = Z80._register.a; Z80._register.t = 4;
        },
        LD_c_a: function () { // 0x4F LD C, A
            Z80._register.c = Z80._register.a; Z80._register.t = 4;
        },
        LD_d_a: function () { // 0x57 LD D, A
            Z80._register.d = Z80._register.a; Z80._register.t = 4;
        },
        LD_e_a: function () { // 0x5F LD E, A
            Z80._register.e = Z80._register.a; Z80._register.t = 4;
        },
        LD_h_a: function () { // 0x67 LD H, A
            Z80._register.h = Z80._register.a; Z80._register.t = 4;
        },
        LD_l_a: function () { // 0x6F LD L, A
            Z80._register.l = Z80._register.a; Z80._register.t = 4;
        },
        LD_bc_a: function () { // 0x02 LD (BC), A
            MMU.writeWord((Z80._register.b<<8)+Z80._register.c, Z80._register.a); Z80._register.t = 8;
        },
        LD_de_a: function () { // 0x12 LD (DE), A
            MMU.writeWord((Z80._register.d<<8)+Z80._register.e, Z80._register.a); Z80._register.t = 8;
        },
        LD_hl_a: function () { // 0x77 LD (HL), A
            MMU.writeWord((Z80._register.h<<8)+Z80._register.l, Z80._register.a); Z80._register.t = 8;
        },

        LD_a_bc: function () { // 0x0A LD A, (BC)
            Z80._register.a = MMU.readByte((Z80._register.b<<8)+Z80._register.e);
            Z80._register.t = 8;
        },
        LD_a_de: function () { // 0x1A LD A, (DE)
            Z80._register.a = MMU.readByte((Z80._register.d<<8)+Z80._register.e);
            Z80._register.t = 8;
        },

        LDH_n_a: function () { // 0xE0 LDH (n), A
            MMU.writeByte(MMU.readByte(Z80._register.pc++)+0xFF00, Z80._register.a);
            Z80._register.t = 12;
        },

        LD_hld_a: function () { // 0x32 LD hl-, a
            MMU.writeByte((Z80._register.h << 8) + Z80._register.l, Z80._register.a);   // Write A to the address stored in HL.
            Z80._register.l = (Z80._register.l - 1) & 255;                              // Minus 1 then mask to 8-bit;
            if (Z80._register.l == 255) Z80._register.h = (Z80._register.h - 1) & 255;  // Check for underflow of L, decrease H by 1
            Z80._register.t = 8;                                                        // Set operation time.
        },

        LD_cio_a: function () { // 0xE2 LD (0xFF00 + c), a
            MMU.writeByte(0xFF00 + Z80._register.c, Z80._register.a);
            Z80._register.t = 8;            
        },


        // 16-bit Loads
        LD_bc_nn: function () { // 0x01
            Z80._register.c = MMU.readByte(Z80._register.pc++);
            Z80._register.b = MMU.readByte(Z80._register.pc++);
            Z80._register.t = 12; // Set operation time.
        },
        LD_de_nn: function () { // 0x11
            Z80._register.e = MMU.readByte(Z80._register.pc++);
            Z80._register.d = MMU.readByte(Z80._register.pc++);
            Z80._register.t = 12; // Set operation time.
        },
        LD_hl_nn: function () { // 0x21
            Z80._register.l = MMU.readByte(Z80._register.pc++);
            Z80._register.h = MMU.readByte(Z80._register.pc++);
            Z80._register.t = 12; // Set operation time.
        },
        LD_sp_nn: function () { // 0x31
            // Load the next word into the stack pointer.
            // This sets the stack pointer up for initial use usually.
            // Most games set this to 0xFFFE on boot.
            Z80._register.sp = MMU.readWord(Z80._register.pc);  // Read next word.
            Z80._register.pc += 2;                              // Skip a word.
            Z80._register.t = 12;          // Set operation time.
        },


        // Jumps
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


        // Calls
        CALL_nn: function() { // 0xCD CALL nn
            let address = MMU.readWord(Z80._register.pc);       // Get address of new instruction.
            Z80._register.pc+=2;
            Z80._register.sp-=2;                                // Move down 1 word.
            MMU.writeWord(Z80._register.sp, Z80._register.pc);  // Push address of next instruction
            Z80._register.pc = address;                         // Jump to new instruction.
        },

        // Pushes
        PUSH_bc: function () { // 0xC5 PUSH BC
            Z80._register.sp-=2; // Move down 1 word.
            MMU.writeWord(Z80._register.sp, (Z80._register.b<<8)+Z80._register.c); // Store BC on the stack.
            Z80._register.t = 16;
        },
  
        // XORs
        XOR_a: function () { // 0xAF            
            Z80._register.a ^= Z80._register.a;                         // XOR register A with register A.
            Z80._register.a &= 255;                                     // Mask to 8-bit.
            Z80._register.f = Z80._register.a ? 0 : Z80._flags.zero;    // Check if result was zero.
            Z80._register.t = 4;                                        // Set operation time.
        },


        // Increments
        INC_a: function () { // 0x3C                        
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.a & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.a = (Z80._register.a + 1) & 255;
            Z80._register.f |= Z80._register.a ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_b: function () { // 0x04            
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.b & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.b = (Z80._register.b + 1) & 255;
            Z80._register.f |= Z80._register.b ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_c: function () { // 0x0C            
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.c & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.c = (Z80._register.c + 1) & 255;
            Z80._register.f |= Z80._register.c ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_d: function () { // 0x14            
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.d & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.d = (Z80._register.d + 1) & 255;
            Z80._register.f |= Z80._register.d ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_e: function () { // 0x1C            
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.e & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.e = (Z80._register.e + 1) & 255;
            Z80._register.f |= Z80._register.e ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_h: function () { // 0x24
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.h & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.h = (Z80._register.h + 1) & 255;
            Z80._register.f |= Z80._register.h ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },
        INC_l: function () { // 0x2C            
            Z80._register.f &= Z80._flags.subtraction;
            if (((Z80._register.l & 0xf) + 1) & 0x10) Z80._register.f |= Z80._flags.halfCarry;
            Z80._register.l = (Z80._register.l + 1) & 255;
            Z80._register.f |= Z80._register.l ? 0 : Z80._flags.zero;
            Z80._register.t = 4;
        },


        // Bits
        BIT_7_h: function () { // CB 0x7C
            Z80._register.f = Z80._flags.halfCarry;                                     // Enable just the half-carry flag.
            Z80._register.f |= (Z80._register.h & 0x80) === 0 ? Z80._flags.zero : 0;    // Check if bit 7 is zero, set flag if true.
            Z80._register.m = 2; Z80._register.t = 8;                                   // Set operation time.
        },


        // Misc OpCodes
        map_to_CB: function () { // 0xcb            
            let cbAddress = MMU.readByte(Z80._register.pc++);   // Read next byte for the address of the CB code.            
            log.write("Z80", "\tCB OP: 0x" + cbAddress.toString(16));
            Z80._cbMap[cbAddress]();                            // Run the OpCode in the CB map.            
            Z80._register.pc &= 65535;                          // Mask the PC to 16-bit.
            Z80._register.m = 1; Z80._register.t = 4;           // Set operation time.
        }
    },

    _map: []
};

Z80._map = [
    // 00 - 0F
    null, Z80._ops.LD_bc_nn, Z80._ops.LD_bc_a, null, Z80._ops.INC_b, null, Z80._ops.LD_b_n, null, null, null, Z80._ops.LD_a_bc, null, Z80._ops.INC_c, null, Z80._ops.LD_c_n, null, 
    // 10 - 1F
    null, Z80._ops.LD_de_nn, Z80._ops.LD_de_a, null, Z80._ops.INC_d, null, Z80._ops.LD_d_n, null, null, null, Z80._ops.LD_a_de, null, Z80._ops.INC_e, null, Z80._ops.LD_e_n, null, 
    // 20 - 2F
    Z80._ops.JR_nz_n, Z80._ops.LD_hl_nn, null, null, Z80._ops.INC_h, null, Z80._ops.LD_h_n, null, null, null, null, null, Z80._ops.INC_l, null, Z80._ops.LD_l_n, null, 
    // 30 - 3F
    null, Z80._ops.LD_sp_nn, Z80._ops.LD_hld_a, null, null, null, null, null, null, null, null, null, Z80._ops.INC_a, null, Z80._ops.LD_a_n, null, 
    // 40 - 4F
    null, null, null, null, null, null, null, Z80._ops.LD_b_a, null, null, null, null, null, null, null, Z80._ops.LD_c_a, 
    // 50 - 5F
    null, null, null, null, null, null, null, Z80._ops.LD_d_a, null, null, null, null, null, null, null, Z80._ops.LD_e_a, 
    // 60 - 6F
    null, null, null, null, null, null, null, Z80._ops.LD_h_a, null, null, null, null, null, null, null, Z80._ops.LD_l_a, 
    // 70 - 7F
    null, null, null, null, null, null, null, Z80._ops.LD_hl_a, null, null, null, null, null, null, null, Z80._ops.LD_a_a, 
    // 80 - 8F
    Z80._ops.ADD_b, Z80._ops.ADD_c, Z80._ops.ADD_d, Z80._ops.ADD_e, Z80._ops.ADD_h, Z80._ops.ADD_l, Z80._ops.ADD_hl, Z80._ops.ADD_a, null, null, null, null, null, null, null, null, 
    // 90 - 9F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // A0 - AF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, Z80._ops.XOR_a, 
    // B0 - BF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // C0 - CF
    null, null, null, null, null, Z80._ops.PUSH_bc, null, null, null, null, null, Z80._ops.map_to_CB, null, Z80._ops.CALL_nn, null, null, 
    // D0 - DF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // E0 - EF
    Z80._ops.LDH_n_a, null, Z80._ops.LD_cio_a, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // F0 - FF
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
];

Z80._cbMap = [
    // 00 - 0F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 10 - 1F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 20 - 2F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
    // 30 - 3F
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 
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