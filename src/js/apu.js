export default class APU {
    constructor(system) {
        this.system = system;

        // FF30 - FF3F Wave pattern RAM, 32 4-bit samples
        this.waveRam = []; 
        
        // Randomize wave RAM.
        for (let i = 0; i < 32; i++) this.waveRam[i] = Math.floor(Math.random() * 256); // Reset wave RAM (32B)

        this.register = {
            // Channel 1 - Tone & Sweep
            nr10: 0, // FF10 Sweep
            nr11: 0, // FF11 Sound length / Wave pattern duty
            nr12: 0, // FF12 Volume envelope
            nr13: 0, // FF13 Frequency lo
            nr14: 0, // FF14 Frequency hi
    
            // Channel 2 - Tone
            nr21: 0, // FF16 Sound length / Wave pattern duty
            nr22: 0, // FF17 Volume envelope
            nr23: 0, // FF18 Frequency lo
            nr24: 0, // FF19 Frequency hi
    
            // Channel 3 - Wave Output
            nr30: 0, // FF1A Sound on/off
            nr31: 0, // FF1B Sound length
            nr32: 0, // FF1C Select output level
            nr33: 0, // FF1D Frequency lo
            nr34: 0, // FF1E Frequency hi
    
            // Channel 4
            nr41: 0, // FF20 Sound length
            nr42: 0, // FF21 Volume envelope
            nr43: 0, // FF22 Polynomial counter
            nr44: 0, // FF23 Counter / consecutive; Initial
    
            // Control
            nr50: 0, // FF24 Control / ON-OFF / Volume
            nr51: 0, // FF25 Sound output terminal selection
            nr52: 0, // FF26 On / Off
        };
    }
    
    readByte(address) {
        if (address >= 0xFF30 && address <= 0xFF3F)
            return this.waveRam[address-0xFF30];

        switch (address) {
            case 0xFF10: return this.register.nr10;
            case 0xFF11: return this.register.nr11;
            case 0xFF12: return this.register.nr12;
            case 0xFF13: return this.register.nr13;
            case 0xFF14: return this.register.nr14;            
            case 0xFF16: return this.register.nr21;
            case 0xFF17: return this.register.nr22;
            case 0xFF18: return this.register.nr23;
            case 0xFF19: return this.register.nr24;
            case 0xFF1A: return this.register.nr30;
            case 0xFF1B: return this.register.nr31;
            case 0xFF1C: return this.register.nr32;
            case 0xFF1D: return this.register.nr33;
            case 0xFF1E: return this.register.nr34;            
            case 0xFF20: return this.register.nr41;
            case 0xFF21: return this.register.nr42;
            case 0xFF22: return this.register.nr43;
            case 0xFF23: return this.register.nr44;
            case 0xFF24: return this.register.nr50;
            case 0xFF25: return this.register.nr51;
            case 0xFF26: return this.register.nr52;
        }
    }

    writeByte(address, byte) {
        if (address >= 0xFF30 && address <= 0xFF3F) {
            this.waveRam[address-0xFF30] = byte;
            return;
        }

        switch (address) {
            case 0xFF10: this.register.nr10 = byte; return;
            case 0xFF11: this.register.nr11 = byte; return;
            case 0xFF12: this.register.nr12 = byte; return;
            case 0xFF13: this.register.nr13 = byte; return;
            case 0xFF14: this.register.nr14 = byte; return;           
            case 0xFF16: this.register.nr21 = byte; return;
            case 0xFF17: this.register.nr22 = byte; return;
            case 0xFF18: this.register.nr23 = byte; return;
            case 0xFF19: this.register.nr24 = byte; return;
            case 0xFF1A: this.register.nr30 = byte; return;
            case 0xFF1B: this.register.nr31 = byte; return;
            case 0xFF1C: this.register.nr32 = byte; return;
            case 0xFF1D: this.register.nr33 = byte; return;
            case 0xFF1E: this.register.nr34 = byte; return;           
            case 0xFF20: this.register.nr41 = byte; return;
            case 0xFF21: this.register.nr42 = byte; return;
            case 0xFF22: this.register.nr43 = byte; return;
            case 0xFF23: this.register.nr44 = byte; return;
            case 0xFF24: this.register.nr50 = byte; return;
            case 0xFF25: this.register.nr51 = byte; return;
            case 0xFF26: this.register.nr52 = byte; return;
        }
    }
}