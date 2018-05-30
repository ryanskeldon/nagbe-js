MMU = {
    // Memory regions.
    _bios: [],
    _rom: [],
    _eram: [],
    _wram: [],
    _zram: [],
    _vram: [],
    _ie: 0,

    _inBios: true,

    init: function() {
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
        // Move back into BIOS.
        MMU._inBios = true;

        // Zero ROM space.
        for (var i = 0; i < 0x8000; i++) MMU._rom[i] = 0;

        // Zero Working RAM (8kB).
        for (var i = 0; i < 8192; i++) MMU._wram[i] = 0;

        // Zero Video RAM (8kB).
        for (var i = 0; i < 8192; i++) MMU._vram[i] = 0;

        // Zero Zero-page RAM (128B).
        for (var i = 0; i < 128; i++) MMU._zram[i] = 0;
    },

    readByte: function (address) {
        switch (address & 0xF000) {
            // ROM bank 0
            case 0x0000: 
                // BIOS only from 0x0000 to 0x00FF
                if (MMU._inBios) {
                    if (address < 0x0100)
                        return MMU._bios[address];
                    else if (Z80._register.pc === 0x0100) {
                        log.write("MMU", "Leaving BIOS");
                        MMU._inBios = false;
                    } else {
                        return MMU._rom[address];
                    }
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
                return MMU._eram[address & 0x1FFF];

            // Working RAM and shadow RAM.
            case 0xC000:
            case 0xD000:                
            case 0xE000:
                return MMU._wram[address & 0x1FFF];

            // The rest...
            case 0xF000:
                

            default:
                // TODO: HALT execution, unknown memory address.
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
                log.write("MMU", "Writing to ROM space @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                break;

            // VRAM
            case 0x8000:
            case 0x9000:
                //log.write("MMU", "Writing to gpu ram space @ $0x" + address.toString(16));
                MMU._vram[address & 0x1FFF] = byte;
                break;

            // External RAM
            case 0xA000:
            case 0xB000:
                log.write("MMU", "Writing to external RAM @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                break;

            // Working RAM
            case 0xC000:
            case 0xD000:
                log.write("MMU", "Writing to working RAM @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
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
                        log.write("MMU", "Writing to working RAM (shadow) @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                        MMU._wram[address & 0x1FFF] = byte;
                        break;

                    case 0xE00:
                        if (address <= 0xFE9F) {
                            // TODO: Add this.
                            log.write("MMU", "Writing to Sprite Attribute Table (OAM) @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                        }
                        break;

                        // Nothing usable until 0xFF00.
                    case 0xF00:
                        if (address <= 0xFF7F) {
                            // I/O ports
                            log.write("MMU", "Writing to I/O ports @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                        } else if (address > 0xFF7F && address < 0xFFFF) {
                            log.write("MMU", "Writing to stack @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                        } else if (address === 0xFFFF) {
                            log.write("MMU", "Writing to IE @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
                            MMU._ie = byte;
                        }
                        break;

                    default:
                        log.write("MMU", "INVALID ADDRESS SPACE @ $0x" + address.toString(16) + "\tValue: 0x" + byte.toString(16));
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