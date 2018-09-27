ALU = {
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