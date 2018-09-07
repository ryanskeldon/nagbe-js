class MBC1 {
    constructor(cartridge) {
        this.cartridge = cartridge;
        this.romBank = 1;
    }

    readByte(address) {
        // ROM Bank 0
        if (address >= 0x0000 && address <= 0x3FFF) {
            return this.cartridge.rom[address];
        }

        // ROM Bank 1 (Memory Bank Controlled)
        if (address >= 0x4000 && address <= 0x7FFF) {
            let offset = 0x4000 * this.romBank;
            return this.cartridge.rom[(address-0x4000)+offset];
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {            
            let offset = 0x2000 * this.ramBank;
            return this.cartridge.ram[(address-0xA000)+offset];
        }
    }

    writeByte(address, byte) {
        // RAM Enable
        if (address >= 0x0000 && address <= 0x1FFF) {
            this.cartridge.ramEnabled = byte === 0x0A;
            return;
        }

        // ROM Banking
        if (address >= 0x2000 && address <= 0x3FFF) {
            let romBank = byte & 0x1F; // Mask for lower 5 bits.
            this.romBank &= 0xE0; // Turn off lower 5 bits.
            this.romBank |= romBank; // Set lower 5 bits.
            if (this.romBank === 0) this.romBank++;            

            if (this.romBank > this.cartridge.totalRomBanks)
                throw `Invalid ROM bank selected: ${this.romBank}`;
            return;
        }

        // RAM Banking
        if (address >= 0x4000 && address <= 0x5FFF) {
            if (this.bankingMode === 0) { // ROM Banking
                let romBank = (byte<<6);
                this.romBank = romBank + (this.romBank&0x1F);
            } else if (this.bankingMode === 1) { // RAM Banking
                this.ramBank = byte & 0x03;
            }
            return;
        }

        // ROM/RAM Mode Select
        if (address >= 0x6000 && address <= 0x7FFF) {
            this.bankingMode = byte & 0x01;
            return;
        }

        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this.ramEnabled) return; // RAM disabled.

            // Mark for persistance at the end of the next frame.
            if (this.cartridge.hasBattery) this.cartridge.ramIsDirty = true;

            if (this.bankingMode === 0) { // ROM mode, only write to bank 0x00 of RAM.
                this.cartridge.ram[address-0xA000] = byte;
                return;    
            }

            let offset = this.ramBank * 0x2000;
            this.cartridge.ram[(address-0xA000)+offset] = byte;

            return;
        }
    }
}