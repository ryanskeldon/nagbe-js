export default class MMU {
    constructor(system) {
        this.system = system; // Reference to the emulator system.

        this.wram = []; // Working RAM
        this.zram = []; // Zero-page RAM

        // Initialize RAM
        for (var i = 0; i < 32768; i++) this.wram[i] = Math.floor(Math.random() * 256); // Reset Working RAM (32KB)
        for (var i = 0; i < 128; i++) this.zram[i]  = Math.floor(Math.random() * 256);  // Reset Zero-page RAM (128B)

        // Registers
        this.register = {
            if: 0, // $FF0F Interrupt Flag (R/W)
            ie: 0, // $FFFF Interrupt Enable (R/W)
    
            // Color GB Only Registers
            key1: 0x7E, // $FF4D Prepare Speed Switch
            tp: 0, // $FF56 Infrared Communications Port
            svbk: 0 // $FF70 WRAM Bank
        }        
    }

    readByte(address) {
        if (address < 0x0000 || address > 0xFFFF)
            throw `Segfault read @ $${address.toHex(4)}`;

        // ROM Banks
        if (address >= 0x0000 && address <= 0x7FFF)
            return this.system.cartridge.readByte(address);

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF)
            return this.system.gpu.readByte(address);

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF)
            return this.system.cartridge.readByte(address);

        // WRAM Bank 0
        if (address >= 0xC000 && address <= 0xCFFF)
            return this.wram[address - 0xC000];
        
        // WRAM Switchable Banks 1-7
        if (address >= 0xD000 && address <= 0xDFFF)
            return this.wram[(address-0xC000)+(this.register.svbk*0x1000)];

        // WRAM Echo
        if (address >= 0xE000 && address <= 0xFDFF) {
            return this.wram[address-0xE000];
        };

        // Sprite Attribute Table (OAM)
        if (address >= 0xFE00 && address <= 0xFE9F)
            return this.system.gpu.readByte(address);

        // Joypad
        if (address == 0xFF00)
            return this.system.joypad.readByte(address);

        // Serial
        if (address >= 0xFF01 && address <= 0xFF02)
            return this.system.serial.readByte(address);

        // Timer
        if (address >= 0xFF04 && address <= 0xFF07)
            return this.system.timer.readByte(address);

        // Interrupt Flag
        if (address === 0xFF0F)
            return this.register.if|0xE0;

        // Audio
        if (address >= 0xFF10 && address <= 0xFF3F)
            return this.system.apu.readByte(address);

        // GPU
        if (address >= 0xFF40 && address <= 0xFF4B)
            return this.system.gpu.readByte(address);

        // GBC Double Speed (GBC Only)
        if (address === 0xFF4D) 
            return this.register.key1;

        // LCD VRAM Banking (GBC Only)
        if (address === 0xFF4F)
            return this.system.gpu.readByte(address);

        // LCD VRAM DMA (GBC Only)
        if (address >= 0xFF51 && address <= 0xFF55)
            return this.system.gpu.readByte(address);

        // WRAM Bank Select (GBC Only)
        if (address === 0xFF70)
            return this.register.svbk&0x07;    

        // High RAM (stack)
        if (address >= 0xFF80 && address <= 0xFFFE)
            return this.zram[address - 0xFF80];

        // Interrupt Enable Register
        if (address === 0xFFFF)
            return this.register.ie;

        console.log(`Warning: Read attempt @ $${address.toHex(4)} / instr: $${this.system.cpu.instructionCode.toHex(2)}`);
        return 0xFF;
    }

    readWord(address) {
        // Read byte + next byte shifted by 1 byte.
        return (this.readByte(address+1)<<8) + this.readByte(address);
    }

    writeByte(address, byte) {
        if (address < 0x0000 || address > 0xFFFF)
            throw `Segfault write @ $${address.toHex(4)} / value: ${byte.toHex(2)}`;
        if (isNaN(byte))
            throw `Ins $${(this.system.cpu.instructionCode.toHex(2)).toHex(4)} tried to write NaN to $${address.toHex(4)}`;

        // Cartridge ROM
        if (address >= 0x0000 && address <= 0x7FFF) {
            this.system.cartridge.writeByte(address, byte);
            return;
        }

        // VRAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            this.system.gpu.writeByte(address, byte);
            return;
        }

        // External RAM
        if (address >= 0xA000 && address <= 0xBFFF) {
            this.system.cartridge.writeByte(address, byte);
            return;
        }

        // WRAM Bank 0
        if (address >= 0xC000 && address <= 0xCFFF) {
            this.wram[address-0xC000] = byte;
            return;
        }
        
        // WRAM Switchable Banks 1-7
        if (address >= 0xD000 && address <= 0xDFFF) {
            this.wram[(address-0xC000)+(this.register.svbk*0x1000)] = byte;
            return;
        }

        // WRAM Echo
        if (address >= 0xE000 && address <= 0xFDFF) { 
            this.wram[address-0xE000] = byte;
            return;
        }

        // Sprite Attribute Table (OAM)
        if (address >= 0xFE00 && address <= 0xFE9F) { 
            this.system.gpu.writeByte(address, byte);
            return;
        }

        // Unusable space
        if (address >= 0xFEA0 && address <= 0xFEFF) {
            return;
        }

        // Joypad
        if (address == 0xFF00) {
            this.system.joypad.writeByte(address, byte);
            return;
        }

        // Serial
        if (address >= 0xFF01 && address <= 0xFF02) {
            this.system.serial.writeByte(address, byte);
            return;
        }

        // Timers
        if (address >= 0xFF04 && address <= 0xFF07) {
            this.system.timer.writeByte(address, byte);
            return;
        }

        // Interrupt Flag
        if (address === 0xFF0F) {
            this.register.if = byte;
            return;
        }

        // Audio
        if (address >= 0xFF10 && address <= 0xFF3F) {
            this.system.apu.writeByte(address, byte);
            return;
        }

        // Graphics
        if (address >= 0xFF40 && address <= 0xFF4B) {
            this.system.gpu.writeByte(address, byte);
            return;
        }

        // GBC Double Speed (GBC Only)
        if (address === 0xFF4D) {
            this.register.key1 = byte;
            return ;
        } 

        // LCD VRAM Banking (GBC Only)
        if (address === 0xFF4F) {
            this.system.gpu.writeByte(address, byte);
            return;
        }            

        // LCD VRAM DMA (GBC Only)
        if (address >= 0xFF51 && address <= 0xFF55) {
            this.system.gpu.writeByte(address, byte);
            return;
        }           

        // WRAM Bank Select (GBC Only)
        if (address === 0xFF70) {
            this.register.svbk = byte;
            if (this.register.svbk === 0) this.register.svbk = 0x01;
            return;
        }

        // Zero-page RAM
        if (address >= 0xFF80 && address <= 0xFFFE) { 
            this.zram[address-0xFF80] = byte;
            return;
        }

        // Interrupt Enable Register
        if (address === 0xFFFF) { 
            this.register.ie = byte;
            return;
        }

        console.log(`MMU: Write attempt @ $${address.toHex(4)} value: ${byte.toHex(2)}`);
    }

    writeWord(address, word) {
        this.writeByte(address, word&0xFF); // LSB
        this.writeByte(address+1, word>>8); // MSB
    }
}