export default class MBC5 {
    constructor(cartridge) {
        this.cartridge = cartridge;
        this.romBankLo = 0x01; // Actually goes up to 9-bits of banking.
        this.romBankHi = 0x00;
        this.ramBank = 0x00;
        this.ramEnabled = false;
    }

    readByte(address) {
        // ROM Bank 00
        if (address >= 0x0000 && address <= 0x3FFF) {
            return this.cartridge.rom[address];
        }

        // ROM Banks 00-1FF
        if (address >= 0x4000 && address <= 0x7FFF) {
            const romBank = (this.romBankHi<<8)+this.romBankLo;            
            let offset = 0x4000 * romBank;
            return this.cartridge.rom[(address-0x4000)+offset];
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this.cartridge.hasRam) throw `Cartridge has no RAM but RAM access was attempted.`;

            let offset = 0x2000 * this.ramBank;
            return this.cartridge.ram[(address-0xA000)+offset];
        }
    }

    writeByte(address, byte) {
        // RAM Enable
        if (address >= 0x0000 && address <= 0x1FFF) {
            this.ramEnabled = (byte&0x0F) === 0x0A;
            return;
        }

        // ROM Banking Low
        if (address >= 0x2000 && address <= 0x2FFF) {
            this.romBankLo = byte;            
            return;
        }

        // ROM Banking High
        if (address >= 0x3000 && address <= 0x3FFF) {
            this.romBankHi = byte;
            return;
        }

        // RAM Banking
        if (address >= 0x4000 && address <= 0x5FFF) {
            this.ramBank = byte&0x0F;
            return;
        }

        // RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this.ramEnabled) return; // RAM disabled.

            // Mark for persistance at the end of the next frame.
            if (this.cartridge.hasBattery) this.cartridge.ramIsDirty = true;

            let offset = this.ramBank * 0x2000;
            this.cartridge.ram[(address-0xA000)+offset] = byte;
            return;
        }
    }
}