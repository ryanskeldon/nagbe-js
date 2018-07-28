ALU = {
    ADD_A_n: function (input, time) {
        let a = Z80._register.a;                                                        
        Z80._register.a += input;
        if (Z80._register.a > 255) Z80.setC(); else Z80.clearC();
        Z80._register.a &= 255;                               
        Z80.clearN();                          
        if (Z80._register.a==0) Z80.setZ(); else Z80.clearZ();
        if (((a&0xf)+(input& 0xf)) > 0xf) Z80.setH(); else Z80.clearH();
        Z80._register.t = time;                                                            
    },
    ADC_A_n: function (input, time) {
        let a = Z80._register.a;
        let carry = Z80._register.f & Z80._flags.carry ? 1 : 0;
        let result = a + input + carry;

        Z80.clearN();
        if (result > 255) Z80.setC(); else Z80.clearC();
        result &= 255;        
        if (result===0) Z80.setZ(); else Z80.clearZ();

        if ((a ^ input ^ result)&0x10) Z80.setH(); else Z80.clearH();
        Z80._register.a = result;
        Z80._register.t = time;
    },
    SUB_n: function (input, time) {
        let a = Z80._register.a;
        Z80._register.a -= input;
        Z80.setN();        
        if (Z80._register.a < 0) Z80.setC(); else Z80.clearC();
        Z80._register.a &= 255;
        if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
        if ((Z80._register.a ^ input ^ a) & 0x10) Z80.setH(); else Z80.clearH();
        Z80._register.t = time;
    },
    SBC_A_n: function (input, time) {
        let a = Z80._register.a;        
        let result = a - input - (Z80._register.f & Z80._flags.carry ? 1 : 0);
        Z80.setN();
        if (result&255) Z80.clearZ(); else Z80.setZ();        
        if (result&0x100) Z80.setC(); else Z80.clearC();        
        if (((a ^ input ^ result) & 0x10) != 0) Z80.setH(); else Z80.clearH();
        Z80._register.a = result&255;
        Z80._register.t = time;
    },
    OR_n: function (input, time) {
        Z80._register.a |= input;
        Z80._register.a &= 255;
        if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
        Z80.clearN(); Z80.clearH(); Z80.clearC();
        Z80._register.t = time;
    },
    XOR_n: function (input, time) {         
        Z80._register.a ^= input;
        Z80._register.a &= 255;
        if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
        Z80.clearN(); Z80.clearH(); Z80.clearC();
        Z80._register.t = time;
    },
    AND_n: function (input, time) {
        Z80._register.a &= input;
        Z80._register.a &= 255;
        if (!Z80._register.a) Z80.setZ(); else Z80.clearZ();
        Z80.clearN(); Z80.setH(); Z80.clearC();
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
        Z80.clearN();
        if (((hl&0xFFF)+(input&0xFFF))&0x1000) Z80.setH(); else Z80.clearH();
        if (hl+input > 0xFFFF) Z80.setC(); else Z80.clearC();
        hl += input;
        Z80._register.h = (hl>>8)&255;
        Z80._register.l = hl&255;
        Z80._register.t = 8;
    }
}