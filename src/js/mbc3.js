export default class MBC3 {
    constructor(cartridge) {
        this.cartridge = cartridge;
        this.romBank = 0x01;
        this.ramBank = 0x00;
        this.ramEnabled = false;
        this.rtcEnabled = false;
        this.mappedRegister = 0x00;
        this.latchBuffer = 0x00;
        this.latchedTime = null;
        this.rtcRegister = {
            seconds: 0,
            minutes: 0,
            hours: 0,
            days: 0,
            dayCarry: 0
        }

        // Load RTC if one was created for the cartridge.
        const rtc = localStorage.getItem(`RTC-${this.cartridge.title}-${this.cartridge.globalChecksum}`);
        if (rtc) {
            console.log(`RTC found in local storage.`, rtc);
            this.rtcEpoch = rtc;
        } else {
            this.rtcEpoch = Date.now();
            localStorage.setItem(`RTC-${this.cartridge.title}-${this.cartridge.globalChecksum}`, this.rtcEpoch);
        }
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
            if (this.mappedRegister >= 0x00 && this.mappedRegister <= 0x07) {
                let offset = 0x2000 * this.ramBank;
                return this.cartridge.ram[(address-0xA000)+offset];
            }            
        }

        return 0xFF;
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
            return;
        }

        // RAM Bank & RTC Register Select
        if (address >= 0x4000 && address <= 0x5FFF) {
            this.mappedRegister = byte;
            return;
        }

        // Latch Clock Data
        if (address >= 0x6000 && address <= 0x7FFF) {
            // Latch RTC if latch buffer is 0x00 and incoming byte is 0x01;
            if (this.latchBuffer === 0x00 && byte === 0x01) {
                const timeSpan = this.calculateTimeSpan(this.rtcEpoch, Date.now());

                if (timeSpan.days > 512) {
                    this.rtcRegister.dayCarry = 1;
                    timeSpan.days %= 512;
                }
                
                this.rtcRegister.seconds = timeSpan.seconds;
                this.rtcRegister.minutes = timeSpan.minutes;
                this.rtcRegister.hours = timeSpan.hours;
                this.rtcRegister.days = timeSpan.days;
            }            

            this.latchBuffer = byte;
            return;
        }

        if (address >= 0xA000 && address <= 0xBFFF) {
            if (this.mappedRegister >= 0x00 && this.mappedRegister <= 0x07) {
                if (!this.ramEnabled) return; // RAM disabled.
                
                // Mark for persistance at the end of the next frame.
                if (this.cartridge.hasBattery) this.cartridge.ramIsDirty = true;
                
                let offset = this.ramBank * 0x2000;
                this.cartridge.ram[(address-0xA000)+offset] = byte;
                return;
            }

            if (this.mappedRegister >= 0x08 && this.mappedRegister <= 0x0C) {
                switch (this.mappedRegister) {
                    case 0x08: // seconds
                        this.rtcRegister.seconds = byte; break;
                    case 0x09: // minutes
                        this.rtcRegister.minutes = byte; break;
                    case 0x0A: // hours
                        this.rtcRegister.hours = byte; break;
                    case 0x0B: // day low
                        this.rtcRegister.days = byte; break;
                    case 0x0C: // day high, carry, and halt
                        throw 'test';
                }
                return;
            }
        }   
    }

    calculateTimeSpan(startTime, endTime) {
        let seconds = Math.floor((endTime - startTime) / 1000);
        let minutes = 0;
        let hours = 0;
        let days = 0;

        if (seconds >= 60) {
            minutes = Math.floor(seconds / 60);
            seconds %= 60;
        }

        if (minutes >= 60) {
            hours = Math.floor(minutes / 60);
            minutes %= 60;
        }

        if (hours >= 24) {
            days = Math.floor(hours / 24);
            hours %= 24;
        }

        return {
            seconds: seconds,
            minutes: minutes,
            hours: hours,
            days: days
        }
    }
}