"use strict";

class MBC3 {
    constructor(cartridge) {
        this.cartridge = cartridge;
        this.romBank = 0x01;
        this.ramBank = 0x00;
        this.ramEnabled = false;
        this.rtcEnabled = false;
        this.bankMode = 0;
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
        // RAM & RTC Enable
        if (address >= 0x0000 && address <= 0x1FFF) {
            this.ramEnabled = byte === 0x0A;
            this.rtcEnabled = byte === 0x0A;
            return;
        }

        // ROM Banking
        if (address >= 0x2000 && address <= 0x3FFF) {
            let romBank = byte & 0x7F; // Mask for lower 7 bits.
            this.romBank &= 0x80; // Turn off lower 7 bits.
            this.romBank |= romBank; // Set lower 7 bits.
            if (this.romBank === 0) this.romBank++;            

            // if (this.romBank > this._mbc.totalRomBanks)
            //     throw `Invalid ROM bank selected: ${this._mbc.romBank}`;
            return;
        }

        // RAM Banking
        if (address >= 0x4000 && address <= 0x5FFF) {
            // if (this._mbc.mode === 0) { // ROM Banking
            //     let romBank = (byte<<6);
            //     this._mbc.romBank = romBank + (this._mbc.romBank&0x1F);
            // } else if (this._mbc.mode === 1) { // RAM Banking
            // }
            if (byte < 4) this.ramBank = byte;
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

// _rtc: {
//     exists: false,
//     enabled: false,
//     latched: false,
//     seconds: 0,   // 0x08
//     minutes: 0,   // 0x09
//     hours: 0,     // 0x0A
//     days_low: 0,  // 0x0B
//     days_high: 0, // 0x0C
// },

// // Memory Bank Controller Type 3
// MBC3_readByte: function (address) {
//         // ROM Bank 0
//         if (address >= 0x0000 && address <= 0x3FFF) {
//             return this._memory.rom[address];
//         }

//         // ROM Bank 1 (Memory Bank Controlled)
//         if (address >= 0x4000 && address <= 0x7FFF) {
//             let offset = 0x4000 * this._mbc.romBank;
//             return this._memory.rom[(address-0x4000)+offset];
//         }

//         // RAM
//         if (address >= 0xA000 && address <= 0xBFFF) {
//             let offset = 0x2000 * this._mbc.ramBank;
//             return this._memory.ram[(address-0xA000)+offset];
//         }
// },
// MBC3_writeByte: function (address, byte) {  
//         // RAM & RTC Enable
//         if (address >= 0x0000 && address <= 0x1FFF) {
//             this._memory.ramEnabled = byte === 0x0A;
//             this._rtc.enabled = byte === 0x0A;
//             return;
//         }

//         // ROM Banking
//         if (address >= 0x2000 && address <= 0x3FFF) {
//             let romBank = byte & 0x7F; // Mask for lower 7 bits.
//             this._mbc.romBank &= 0x80; // Turn off lower 7 bits.
//             this._mbc.romBank |= romBank; // Set lower 7 bits.
//             if (this._mbc.romBank === 0) this._mbc.romBank++;            

//             if (this._mbc.romBank > this.totalRomBanks)
//                 throw `Invalid ROM bank selected: ${this._mbc.romBank}`;
//             return;
//         }

//         // RAM Banking
//         if (address >= 0x4000 && address <= 0x5FFF) {
//             // if (this._mbc.mode === 0) { // ROM Banking
//             //     let romBank = (byte<<6);
//             //     this._mbc.romBank = romBank + (this._mbc.romBank&0x1F);
//             // } else if (this._mbc.mode === 1) { // RAM Banking
//             // }
//             if (byte < 4) this._mbc.ramBank = byte;
//             return;
//         }

//         // ROM/RAM Mode Select
//         if (address >= 0x6000 && address <= 0x7FFF) {
//             this._mbc.mode = byte & 0x01;
//             return;
//         }

//         if (address >= 0xA000 && address <= 0xBFFF) {
//             if (!this._memory.ramEnabled) return; // RAM disabled.

//             // Mark for persistance at the end of the next frame.
//             if (this._memory.hasBattery) this._memory.ramIsDirty = true;

//             if (this._mbc.mode === 0) { // ROM mode, only write to bank 0x00 of RAM.
//                 this._memory.ram[address-0xA000] = byte;
//                 return;    
//             }

//             let offset = this._memory.ramBank * 0x2000;
//             this._memory.ram[(address-0xA000)+offset] = byte;

//             return;
//         }     
// }