export default class Serial {
    constructor(system) {
        this.system = system;

        this.register = {
            sb: 0, // 0xFF01 (r/w) Serial transfer data
            sc: 0 // 0xFF02 (r/w) Serial I/O control
        };
    }

    readByte(address) {
        switch (address) {
            case 0xFF01: return this.register.sb;
            case 0xFF02: return this.register.sc;
        }
    }

    writeByte(address, byte) {
        switch (address) {
            case 0xFF01: 
                this.register.sb = byte;
                let output = document.getElementById("serialOut").value;
                output = output + String.fromCharCode(byte);
                document.getElementById("serialOut").value = output;
                break;
            case 0xFF02: 
                this.register.sc = byte; 
                break;
        }
    }
}