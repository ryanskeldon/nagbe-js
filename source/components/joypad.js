Joypad = {
    _register: {
        _p1: 0 // 0xFF00 (r/w)        
    },
    
    _keys: 0xFF,

    readByte: function (address) {
        switch (address) {
            case 0xFF00:
                if (Joypad._register._p1&0x10)
                    return 0xC0 + 0x10 + (Joypad._keys&0xF);
                if (Joypad._register._p1&0x20)
                    return 0xC0 + 0x20 + ((Joypad._keys>>4)&0xF);
        }
    },
    writeByte: function (address, byte) {
        switch (address) {
            case 0xFF00:
                if (byte == 0x10) {
                    Joypad._register._p1 &= ~0x20;
                    Joypad._register._p1 |= 0x10;
                    return;
                }
                
                if (byte == 0x20) {
                    Joypad._register._p1 &= ~0x10;
                    Joypad._register._p1 |= 0x20;
                    return;
                }
        }
    }
};