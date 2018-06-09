MMU = {
    // Memory regions.
    _bios: [], // Boot instructions
    _rom: [], // Cartridge ROM
    _eram: [], // External RAM
    _wram: [], // Working RAM
    _zram: [], // Zero-page RAM
    _ioram: [], // I/O

    // Registers
    _ie: 0, // Interrupt Enable (R/W)
    _if: 0, // Interrupt Flag (R/W)

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
        
        for (var i = 0; i < 32768; i++) MMU._rom[i] = Math.floor(Math.random() * 256); // Reset cartridge ROM (32kB) 
        for (var i = 0; i < 8192; i++) MMU._wram[i] = Math.floor(Math.random() * 256);  // Reset Working RAM (8kB)       
        for (var i = 0; i < 128; i++) MMU._zram[i]  = Math.floor(Math.random() * 256);   // Reset Zero-page RAM (128B)
        for (var i = 0; i < 128; i++) MMU._ioram[i] = Math.floor(Math.random() * 256);   // Reset I/O RAM (128B)
    },

    readByte: function (address) {
        // ROM Bank 0 & BIOS
        if (address >= 0x0000 && address <=0x3FFF) { 
            if (MMU._biosEnabled) {
                if (address < 0x0100)
                    return MMU._bios[address];
                else
                    return MMU._rom[address];                    
            } else {
                return MMU._rom[address];
            }
        }

        // ROM Bank 1 (Memory Bank Controlled)
        if (address >= 0x4000 && address <= 0x7FFF) { 
            // TODO: Implement MBC
            return MMU._rom[address];
        }

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            return GPU.readByte(address);
        }

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            // TODO: Implement banking of external RAM?
            return MMU._eram[address & 0x1FFF];
        }

        // Working RAM and shadow RAM (?)
        if (address >= 0xC000 && address <= 0xEFFF) { 
            // TODO: Break this out into different arrays?
            return MMU._wram[address & 0x1FFF];
        }

        // Sprite Attribute Table (OAM)
        if (address >= 0xFE00 && address <= 0xFE9F) { 
            // TODO: Implement this in the GPU.
            throw "Error: Reads not implemented at $0x" + address.toString(16);
        }

        // I/O Ports
        if (address >= 0xFF00 && address <= 0xFF7F) {
            // Interrupt Flag
            if (address === 0xFF0F) {
                return MMU._if;
            }

            if (address >= 0xFF40 && address <= 0xFF4B)
                return GPU.readByte(address);
        }

        // High RAM (stack)
        if (address >= 0xFF80 && address <= 0xFFFE) { 
            return MMU._zram[address & 0x7F];
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            return MMU._ie;
        }

        // Unhandled addresses should throw an exception.
        // They're either not implemented or out of addressable range.
        throw "Error: Unknown memory read @ 0x" + address.toString(16);
    },
    readWord: function (address) {
        // Read byte + next byte shifted by 1 byte.
        return (MMU.readByte(address+1)<<8) + MMU.readByte(address);
    },
    writeByte: function (address, byte) {
        // ROM Bank 0 & BIOS
        if (address >= 0x0000 && address <=0x3FFF) { 
            throw "Writes to $0x" + address.toString(16) + " not implemented.";
        }

        // ROM Bank 1 (Memory Bank Controlled)
        if (address >= 0x4000 && address <= 0x7FFF) { 
            throw "Writes to $0x" + address.toString(16) + " not implemented.";
        }

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            GPU.writeByte(address, byte);
            return;
        }

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            // TODO: Implement banking of external RAM?
            MMU._eram[address & 0x1FFF] = byte;
            return;
        }

        // Working RAM and shadow RAM (?)
        if (address >= 0xC000 && address <= 0xEFFF) { 
            // TODO: Break this out into different arrays?
            MMU._wram[address & 0x1FFF] = byte;
            return;
        }

        // Sprite Attribute Table (OAM)
        if (address >= 0xFE00 && address <= 0xFE9F) { 
            GPU.writeByte(address, byte);
            return;
        }

        // I/O Ports
        if (address >= 0xFF00 && address <= 0xFF7F) {
            // Interrupt Flag
            if (address === 0xFF0F) {
                MMU._if = byte;
                return;
            }

            // Audio
            if (address >= 0xFF10 && address <= 0xFF3F) {
                // TODO: Implement sound.
                MMU._ioram[address & 0x7F] = byte;
                return;
            }

            // Graphics
            if (address >= 0xFF40 && address <= 0xFF4B) {
                GPU.writeByte(address, byte);
                return;
            }

            if (address === 0xFF50 && byte === 1) {
                MMU._biosEnabled = false;
                return;
            }
        }

        // High RAM (stack)
        if (address >= 0xFF80 && address <= 0xFFFE) { 
            MMU._zram[address & 0x7F] = byte;
            return;
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            MMU._ie = byte;
            return;
        }

        throw "Writes to $0x" + address.toString(16) + " not implemented.";
    },
    writeWord: function (address, word) {
        MMU.writeByte(address, word&255); // LSB
        MMU.writeByte(address+1, word>>8); // MSB        
    }
};

MMU.init();