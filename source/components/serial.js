Serial = {
    _register: {
        _SB: 0, // 0xFF01 (r/w) Serial transfer data
        _SC: 0 // 0xFF02 (r/w) Serial I/O control
    },

    readByte: function (address) {
        switch (address) {
            case 0xFF01: return Serial._register._SB;
            case 0xFF02: return Serial._register._SC;
        }
    },
    writeByte: function (address, byte) {
        switch (address) {
            case 0xFF01: 
                Serial._register._SB = byte;
                let output = document.getElementById("serialOut").value;
                output = output + String.fromCharCode(byte);
                document.getElementById("serialOut").value = output;
                break;
            case 0xFF02: Serial._register._SC = byte; break;
        }
    }
};