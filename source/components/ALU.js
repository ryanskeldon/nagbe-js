ALU = {
    ADD_A_n: function (input, time) {
        let a = Z80._register.a;                                                        
        Z80._register.f &= ~Z80._flags.subtraction;
        Z80._register.a += input;

        if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;
        Z80._register.a &= 255;                                                         
        if (Z80._register.a==0) Z80._register.f |= Z80._flags.zero;
        if (((a&0xf)+(input& 0xf)) > 0xf) Z80._register.f |= Z80._flags.halfCarry;    

        Z80._register.t = time;                                                            
    },
    SUB_n: function (input, time) {
        let a = Z80._register.a;
        let result = a - input;

        Z80._register.f |= Z80._flags.subtraction;        
        
        if ((result&255) === 0) Z80._register.f |= Z80._flags.zero;        
        if (a < input) Z80._register.f |= Z80._flags.carry;        
        if ((a ^ input ^ result) & 0x10 != 0) Z80._register.f |= Z80._flags.halfCarry;

        Z80._register.a = result&255;
        Z80._register.t = time;
    },
    ADC_A_n: function (input, time) {
        let original = Z80._register.a;
        Z80._register.f &= ~Z80._flags.subtraction;
        let carry = Z80._register.f & Z80._flags.carry ? 1 : 0;
        Z80._register.a += (input + carry);
        if (Z80._register.a > 255) Z80._register.f |= Z80._flags.carry;
        Z80._register.a &= 255;
        if (Z80._register.a==0) Z80._register.f |= Z80._flags.zero;
        if (((original&0xf)+(value&0xf))>0xf) Z80._register.f |= Z80._flags.halfCarry;
        Z80._register.t = time;
    },
    SBC_A_n: function (input, time) {
        let a = Z80._register.a;
        Z80._register.f |= Z80._flags.subtraction;
        let value = Z80._register.f & Z80._flags.carry ? 1 : 0;
        value += input;
        Z80._register.a -= value;
        if (Z80._register.a >= 0) Z80._register.f |= Z80._flags.carry;
        Z80._register.a &= 255; // Mask to 8-bit.
        if (Z80._register.a === 0) Z80._register.f |= Z80._flags.zero;
        if (((a&0xf) - (value&0xf)) <= 0xf) Z80._register.f |= Z80._flags.halfCarry;
        Z80._register.t = time;
    },
    OR_n: function (input, time) {
        Z80._register.a |= input;
        Z80._register.a &= 255;
        if (!Z80._register.a) Z80._register.f |= Z80._flags.zero;
        Z80._register.f &= -Z80._flags.subtraction;
        Z80._register.f &= -Z80._flags.halfCarry;
        Z80._register.f &= -Z80._flags.carry;
        Z80._register.t = time;
    },
    XOR_n: function (input, time) {         
        Z80._register.a ^= input;
        Z80._register.a &= 255;
        if (!Z80._register.a) Z80._register.f |= Z80._flags.zero;
        Z80._register.f &= -Z80._flags.subtraction;
        Z80._register.f &= -Z80._flags.halfCarry;
        Z80._register.f &= -Z80._flags.carry;
        Z80._register.t = time;
    },
    AND_n: function (input, time) {
        Z80._register.a &= input;
        Z80._register.a &= 255;
        Z80._register.f |= Z80._flags.halfCarry;
        if (!Z80._register.a) Z80._register.f |= Z80._flags.zero;
        Z80._register.f &= -Z80._flags.subtraction;        
        Z80._register.f &= -Z80._flags.carry;
        Z80._register.t = time;
    },
    CALL_cc_nn: function (condition, trueTime, falseTime) {
        let address = MMU.readWord(Z80._register.pc);
        Z80._register.pc+=2;

        if (condition) {
            Z80._register.sp-=2;
            MMU.writeWord(Z80._register.sp, Z80._register.pc);
            Z80._register.pc = address;
            Z80._register.t = trueTime;
        } else {
            Z80._register.t = falseTime;
        }
    },
    JR_cc_n: function (condition, trueTime, falseTime) {
        let move = MMU.readByte(Z80._register.pc++);
        if (condition) {            
            if (move > 127) move = -((~move+1)&255);
            Z80._register.pc += move;
            Z80._register.t = trueTime;
        } else Z80._register.t = falseTime;
    },
    ADD_HL_n: function (input) {
        let hl = (Z80._register.h<<8)+Z80._register.l;
        Z80._register.f &= ~Z80._flags.subtraction;
        if (hl+input > 0xFFFF) Z80._register.f |= Z80._flags.carry;
        else Z80._register.f &= -Z80._flags.carry;
        if ((hl&0xFF)+(input&0xFF) > 0xFF) Z80._register.f |= Z80._flags.halfCarry;
        else Z80._register.f &= -Z80._flags.halfCarry;
        hl += input;
        Z80._register.h = (hl>>8)&255;
        Z80._register.l = hl&255;
        Z80._register.t = 8;
    }
}