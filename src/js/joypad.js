export default class Joypad {
    constructor(system) {
        this.system = system;

        this.register = {
            p1: 0 // $FF00 P1
        };

        this.keys = 0xFF;
    }

    readByte(address) {
        switch (address) {
            case 0xFF00:                
                if (this.register.p1 == 0x10)
                    return (this.keys>>4)&0xF;
                if (this.register.p1 == 0x20)
                    return this.keys&0x0F;
                default:
                    return 0;
        }
    }

    writeByte(address, byte) {
        switch (address) {
            case 0xFF00:
                this.register.p1 = byte&0x30;
        }
    }

    buttonPressed(id) {
        this.keys &= ~(1<<id);
        this.system.requestInterrupt(4);        
    }

    buttonReleased(id) {
        this.keys |= (1<<id);
    }
}