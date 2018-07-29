Joypad = {
    _register: {
        _p1: 0 // 0xFF00 (r/w)        
    },
    
    _keys: 0xFF,

    readByte: function (address) {
        switch (address) {
            case 0xFF00:                
                if (Joypad._register._p1 == 0x10)
                    return (Joypad._keys>>4)&0xF;
                if (Joypad._register._p1 == 0x20)
                    return Joypad._keys&0x0F;
                default:
                    return 0;
        }
    },
    writeByte: function (address, byte) {
        switch (address) {
            case 0xFF00:
                Joypad._register._p1 = byte & 0x30;
        }
    },

    button_press: function (id) {
        Joypad._keys &= ~(1<<id);
        Z80.requestInterrupt(4);
    },

    button_release: function (id) {
        Joypad._keys |= (1<<id);
    },
};