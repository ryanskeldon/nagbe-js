MMU = {
    // Memory regions.
    _bios:  [], // Boot instructions
    _rom:   [], // Cartridge ROM
    _eram:  [], // External RAM
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
    
        let loadRom = new XMLHttpRequest();
        // loadRom.open('GET', '/roms/games/drmario.gb', true);        
        loadRom.open('GET', '/roms/games/mario.gb', true);        
        // loadRom.open('GET', '/roms/games/tetris.gb', true);
        // loadRom.open('GET', '/roms/games/zelda.gb', true);        
        // loadRom.open('GET', '/roms/games/Pokemon Blue.gb', true);
        // loadRom.open('GET', '/roms/mooneye/acceptance/add_sp_e_timing.gb', true);
        // loadRom.open('GET', '/roms/blargg/cpu_instrs.gb', true);
        loadRom.responseType = 'arraybuffer';         
        loadRom.onload = function(e) {
            let responseArray = new Uint8Array(this.response); 
        
            for (let i = 0; i < responseArray.length; i++)
                MMU._rom[i] = responseArray[i];

            // Load header info.
            let cartridgeType = MMU._rom[0x0147];
            switch (cartridgeType) {
                case 0:
                case 1: 
                case 2: 
                case 3:
                    MMU._mbcType = 1;
                    break;
                case 4:
                case 5:
                    MMU._mbcType = 2;
                    break;
                default:
                    throw `MMU: Unknown cartridge type: ${cartridgeType.toString(16).toUpperCase().padStart(2,"0")}`;
            }
            console.log(`MMU: Cart type: ${cartridgeType.toString(16).toUpperCase().padStart(2,"0")}`);
        };
         
        loadRom.send();
    },

    reset: function() {        
        MMU._biosEnabled = true; // Enabled BIOS boot code.
        
        for (var i = 0; i < 32768; i++) MMU._rom[i] = Math.floor(Math.random() * 256); // Reset cartridge ROM (32kB) 
        for (var i = 0; i < 8192; i++) MMU._wram[i] = Math.floor(Math.random() * 256);  // Reset Working RAM (8kB)       
        for (var i = 0; i < 128; i++) MMU._zram[i]  = Math.floor(Math.random() * 256);   // Reset Zero-page RAM (128B)
    },

    readByte: function (address) {
        if (address < 0x0000 || address > 0xFFFF)
            throw `Segfault read @ $${address.toString(16)}`;

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
            let offset = 0x4000 * MMU._romBank;
            return MMU._rom[(address-0x4000) + offset];
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

        if (address >= 0xC000 && address <= 0xDFFF) { 
            return MMU._wram[address & 0x1FFF];
        }

        if (address >= 0xE000 && address <= 0xFDFF) { 
            return MMU._wram[address & 0x1FFF];
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
            return MMU._zram[address & 0x7F];
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            return MMU._ie;
        }

        console.log(`Warning: Read attempt @ $${address.toString(16)} / instr: $${Z80.opCode.toString(16)}`);
        return 0xFF;
    },
    readWord: function (address) {
        // Read byte + next byte shifted by 1 byte.
        return (MMU.readByte(address+1)<<8) + MMU.readByte(address);
    },
    writeByte: function (address, byte) {            
        if (address < 0x0000 || address > 0xFFFF)
            throw `Segfault write @ $${address.toString(16)} / value: ${byte.toString(16)}`;            

        // ***** DEBUGGING *****
        if (byte > 255 || byte < 0) {
            console.log(`DEBUG: ins ${(Z80._register.pc-1).toString(16)} op: 0x${Z80.opCode.toString(16)} val: ${byte.toString(16)}`);            
            throw "Invalid byte range";
        }
        // *********************

        // ROM Banking
        if (address >= 0x0000 && address <= 0x7FFF) {
            if (address >= 0x2000 && address <= 0x3FFF) {
                if (MMU._mbcType == 1 || MMU._mbcType == 2) {
                    if (MMU._mbcType == 2) {
                        MMU._romBank = byte & 0x0F;
                        if (MMU._romBank == 0) MMU._romBank++;
                        return;
                    }

                    let lowerFive = byte&0x1F;
                    MMU._romBank &= 0xE0; // Turn off lower five bits.
                    MMU._romBank |= lowerFive; // Set lower five bits.
                    if (MMU._romBank == 0) MMU._romBank++;
                }
            }
            return;
        }

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            GPU.writeByte(address, byte);
            return;
        }

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            // TODO: Implement banking of external RAM?
            // TODO: Game saves
            MMU._eram[address & 0x1FFF] = byte;
            return;
        }

        // Working RAM and shadow RAM (?)
        if (address >= 0xC000 && address <= 0xDFFF) { 
            // TODO: Break this out into different arrays?
            MMU._wram[address & 0x1FFF] = byte;
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
            MMU._zram[address & 0x7F] = byte;
            return;
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            MMU._ie = byte;
            return;
        }

        console.log(`Warning: Write attempt @ $${address.toString(16)}`);
    },
    writeWord: function (address, word) {
        MMU.writeByte(address, word&255); // LSB
        MMU.writeByte(address+1, word>>8); // MSB        
    }
};

MMU.init();