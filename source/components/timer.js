Timer = {
    _clockSpeed: 4194304,
    _frequency: 4096,
    _counter: 0,
    _divider: 0,

    _register: {
        div: 0, // 0xFF04 (r/w) Divider
        tima: 0, // 0xFF05 (r/w) Timer counter
        tma: 0, // 0xFF06 (r/w) Timer modulo
        tac: 0, // 0xFF07 (r/w) Timer control
    },

    init: function () {

    },

    readByte: function (address) {
        switch (address) {
            case 0xFF04:
                return Timer._register.div>>8;
            case 0xFF05:
                return Timer._register.tima;
            case 0xFF06:
                return Timer._register.tma;
            case 0xFF07:
                return Timer._register.tac|0xF8;                
        }
    },

    writeByte: function (address, byte) {
        switch (address) {
            case 0xFF04:
                Timer._register.div = 0;
                Timer._divider = 0;
                return;
            case 0xFF05:
                Timer._register.tima = byte;
                return;
            case 0xFF06:
                Timer._register.tma = byte;
                return;
            case 0xFF07:
                Timer.updateFrequency(byte);
                return;
        }
    },

    isClockEnabled: function () {
        return !!(Timer._register.tac&0x04);
    },

    updateFrequency: function (data) {
        let currentFrequency = Timer._register.tac&0x03;
        Timer._register.tac = data;
        let newFrequency = Timer._register.tac&0x03;

        if (currentFrequency != newFrequency) {
            switch (newFrequency) {
                case 0: Timer._frequency = 1024; break;
                case 1: Timer._frequency = 16; break;
                case 2: Timer._frequency = 64; break;
                case 3: Timer._frequency = 256; break;
            }
        }
    },

    update: function () {
        Timer._register.div += Z80._register.t;
        Timer._register.div &= 0xFFFF;

        if (!Timer.isClockEnabled()) return;

        Timer._counter += Z80._register.t;
        let interval = Timer._clockSpeed / Timer._frequency;

        if (Timer._counter >= interval) {
            Timer._counter -= interval;

            // Did timer overflow?
            if (Timer._register.tima == 0xFF) {
                Timer._register.tima = Timer._register.tma;
                // TODO: Only interrupt if requested.
                Z80.requestInterrupt(2);
            } else {
                Timer._register.tima++;
            }
        }
    }
};

Timer.init();