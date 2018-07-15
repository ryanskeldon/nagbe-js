Cartridge = {
    _memory: {
        rom: [],
        ram: [],
        hasBattery: false,
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
        cartType: 0,
        romBank: 1,
        ramBank: 1,
        mode: 0
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
            case 0x01: this._mbc.cartType = 1; break;
            case 0x02: this._mbc.cartType = 1; break;
            case 0x03: this._mbc.cartType = 1; this._memory.hasBattery = true; break;
            // case 0x05: this._mbc.cartType = 2; break;
            // case 0x06: this._mbc.cartType = 2; this._memory.hasBattery = true; break;
            // case 0x08: break;
            // case 0x09: this._memory.hasBattery = true; break;
            // case 0x0B: break;
            // case 0x0C: break;            
            // case 0x0D: this._memory.hasBattery = true; break;
            // case 0x0F: this._mbc.cartType = 3; this._memory.hasBattery = true; break;            
            // case 0x10: this._mbc.cartType = 3; this._memory.hasBattery = true; break;
            // case 0x11: this._mbc.cartType = 3; break;
            // case 0x12: this._mbc.cartType = 3; break;
            // case 0x13: this._mbc.cartType = 3; this._memory.hasBattery = true; break;
            // case 0x19: this._mbc.cartType = 5; break;
            // case 0x1A: this._mbc.cartType = 5; break;
            // case 0x1B: this._mbc.cartType = 5; this._memory.hasBattery = true; break;
            // case 0x1C: this._mbc.cartType = 5; break;
            // case 0x1D: this._mbc.cartType = 5; break;
            // case 0x1E: this._mbc.cartType = 5; this._memory.hasBattery = true; break;
            // case 0x20: this._mbc.cartType = 6; break;
            // case 0x22: this._mbc.cartType = 7; this._memory.hasBattery = true; break;
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

        // Read RAM size.
        this._header.ramSize = this._memory.rom[0x0149];

        // Initialize RAM space.
        let ramSize = 0;
        switch (this._header.ramSize) {
            case 0x01: ramSize = 2000; break;
            case 0x02: ramSize = 8000; break;
            case 0x03: ramSize = 32000; break;
            case 0x04: ramSize = 128000; break;
            case 0x05: ramSize = 64000; break;
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
            let ram = localStorage.getItem(this._header.title);

            if (ram) {
                ram = ram.split(",");
                this._memory.ram = file.map(value => { return parseInt(value); });
            }
        }        

        // Dump header info.
        console.log(this._header);
    },

    readByte: function (address) {
        // Redirect reads to MBC.
        switch (this._mbc.cartType) {
            case 0x00:
                // ROM Only
                if (address >= 0x0000 && address <= 0x7FFF) return this._memory.rom[address];
                throw `Cartridge: Unsupported read at $${address.toHex(4)}.`;
            case 0x01:
                return this.MBC1_readByte(address);
            default:
                throw `Cartridge: Unsupport MBC type: ${this._mbc.cartType.toHex(2)}`;
        }        
    },

    writeByte: function (address, byte) {
        // Redirect writes to MBC.
        switch (this._mbc.cartType) {
            case 0x00:
                // ROM Only
                if (address >= 0x0000 && address <= 0x7FFF) return; // Do nothing.
            case 0x01:
                this.MBC1_writeByte(address, byte); 
                return;
            default:
                throw `Cartridge: Unsupport MBC type: ${this._mbc.cartType.toHex(2)}`;
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
            return this._memory.ram[((address-0x2000)+offset)&0x1FFF];
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

            if (this._mbc.mode === 0) { // ROM mode, only write to bank 0x00 of RAM.
                this._memory.ram[address & 0x1FFF] = byte;
                return;    
            }

            let offset = this._memory.ramBank * 0x2000;
            this._memory.ram[(address&0x1FFF)+offset] = byte;

            // Mark for persistance at the end of the next frame.
            if (this._memory.hasBattery) this._memory.ramIsDirty = true;
            return;
        }
    }
}

Cartridge.init();