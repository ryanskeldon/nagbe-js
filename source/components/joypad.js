Joypad = {
    _register: {
        _p1: 0 // 0xFF00 (r/w)
    },
    readByte: function (address) {
        switch (address) {
            case 0xFF00:
                return Joypad._register._p1;
        }
    },
    writeByte: function (address, byte) {
        switch (address) {
            case 0xFF00:
                Joypad._register._p1 = byte;
                return;
        }
    }
}