MMU = {
    // Memory regions.
    _bios:  [], // Boot instructions
    _wram:  [], // Working RAM
    _zram:  [], // Zero-page RAM

    // Registers
    _ie: 0, // Interrupt Enable (R/W)
    _if: 0, // Interrupt Flag (R/W)

    _biosEnabled: true,
    
    // Memory Bank Controller    
    _mbcType: 0,
    _romBank: 1,

    init: function() {
        MMU.reset();

        let loadBios = new XMLHttpRequest();
        loadBios.open('GET', '/bios.bin', true);
        loadBios.responseType = 'arraybuffer';         
        loadBios.onload = function(e) {
            let responseArray = new Uint8Array(this.response); 
        
            for (let i = 0; i < responseArray.length; i++)
                MMU._bios[i] = responseArray[i];
        };
         
        loadBios.send();
    },

    reset: function() {        
        MMU._biosEnabled = true; // Enabled BIOS boot code.
        
        for (var i = 0; i < 8192; i++) MMU._wram[i] = Math.floor(Math.random() * 256);  // Reset Working RAM (8kB)       
        for (var i = 0; i < 128; i++) MMU._zram[i]  = Math.floor(Math.random() * 256);   // Reset Zero-page RAM (128B)
    },

    readByte: function (address) {
        if (address < 0x0000 || address > 0xFFFF)
            throw `Segfault read @ $${address.toHex(4)}`;

        // ROM Bank 0 & BIOS
        if (address >= 0x0000 && address <=0x3FFF) { 
            if (MMU._biosEnabled) {
                if (address < 0x0100)
                    return MMU._bios[address];
                else
                    return Cartridge.readByte(address);
            } else {
                return Cartridge.readByte(address);
            }
        }

        // ROM Bank 1 (Memory Bank Controlled)
        if (address >= 0x4000 && address <= 0x7FFF) { 
            return Cartridge.readByte(address);
        }

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            return GPU.readByte(address);
        }

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF) {            
            return Cartridge.readByte(address);
        }

        if (address >= 0xC000 && address <= 0xDFFF) { 
            return MMU._wram[address - 0xC000];
        }

        if (address >= 0xE000 && address <= 0xFDFF) { 
            return MMU._wram[address - 0xE000];
        }

        // Sprite Attribute Table (OAM)
        if (address >= 0xFE00 && address <= 0xFE9F) { 
            return GPU.readByte(address);
        }

        // I/O Ports
        if (address >= 0xFF00 && address <= 0xFF7F) {
            // Joypad
            if (address == 0xFF00) {
                return Joypad.readByte(address);
            }

            // Serial
            if (address >= 0xFF01 && address <= 0xFF02) {
                return Serial.readByte(address);
            }

            // Timer
            if (address >= 0xFF04 && address <= 0xFF07) {
                return Timer.readByte(address);
            }

            // Interrupt Flag
            if (address === 0xFF0F) {
                return MMU._if|0xE0;
            }

            // GPU
            if (address >= 0xFF40 && address <= 0xFF4B)
                return GPU.readByte(address);
        }

        // High RAM (stack)
        if (address >= 0xFF80 && address <= 0xFFFE) { 
            return MMU._zram[address - 0xFF80];
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            return MMU._ie;
        }

        console.log(`Warning: Read attempt @ $${address.toHex(4)} / instr: $${Z80.opCode.toHex(2)}`);
        return 0xFF;
    },
    readWord: function (address) {
        // Read byte + next byte shifted by 1 byte.
        return (MMU.readByte(address+1)<<8) + MMU.readByte(address);
    },
    writeByte: function (address, byte) {            
        if (address < 0x0000 || address > 0xFFFF)
            throw `Segfault write @ $${address.toHex(4)} / value: ${byte.toHex(2)}`;

        // ***** DEBUGGING *****
        if (byte > 255 || byte < 0) {
            console.log(`DEBUG: ins ${(Z80._register.pc-1).toString(16)} op: 0x${Z80.opCode.toString(16)} val: ${byte.toString(16)}`);            
            throw "Invalid byte range";
        }
        // *********************

        // ROM Banking
        if (address >= 0x0000 && address <= 0x7FFF) {
            Cartridge.writeByte(address, byte);
            return;
        }

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            GPU.writeByte(address, byte);
            return;
        }

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            Cartridge.writeByte(address, byte);
            return;
        }

        // Working RAM
        if (address >= 0xC000 && address <= 0xDFFF) {             
            MMU._wram[address - 0xC000] = byte;
            return;
        }

        if (address >= 0xE000 && address <= 0xFDFF) { 
            MMU._wram[address - 0xE000] = byte;
            return;
        }

        // Unusable space
        if (address >= 0xFEA0 && address <= 0xFEFF) {
            return;
        }

        // Sprite Attribute Table (OAM)
        if (address >= 0xFE00 && address <= 0xFE9F) { 
            GPU.writeByte(address, byte);
            return;
        }

        // I/O Ports
        if (address >= 0xFF00 && address <= 0xFF7F) {
            // Joypad
            if (address == 0xFF00) {
                Joypad.writeByte(address, byte);
                return;
            }

            // Serial
            if (address >= 0xFF01 && address <= 0xFF02) {
                // TODO: Implement serial.
                Serial.writeByte(address, byte);
                return;
            }

            // Timers
            if (address >= 0xFF04 && address <= 0xFF07) {
                Timer.writeByte(address, byte);
                return;
            }

            // Interrupt Flag
            if (address === 0xFF0F) {
                MMU._if = byte;
                return;
            }

            // Audio
            if (address >= 0xFF10 && address <= 0xFF3F) {
                // TODO: Implement sound?                
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

        // Zero-page RAM
        if (address >= 0xFF80 && address <= 0xFFFE) { 
            MMU._zram[address - 0xFF80] = byte;
            return;
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            MMU._ie = byte;
            return;
        }

        console.log(`Warning: Write attempt @ $${address.toHex(4)} value: ${byte.toHex(2)}`);
    },
    writeWord: function (address, word) {
        MMU.writeByte(address, word&255); // LSB
        MMU.writeByte(address+1, word>>8); // MSB        
    }
};

MMU.init();