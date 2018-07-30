Cartridge = {
    _memory: {
        rom: [],
        ram: [],
        hasBattery: false,
        hasRam: false,
        ramIsDirty: false,        
        ramEnabled: false
    },

    _header: {
        title:          null, // 0x0134 -> 0x0142
        isColorGB:      null, // 0x0143 Note: Color GB = 0x80, anything else is not Color GB.
        isSuperGameboy: null, // 0x0146 Note: GB = 0x00, SGB = 0x03
        cartridgeType:  null, // 0x0147
        romSize:        null, // 0x0148
        ramSize:        null, // 0x0149
    },
    
    _mbc: {
        type: 0,
        romBank: 1,
        totalRomBanks: 1,
        ramBank: 0,
        totalRamBanks: 0,
        mode: 0
    },

    _rtc: {
        exists: false,
        mapped: false, // Values: false or byte of register below.
        latched: false,
        seconds: 0,   // 0x08
        minutes: 0,   // 0x09
        hours: 0,     // 0x0A
        days_low: 0,  // 0x0B
        days_high: 0, // 0x0C
    },

    init: function () {
        // Check if a ROM was previously loaded.
        var file = localStorage.getItem('rom');

        if (file) { // Transform stored data into number array.
            file = file.split(",");
            let rom = file.map(value => { return parseInt(value); });
            this.load(rom);
        }
    },

    load: function (file) {
        this._memory.rom = file;

        // Read ROM title.
        let romTitle = "";
        for (let i = 0x134; i <= 0x142; i++){
            if (this._memory.rom[i] === 0x00) continue;            
            romTitle += String.fromCharCode(this._memory.rom[i]);
        }
        this._header.title = romTitle;
        document.getElementById("romName").innerText = romTitle;

        // Read cartridge type.
        this._header.cartridgeType = this._memory.rom[0x0147];
        switch (this._header.cartridgeType) {
            case 0x00: break; // ROM Only
            case 0x01: this._mbc.type = 1; break;
            case 0x02: this._mbc.type = 1; this._memory.hasRam = true; break;
            case 0x03: this._mbc.type = 1; this._memory.hasRam = true; this._memory.hasBattery = true; break;
            // case 0x05: this._mbc.type = 2; break;
            // case 0x06: this._mbc.type = 2; this._memory.hasBattery = true; break;
            // case 0x08: break;
            // case 0x09: this._memory.hasBattery = true; break;
            // case 0x0B: break;
            // case 0x0C: break;            
            // case 0x0D: this._memory.hasBattery = true; break;
            case 0x0F: this._mbc.type = 3; this._memory.hasBattery = true; break;            
            case 0x10: this._mbc.type = 3; this._memory.hasBattery = true; break;
            case 0x11: this._mbc.type = 3; break;
            case 0x12: this._mbc.type = 3; break;
            case 0x13: this._mbc.type = 3; this._memory.hasRam = true; this._rtc.exists = true; this._memory.hasBattery = true; break;
            // case 0x19: this._mbc.type = 5; break;
            // case 0x1A: this._mbc.type = 5; break;
            // case 0x1B: this._mbc.type = 5; this._memory.hasBattery = true; break;
            // case 0x1C: this._mbc.type = 5; break;
            // case 0x1D: this._mbc.type = 5; break;
            // case 0x1E: this._mbc.type = 5; this._memory.hasBattery = true; break;
            // case 0x20: this._mbc.type = 6; break;
            // case 0x22: this._mbc.type = 7; this._memory.hasBattery = true; break;
            // case 0xFC: break;
            // case 0xFD: break;
            // case 0xFE: break;
            // case 0xFF: this._memory.hasBattery = true; break;            
            default:
                throw `Cartridge: Unsupported cartridge type: ${this._header.cartridgeType.toHex(2)}`;
        }

        // Read ColorGB value.
        this._header.isColorGB = this._memory.rom[0x0143] == 0x80;

        // Read SuperGameboy value.        
        this._header.isSuperGameboy = this._memory.rom[0x0146] == 0x03;

        // Read ROM size.
        this._header.romSize = this._memory.rom[0x0148];

        switch (this._header.romSize) {
            case 0x00: this._mbc.totalRomBanks = 1; break;
            case 0x01: this._mbc.totalRomBanks = 4; break;
            case 0x02: this._mbc.totalRomBanks = 8; break;
            case 0x03: this._mbc.totalRomBanks = 16; break;
            case 0x04: this._mbc.totalRomBanks = 32; break;
            case 0x05: this._mbc.totalRomBanks = 64; break;
            case 0x06: this._mbc.totalRomBanks = 128; break;
            case 0x07: this._mbc.totalRomBanks = 256; break;
            case 0x08: this._mbc.totalRomBanks = 512; break;
            case 0x52: this._mbc.totalRomBanks = 72; break;
            case 0x53: this._mbc.totalRomBanks = 80; break;
            case 0x54: this._mbc.totalRomBanks = 96; break;
        }

        // Read RAM size.
        this._header.ramSize = this._memory.rom[0x0149];

        // Initialize RAM space.
        let ramSize = 0;
        switch (this._header.ramSize) {
            case 0x00: ramSize = 0; break;
            case 0x01: ramSize = 2048; break;
            case 0x02: ramSize = 8192; break;
            case 0x03: ramSize = 32768; break;
            case 0x04: ramSize = 131072; break;
            case 0x05: ramSize = 65536; break;
        }

        if (ramSize > 0) {
            for (let i = 0; i < ramSize; i++) {
                this._memory.ram[i] = Math.floor(Math.random() * 256);
            }
        }
        
        // Save ROM data to local storage.
        localStorage.setItem("rom", file);

        // Load "battery-backed" RAM for storage.
        if (this._memory.hasBattery) {
            let ram = localStorage.getItem(this._header.title); // TODO: Use header checksum instead of title.

            if (ram) {
                console.log(`Cart: ram found`);
                ram = ram.split(",");
                this._memory.ram = ram.map(value => { return parseInt(value); });
            }
        }

        // Dump header info.
        console.log(this._header);
    },

    readByte: function (address) {
        // Redirect reads to MBC.
        switch (this._mbc.type) {
            case 0x00:
                // ROM Only
                if (address >= 0x0000 && address <= 0x7FFF) return this._memory.rom[address];                
                throw `Cartridge: Unsupported read at $${address.toHex(4)}.`;
            case 0x01: return this.MBC1_readByte(address);
            case 0x02: return this.MBC1_readByte(address);
            case 0x03: return this.MBC1_readByte(address);
            case 0x13: return this.MBC3_readByte(address);
            default:
                throw `Cartridge: Unsupported MBC type: ${this._mbc.type.toHex(2)}`;
        }        
    },

    writeByte: function (address, byte) {
        // Redirect writes to MBC.
        switch (this._mbc.type) {
            case 0x00: 
                if (address >= 0x0000 && address <= 0x7FFF) return; // ROM only
            case 0x01: this.MBC1_writeByte(address, byte); return;
            case 0x02: this.MBC1_writeByte(address, byte); return;
            case 0x03: this.MBC1_writeByte(address, byte); return;
            case 0x0F: this.MBC3_writeByte(address, byte); return;
            case 0x10: this.MBC3_writeByte(address, byte); return;
            case 0x11: this.MBC3_writeByte(address, byte); return;
            case 0x12: this.MBC3_writeByte(address, byte); return;
            case 0x13: this.MBC3_writeByte(address, byte); return;
            default:
                throw `Cartridge: Unsupported MBC type: ${this._mbc.type.toHex(2)}`;
        }
    },

    // Memory Bank Controller Type 1
    MBC1_readByte: function (address) {
        // ROM Bank 0
        if (address >= 0x0000 && address <= 0x3FFF) {
            return this._memory.rom[address];
        }

        // ROM Bank 1 (Memory Bank Controlled)
        if (address >= 0x4000 && address <= 0x7FFF) {
            let offset = 0x4000 * this._mbc.romBank;
            return this._memory.rom[(address-0x4000)+offset];
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            let offset = 0x2000 * this._mbc.ramBank;
            return this._memory.ram[(address-0xA000)+offset];
        }
    },
    MBC1_writeByte: function (address, byte) {
        // RAM Enable
        if (address >= 0x0000 && address <= 0x1FFF) {
            this._memory.ramEnabled = byte === 0x0A;
            return;
        }

        // ROM Banking
        if (address >= 0x2000 && address <= 0x3FFF) {
            let romBank = byte & 0x1F; // Mask for lower 5 bits.
            this._mbc.romBank &= 0xE0; // Turn off lower 5 bits.
            this._mbc.romBank |= romBank; // Set lower 5 bits.
            if (this._mbc.romBank === 0) this._mbc.romBank++;            

            if (this._mbc.romBank > this._mbc.totalRomBanks)
                throw `Invalid ROM bank selected: ${this._mbc.romBank}`;
            return;
        }

        // RAM Banking
        if (address >= 0x4000 && address <= 0x5FFF) {
            if (this._mbc.mode === 0) { // ROM Banking
                let romBank = (byte<<6);
                this._mbc.romBank = romBank + (this._mbc.romBank&0x1F);
            } else if (this._mbc.mode === 1) { // RAM Banking
                this._mbc.ramBank = byte & 0x03;
            }
            return;
        }

        // ROM/RAM Mode Select
        if (address >= 0x6000 && address <= 0x7FFF) {
            this._mbc.mode = byte & 0x01;
            return;
        }

        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this._memory.ramEnabled) return; // RAM disabled.

            // Mark for persistance at the end of the next frame.
            if (this._memory.hasBattery) this._memory.ramIsDirty = true;

            if (this._mbc.mode === 0) { // ROM mode, only write to bank 0x00 of RAM.
                this._memory.ram[address-0xA000] = byte;
                return;    
            }

            let offset = this._memory.ramBank * 0x2000;
            this._memory.ram[(address-0xA000)+offset] = byte;

            return;
        }
    },

    // Memory Bank Controller Type 3
    MBC3_readByte: function (address) {
        // ROM Bank 0
        if (address >= 0x0000 && address <= 0x3FFF) {
            return this._memory.rom[address];
        }

        // ROM Bank 1 (Memory Bank Controlled)
        if (address >= 0x4000 && address <= 0x7FFF) {
            let offset = 0x4000 * this._mbc.romBank;
            return this._memory.rom[(address-0x4000)+offset];
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            // RTC registers
            if (this._rtc.mapped !== false) {
                // Return RTC register.
                switch (this._rtc.mapped) {
                    case 0x08: return this._rtc.seconds;
                    case 0x09: return this._rtc.minutes;
                    case 0x0A: return this._rtc.hours;
                    case 0x0B: return this._rtc.days_low;
                    case 0x0C: return this._rtc.days_high;
                }
            }

            // RAM
            let offset = 0x2000 * this._mbc.ramBank;
            return this._memory.ram[(address-0xA000)+offset];
        }
    },
    MBC3_writeByte: function (address, byte) {
        // RAM & RTC Enable
        if (address >= 0x0000 && address <= 0x1FFF) {
            console.log("RAM/RTC enabled " + byte);
            this._memory.ramEnabled = byte === 0x0A;
            return;
        }

        // ROM Banking
        if (address >= 0x2000 && address <= 0x3FFF) {
            let romBank = byte & 0x7F; // Mask for lower 7 bits.
            this._mbc.romBank &= 0x80; // Turn off lower 7 bits.
            this._mbc.romBank |= romBank; // Set lower 7 bits.
            if (this._mbc.romBank === 0) this._mbc.romBank++;

            if (this._mbc.romBank > this._mbc.totalRomBanks)
                throw `Invalid ROM bank selected: ${this._mbc.romBank}`;
            return;
        }

        // RAM & RTC Banking
        if (address >= 0x4000 && address <= 0x5FFF) {
            if (byte >= 0x00 && byte <= 0x03) { // RAM bank select
                this._rtc.mapped = false;
                let romBank = byte;
                this._mbc.romBank = romBank;
                return;
            }

            if (byte >= 0x08 && byte <= 0x0C) {
                console.log("RTC mapped " + byte);
                this._rtc.mapped = byte;
                return;
            }
        }

        // RTC Latching
        if (address >= 0x6000 && address <= 0x7FFF) {
            console.log("RTC latched " + byte);
            this._rtc.latched = byte === 0x01; // TODO: Is this right?
            return;
        }

        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this._memory.ramEnabled) return; // RAM disabled.

            // RTC registers
            if (this._rtc.mapped !== false) {
                // Return RTC register.
                switch (this._rtc.mapped) {
                    case 0x08: this._rtc.seconds = byte; return;
                    case 0x09: this._rtc.minutes = byte; return;
                    case 0x0A: this._rtc.hours = byte; return;
                    case 0x0B: this._rtc.days_low = byte; return;
                    case 0x0C: this._rtc.days_high = byte; return;
                }
            }

            // Mark for persistance at the end of the next frame.
            if (this._memory.hasBattery) this._memory.ramIsDirty = true;

            let offset = this._memory.ramBank * 0x2000;
            this._memory.ram[(address-0xA000)+offset] = byte;

            return;
        }
    }
}

Cartridge.init();