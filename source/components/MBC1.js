"use strict";

class MBC1 {
    constructor(cartridge) {
        this.cartridge = cartridge;
        this.romBank = 0x01;
        this.ramBank = 0x00;
        this.ramEnabled = false;
        this.bankMode = 0;
    }

    readByte(address) {
        // ROM Bank 00
        if (address >= 0x0000 && address <= 0x3FFF) {
            return this.cartridge.rom[address];
        }

        // ROM Banks 01-7F
        if (address >= 0x4000 && address <= 0x7FFF) {
            let offset = 0x4000 * this.romBank;
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

        // ROM Banking
        if (address >= 0x2000 && address <= 0x3FFF) {
            let romBank = byte & 0x1F; // Mask for lower 5 bits.
            this.romBank &= 0xE0; // Turn off lower 5 bits.
            this.romBank |= romBank; // Set lower 5 bits.
            if (this.romBank === 0) this.romBank++;
            return;
        }

        // RAM/ROM Banking
        if (address >= 0x4000 && address <= 0x5FFF) {
            if (this.bankMode === 0x00) { // ROM Banking
                let romBank = (byte<<5); // Move bits into correct location.
                this.romBank &= 0x60; // Turn off bits 5 and 6.
                this.romBank |= romBank; // Set bits 5 and 6.
            } else if (this.bankMode === 0x01) { // RAM Banking
                this.ramBank = byte&0x03;
            }
            return;
        }

        // ROM/RAM Mode Select
        if (address >= 0x6000 && address <= 0x7FFF) {
            this.bankMode = byte & 0x01;
            return;
        }

        if (address >= 0xA000 && address <= 0xBFFF) {
            if (!this.ramEnabled) return; // RAM disabled.

            // Mark for persistance at the end of the next frame.
            if (this.cartridge.hasBattery) this.cartridge.ramIsDirty = true;

            if (this.bankMode === 0) { // ROM mode, only write to bank 0x00 of RAM.
                this.cartridge.ram[address-0xA000] = byte;
                return;    
            }

            let offset = this.ramBank * 0x2000;
            this.cartridge.ram[(address-0xA000)+offset] = byte;

            return;
        }
    }
}