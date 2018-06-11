Timer = {
    _register: {
        _div: 0, // 0xFF04 (r/w) Divider
        _tima: 0, // 0xFF05 (r/w) Timer counter
        _tma: 0, // 0xFF06 (r/w) Timer modulo
        _tac: 0, // 0xFF07 (r/w) Timer control
    },

    readByte: function (address) {
        switch (address) {
            case 0xFF04:
                return Timer._register._div;
            case 0xFF05:
                return Timer._register._tima;
            case 0xFF06:
                return Timer._register._tma;
            case 0xFF07:
                return Timer._register._tac;                
        }
    },

    writeByte: function (address, byte) {
        switch (address) {
            case 0xFF04:
                Timer._register._div = byte;
                return;
            case 0xFF05:
                Timer._register._tima = byte;
                return;
            case 0xFF06:
                Timer._register._tma = byte;
                return;
            case 0xFF07:
                Timer._register._tac = byte;
                return;
        }
    },

    update: function () {
        
    }
};