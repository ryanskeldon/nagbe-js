MMU = {
    // Memory regions.
    _bios: [], // Boot instructions
    _rom: [], // Cartridge ROM
    _vram: [], // TODO: Move to GPU
    _eram: [], // External RAM
    _wram: [], // Working RAM
    _zram: [], // Zero-page RAM
    _ioram: [], // I/O

    _biosEnabled: true,

    init: function() {
        MMU.reset();

        var loadBios = new XMLHttpRequest();
        loadBios.open('GET', '/bios.bin', true);
        loadBios.responseType = 'arraybuffer';         
        loadBios.onload = function(e) {
            var responseArray = new Uint8Array(this.response); 
        
            for (var i = 0; i < responseArray.length; i++)
                MMU._bios[i] = responseArray[i];
        };
         
        loadBios.send();
    
        var loadRom = new XMLHttpRequest();
        loadRom.open('GET', '/roms/tetris.gb', true);
        loadRom.responseType = 'arraybuffer';         
        loadRom.onload = function(e) {
            var responseArray = new Uint8Array(this.response); 
        
            for (var i = 0; i < responseArray.length; i++)
                MMU._rom[i] = responseArray[i];
        };
         
        loadRom.send();
    },

    reset: function() {        
        MMU._biosEnabled = true; // Enabled BIOS boot code.
        
        for (var i = 0; i < 32768; i++) MMU._rom[i] = 0; // Reset cartridge ROM (32kB) 
        for (var i = 0; i < 8192; i++) MMU._wram[i] = 0;  // Reset Working RAM (8kB)       
        for (var i = 0; i < 8192; i++) MMU._vram[i] = 0;  // Reset Video RAM (8kB)       
        for (var i = 0; i < 128; i++) MMU._zram[i] = 0;   // Reset Zero-page RAM (128B)
        for (var i = 0; i < 128; i++) MMU._ioram[i] = 0;   // Reset I/O RAM (128B)
    },

    readByte: function (address) {
        switch (address & 0xF000) {
            // ROM bank 0
            case 0x0000: 
                // BIOS only from 0x0000 to 0x00FF
                if (MMU._biosEnabled) {
                    if (address < 0x0100)
                        return MMU._bios[address];
                    else
                        return MMU._rom[address];                    
                } else {
                    return MMU._rom[address];
                }
            case 0x1000:
            case 0x2000:
            case 0x3000:
                return MMU._rom[address];

            // ROM bank 1
            case 0x4000:
            case 0x5000:
            case 0x6000:
            case 0x7000:
                return MMU._rom[address];

            // VRAM
            case 0x8000:
            case 0x9000:
                return MMU._vram[address & 0x1FFF];

            // External RAM            
            case 0xA000:
            case 0xB000:
                return MMU._eram[address & 0x1FFF]; // NOTE: Is this bankable?

            // Working RAM and shadow RAM.
            case 0xC000:
            case 0xD000:                
            case 0xE000:
                return MMU._wram[address & 0x1FFF];

            // The rest...
            case 0xF000:
                switch (address & 0x0F00) {
                    case 0x000:
                    case 0x100:
                    case 0x200:
                    case 0x300:
                    case 0x400:
                    case 0x500:
                    case 0x600:
                    case 0x700:
                    case 0x800:
                    case 0x900:
                    case 0xA00:
                    case 0xB00:
                    case 0xC00:
                    case 0xD00:
                    case 0xE00:
                        throw "Error: Reads not implemented at $0x" + address.toString(16);

                    case 0xF00:
                        if (address > 0xFF7F)
                            return MMU._zram[address & 0x7F];

                        // I/O ports
                        if (address >= 0xFF40 && address <= 0xFF4B)
                            return GPU.readByte(address);

                        throw "Error: Reads not implemented at $0x" + address.toString(16);

                        return MMU._ioram[address & 0x7F];

                        break;

                    default:
                        traceLog.write("MMU", "INVALID ADDRESS SPACE @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                }

            default:
                throw "Error: Unknown memory read @ 0x" + address.toString(16);
        }
    },
    readWord: function (address) {
        // Read byte + next byte shifted by 1 byte.
        return (MMU.readByte(address+1)<<8) + MMU.readByte(address);
    },
    writeByte: function (address, byte) {
        switch (address & 0xF000) {
            case 0x0000: 
            case 0x1000:
            case 0x2000:
            case 0x3000:
            case 0x4000:
            case 0x5000:
            case 0x6000:
            case 0x7000:
                traceLog.write("MMU", "Writing to ROM space @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                throw "Writes to $0x" + address.toString(16) + " not implemented.";
                break;

            // VRAM
            case 0x8000:
            case 0x9000:
                //traceLog.write("MMU", "Writing to gpu ram space @ $0x" + address.toString(16));
                MMU._vram[address & 0x1FFF] = byte;
                break;

            // External RAM
            case 0xA000:
            case 0xB000:
                traceLog.write("MMU", "Writing to external RAM @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                throw "Writes to $0x" + address.toString(16) + " not implemented.";
                break;

            // Working RAM
            case 0xC000:
            case 0xD000:
                traceLog.write("MMU", "Writing to working RAM @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                throw "Writes to $0x" + address.toString(16) + " not implemented.";
                break;

            case 0xE000:
            case 0xF000:
                switch (address & 0x0F00) {
                    case 0x000:
                    case 0x100:
                    case 0x200:
                    case 0x300:
                    case 0x400:
                    case 0x500:
                    case 0x600:
                    case 0x700:
                    case 0x800:
                    case 0x900:
                    case 0xA00:
                    case 0xB00:
                    case 0xC00:
                    case 0xD00:
                        traceLog.write("MMU", "Writing to working RAM (shadow) @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                        MMU._wram[address & 0x1FFF] = byte;
                        break;

                    case 0xE00:
                        if (address <= 0xFE9F) {
                            traceLog.write("MMU", "**DUMMY** Writing to Sprite Attribute Table (OAM) @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                            throw "Writes to $0x" + address.toString(16) + " not implemented.";
                        }
                        break;

                        // Nothing usable until 0xFF00.
                    case 0xF00:
                        if (address > 0xFF7F) { // Zero-page RAM aka the stack
                            traceLog.write("MMU", "Writing to stack @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                            MMU._zram[address & 0x7F] = byte;
                        } 
                        else if (address >= 0xFF40 && address <= 0xFF4B) {
                            // GPU registers
                            GPU.writeByte(address, byte);
                        }
                        else { // I/O ports                            
                            traceLog.write("MMU", "Writing to I/O ports @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                            MMU._ioram[address & 0x7F] = byte;

                            if (address === 0xFF50 && byte === 1) {
                                MMU._biosEnabled = false;
                            }
                        }
                        break;

                    default:
                        traceLog.write("MMU", "INVALID ADDRESS SPACE @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                }

                break; // TODO: Handle audio writes.

            default:
                // TODO: HALT execution, unknown memory address.
                throw "Error: Write byte failed. Address: $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16) + " / " + byte;
        }        
    },
    writeWord: function (address, word) {
        MMU.writeByte(address, word&255); // LSB
        MMU.writeByte(address+1, word>>8); // MSB        
    }
};