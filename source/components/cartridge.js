class Cartridge {
    /* Header 
        $0134->$0142 Cartridge title.
        $0143 Color GB flag. A value of 0x80 means GBC, anything else is not GBC.
        $0144->$0145 New Licensee Code.
        $0146 Super GB flag. A value of 0x03 means SGB, anything else is not SGB.
        $0147 Cartridge type
        $0148 ROM size
        $0149 RAM size
        $014A Destination Code
        $014B Old Licensee Code
        $014C Mask ROM Version Number
        $014D Header Checksum
        $014E->$014F Global Checksum
    */
    constructor(rom) {
        // Save raw ROM bytes.
        this.rom = rom;        

        // Read ROM title.
        this.title = "";
        for (let i = 0x134; i <= 0x142; i++){
            if (this.rom[i] === 0x00) continue;            
            this.title += String.fromCharCode(this.rom[i]);
        }        

        // Read Color GB flag.
        this.colorGameboyFlag = this.rom[0x0143] == 0x80; // TODO: Should this worry about GBC only flag?

        // Read Super GB flag.
        this.superGameboyFlag = this.rom[0x0146] == 0x03;

        // Read cartridge type, determine memory bank controller and other cartridge properties.
        this.cartridgeType = this.rom[0x0147];
        this.mbc = null;
        this.hasRam = false;
        this.hasBattery = false;
        switch (this.cartridgeType) {
            case 0x00: break;
            case 0x01: this.mbc = new MBC1(this); break;
            case 0x02: this.mbc = new MBC1(this); this.hasRam = true; break;
            case 0x03: this.mbc = new MBC1(this); this.hasRam = true; this.hasBattery = true; break;
            // case 0x05: this.mbc = new MBC2(this); break;
            // case 0x06: this.mbc = new MBC2(this); this.hasBattery = true; break;
            // case 0x08: break;
            // case 0x09: this.hasBattery = true; break;
            // case 0x0B: break; // MMM01
            // case 0x0C: break; // MMM01+RAM
            // case 0x0D: break; // MMM01+RAM+BATTERY
            // case 0x0F: this.mbc = new MBC3(this); this.hasBattery = true; break;
            // case 0x10: this.mbc = new MBC3(this); this.hasBattery = true; break;
            // case 0x11: this.mbc = new MBC3(this); break;
            // case 0x12: this.mbc = new MBC3(this); this.hasRam = true; break;
            // case 0x13: this.mbc = new MBC3(this); this.hasRam = true; this.rtcExists = true; this.hasBattery = true; break;
            // case 0x19: this._mbc.type = 5; break;
            // case 0x1A: this._mbc.type = 5; break;
            // case 0x1B: this.mbc = new MBC5(this); this.hasRam = true; this.hasBattery = true; break;
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
                throw `Cartridge: Unsupported cartridge type: ${this.cartridgeType.toHex(2)}`;
        }

        // Read ROM size.
        this.romSize = this.rom[0x0148];

        // Determine total ROM banks.
        switch (this.romSize) {
            case 0x00: this.totalRomBanks = 1; break;
            case 0x01: this.totalRomBanks = 4; break;
            case 0x02: this.totalRomBanks = 8; break;
            case 0x03: this.totalRomBanks = 16; break;
            case 0x04: this.totalRomBanks = 32; break;
            case 0x05: this.totalRomBanks = 64; break;
            case 0x06: this.totalRomBanks = 128; break;
            case 0x07: this.totalRomBanks = 256; break;
            case 0x08: this.totalRomBanks = 512; break;
            case 0x52: this.totalRomBanks = 72; break;
            case 0x53: this.totalRomBanks = 80; break;
            case 0x54: this.totalRomBanks = 96; break;
        }

        // Read RAM size.
        this.ramSize = this.rom[0x0149];

        // Initialize RAM space.
        let totalRam = 0;
        switch (this.ramSize) {
            case 0x00: totalRam = 0; this.totalRamBanks = 0; break;
            case 0x01: totalRam = 2048; this.totalRamBanks = 1; break;
            case 0x02: totalRam = 8192; this.totalRamBanks = 1; break;
            case 0x03: totalRam = 32768; this.totalRamBanks = 4; break;
            case 0x04: totalRam = 131072; this.totalRamBanks = 16; break;
            case 0x05: totalRam = 65536; this.totalRamBanks = 8; break;
        }

        if (totalRam > 0) {
            this.ram = [];
            for (let i = 0; i < totalRam; i++) {
                this.ram[i] = Math.floor(Math.random() * 256);
            }
        }

        // Load "battery-backed" RAM for storage.
        if (this.hasBattery) {
            let ram = localStorage.getItem(`RAM-${this.title}-${this.globalChecksum}`);

            if (ram) {
                console.log(`Cartridge RAM found in local storage.`);
                ram = ram.split(",");
                this.ram = ram.map(value => { return parseInt(value); });
            }
        }
        
        // Read header checksum.
        this.headerChecksum = this.rom[0x014D];

        // Read global checksum.
        this.globalChecksum = this.rom[0x014E] + this.rom[0x014F];

        console.log(this);
    }

    readByte(address) {
        // ROM
        if (address >= 0x0000 && address <= 0x7FFF) {
            if (this.mbc === null) return this.rom[address];
            
            return this.mbc.readByte(address);
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this.hasRam) return 0xFF;

            return this.mbc.readByte(address);
        }

        throw `Cartridge: Unsupported read at $${address.toHex(4)}.`;
    }

    writeByte(address, byte) {
        // ROM
        if (address >= 0x0000 && address <= 0x7FFF) {
            if (this.mbc === null) return; // ROM is read-only
            
            this.mbc.writeByte(address, byte);
            return;
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this.hasRam) return; // No RAM to write to.

            this.mbc.writeByte(address, byte);
            return;
        }
    }
}