GPU = {
    // Memory
    _vram: [],
    _oam: [],

    _colors: [
        0x9bbc0f, // White
        0x8bac0f, // Light Grey
        0x306230, // Dark Grey
        0x0f380f  // Black
    ],

    _lcdModes: {
        HBlank: 0,
        VBlank: 1,
        SearchOAM: 2,
        Transfer: 3
    },

    _clock: 0,

    // Background Map
    _bgMapCanvas: {},
    _bgMapScreen: {},
    _colorMap: [],

    // Screen
    _screenCanvas: {},
    _screenData: {},

    // Screen 
    _screenBuffer: {},
    _screenBufferCanvas: {},

    _frameBuffer: [],

    _linePixelData: [],

    // Registers
    _register: {
        _lcdc: 0, // 0xFF40 (r/w) LCD control
        _stat: 0, // 0xFF41 (r/w) LCDC Status
        _scy: 0,  // 0xFF42 (r/w) Scroll Y
        _scx: 0,  // 0xFF43 (r/w) Scroll X TODO: Fill in full memory address
        _ly: 0,   // 0xFF44 (r) LCDC Y-coordinate
        _lyc: 0,  // 0xFF45 (r/w) LY Compare
        _dma: 0,  // 0xFF46 (w) DM Transfer & Start Address
        _bgp: 0,  // 0xFF47 (r/w) BG & Window palette
        _obj0: 0, // 0xFF48 (r/w) OBJ 0 Palette
        _obj1: 0, // 0xFF49 (r/w) OBJ 1 Palette
        _wy: 0,   // 0xFF4A (r/w) Window Y position
        _wb: 0,   // 0xFF4B (r/w) Window X position
    },

    init: function () {
        // Fill memory with random values to emulate realistic hardware.
        for (var i = 0; i < 8192; i++) GPU._vram[i] = Math.floor(Math.random() * 256); // Reset Video RAM (8kB)       
        for (var i = 0; i < 128; i++)  GPU._oam[i]  = Math.floor(Math.random() * 256); // Sprite Attribute Memory (OAM) (128B)

        // Initialize background map.
        let backgroundMapElement = document.getElementById("backgroundMap");
        GPU._bgMapCanvas = backgroundMapElement.getContext("2d");
        GPU._bgMapScreen = GPU._bgMapCanvas.createImageData(256, 256);

        for (var i = 0; i < 256*256*4;) {
            GPU._bgMapScreen.data[i] = 0xEF;
            GPU._bgMapScreen.data[i+1] = 0xEF;
            GPU._bgMapScreen.data[i+2] = 0xEF;
            GPU._bgMapScreen.data[i+3] = 0xFF;
            i+=4;
        }

        GPU._bgMapCanvas.putImageData(GPU._bgMapScreen, 0, 0);

        // Initialize screen.
        backgroundMapElement = document.getElementById("screen");
        GPU._screenCanvas = backgroundMapElement.getContext("2d");
        GPU._screenData = GPU._screenCanvas.createImageData(160, 144);

        for (var i = 0; i < 160*144*4;) {
            GPU._screenData.data[i] = 0xEF;
            GPU._screenData.data[i+1] = 0xEF;
            GPU._screenData.data[i+2] = 0xEF;
            GPU._screenData.data[i+3] = 0xFF;
            i+=4;
        }

        GPU._screenCanvas.putImageData(GPU._screenData, 0, 0);

        // Initialize screen buffer
        GPU._screenBuffer = document.createElement("canvas");
        GPU._screenBuffer.width = 160; GPU._screenBuffer.height = 144;
        GPU._screenBufferCanvas = GPU._screenBuffer.getContext("2d");
    },

    readByte: function (address) {
        if (address >= 0x8000 && address <= 0x9FFF) {
            return GPU._vram[address & 0x1FFF];
        }

        // Sprite Attribute Memory
        if (address >= 0xFE00 && address <= 0xFE9F) {
            console.log(`GPU OAM Read $${address.toString(16)}`);
            return GPU._oam[address & 0x7F];
        }

        switch (address) {
            case 0xFF40: return GPU._register._lcdc;
            case 0xFF41: 
                let stat = GPU._register._stat;                
                
                // Bit 7 is unused and always returns 1.
                stat |= 0x80; 

                // Bits 0-2 return 0 when LCD is off.
                if (!GPU.isLcdEnabled()) stat &= ~(0x07);

                return stat; 
            case 0xFF42: return GPU._register._scy;
            case 0xFF43: return GPU._register._scx;
            case 0xFF44: 
                let ly = GPU._register._ly;

                // When the LCD is off, LY is fixed at 0.
                if (!GPU.isLcdEnabled()) ly = 0;

                return ly;
            case 0xFF45: return GPU._register._lyc;
            case 0xFF47: return GPU._register._bgp;
            case 0xFF48: return GPU._register._obj0;
            case 0xFF49: return GPU._register._obj1;
            case 0xFF4A: return GPU._register._wy;
            case 0xFF4B: return GPU._register._wx;
        }

        throw `GPU: Invalid read from $${address.toString(16)}`;
    },

    writeByte: function (address, byte) {
        // Video RAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            GPU._vram[address & 0x1FFF] = byte;
            return;
        }

        // Sprite Attribute Memory
        if (address >= 0xFE00 && address <= 0xFE9F) {
            // console.log(`OAM Writes $${address.toString(16)} value: 0x${byte.toString(16)}`);
            GPU._oam[address & 0x7F] = byte;
            // console.log(MMU.readByte(address).toString(16));
            return;
        }

        // GPU Registers
        switch (address) {            
            case 0xFF40: GPU._register._lcdc = byte; return;
            case 0xFF41: GPU._register._stat = byte; return;
            case 0xFF42: GPU._register._scy = byte; return;
            case 0xFF43: GPU._register._scx = byte; return;                
            case 0xFF44: GPU._register._ly = 0; return; // Note: any outside write to LY resets the value to 0;
            case 0xFF45: GPU._register._lyc = byte; return;
            case 0xFF46: GPU._register._dma = byte; GPU.transferDMA(); return;
            case 0xFF47: GPU._register._bgp = byte; return;
            case 0xFF48: GPU._register._obj0 = byte; return;
            case 0xFF49: GPU._register._obj1 = byte; return;
            case 0xFF4A: GPU._register._wy = byte; return;
            case 0xFF4B: GPU._register._wx = byte; return;
        }

        throw `GPU: Invalid write to $${address.toString(16)}`;
    },

    transferDMA: function () {
        let address = GPU._register._dma << 8;

        for (let i = 0; i < 0xA0; i++)
            MMU.writeByte(0xFE00+i, MMU.readByte(address+i));
    },

    isLcdEnabled: function () {
        return !!(GPU._register._lcdc&0x80);
    },

    getLcdMode: function () {
        return GPU._register._lcdc&0x03;
    },
    setLcdMode: function (mode) {
        GPU._register._lcdc &= ~0x03; // Clear mode.
        GPU._register._lcdc |= mode;  // Set mode.
    },

    step: function () {
        if (GPU.isLcdEnabled()) {
            // Add last instruction's clock time.
            GPU._clock += Z80._register.t;
        } else {
            return;
        }

        if (GPU._clock >= 456) {
            if (GPU._register._ly < 144)
                GPU.renderScanline();

            GPU._clock = 0;
            GPU._register._ly++;

            if (GPU._register._ly == 144) {
                GPU.drawScreen();
                Z80.requestInterrupt(0);
            }
            else if (GPU._register._ly > 153) {                
                GPU._register._ly = 0;
            }
        }
    },

    renderScanline: function () { 
        let pixels = [];        
        
        let sx = GPU._register._scx; 
        let sy = GPU._register._scy;
        let ly = GPU._register._ly;

        // Check if window is enabled.
        let windowEnabled = !!(GPU._register._lcdc&0x20);
        let tilemapRegion = 0;
        
        if (windowEnabled) {
            if (GPU._register._lcdc & 0x40) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        } else {
            if (GPU._register._lcdc & 0x08) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        }

        // Get tileset region.
        let tilesetRegion = 0;
        let unsignedTiles = true;
        if (GPU._register._lcdc & 0x10) {
            tilesetRegion = 0x8000; // 0x8000 - 0x8FFF
        } else {
            tilesetRegion = 0x8800; // 0x8800 - 0x97FF
            unsignedTiles = false;
        }   

        // Load color palette for background.
        let bgPalette = GPU.readByte(0xFF47);        

        let color0 = GPU._colors[bgPalette&0x3];
        let color1 = GPU._colors[(bgPalette>>2)&0x3];
        let color2 = GPU._colors[(bgPalette>>4)&0x3];
        let color3 = GPU._colors[(bgPalette>>6)&0x3];  

        // Calculate which scanline we're on.
        let yPos = sy + ly;
        
        for (let x = 0; x < 160; x++) {
            let xPos = sx + x;
            let tx = (xPos/8)&255; let ty = (yPos/8)&255;
            let tileId = GPU.readByte(tilemapRegion + (32 * ty + tx));

            if (!unsignedTiles) {
                // Adjust for signed byte.
                if (tileId > 127) tileId = -((~tileId+1)&255);
                tileId += 128;
            }

            // Find tile pixel data for color.
            let tileAddress = tilesetRegion + (tileId * 16);
            let px = (sx+x)%8; let py = (sy+ly)%8;
            let pixelRow = py*2;
            let lb = GPU.readByte(tileAddress + pixelRow);
            let hb = GPU.readByte(tileAddress + pixelRow + 1);

            let l = lb&(1<<(7-px))?1:0;
            let h = hb&(1<<(7-px))?1:0;
            let color = (h<<1)+l;
            let pixelColor = 0;

            switch (color) {
                case 0: pixelColor = color0; break;
                case 1: pixelColor = color1; break;
                case 2: pixelColor = color2; break;
                case 3: pixelColor = color3; break;
            }

            pixels[x] = pixelColor;
        }    

        GPU._frameBuffer[ly] = pixels;
    },

    drawScreen: function() {
        let screenData = GPU._screenCanvas.getImageData(0, 0, 160, 144);
        
        for (let y = 0; y < 144; y++) {
            for (let x = 0; x < 160*4; x++) {
                let pixel = GPU._frameBuffer[y][x];
                screenIndex = 160*4 * y + x*4;

                screenData.data[screenIndex]   = (pixel>>16)&255;
                screenData.data[screenIndex+1] = (pixel>>8)&255;
                screenData.data[screenIndex+2] = pixel&255;
                screenData.data[screenIndex+3] = 255;
            }
        }

        GPU._screenCanvas.putImageData(screenData, 0, 0);
    },

    renderBackgroundTileMap: function () {
        // Check if window is enabled.
        let windowEnabled = !!(GPU._register._lcdc&0x20);
        let tilemapRegion = 0;
        
        if (windowEnabled) {
            if (GPU._register._lcdc & 0x40) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        } else {
            if (GPU._register._lcdc & 0x08) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        }
        
        // Get tileset region.
        let tilesetRegion = 0;
        let unsignedTiles = true;
        if (GPU._register._lcdc & 0x10) {
            tilesetRegion = 0x8000; // 0x8000 - 0x8FFF
        } else {
            tilesetRegion = 0x8800; // 0x8800 - 0x97FF
            unsignedTiles = false;
        }        

        // Load color palette for background.
        let palette = GPU.readByte(0xFF47);        

        let color0 = GPU._colors[palette&0x3];
        let color1 = GPU._colors[(palette>>2)&0x3];
        let color2 = GPU._colors[(palette>>4)&0x3];
        let color3 = GPU._colors[(palette>>6)&0x3];        

        // Build map.
        for (let ty = 0; ty < 32; ty++) {
            for (let tx = 0; tx < 32; tx++) {
                // Find tile.
                let tileId = GPU.readByte(tilemapRegion + (32 * ty + tx));

                if (!unsignedTiles) {
                    // Adjust for signed byte.
                    if (tileId > 127) tileId = -((~tileId+1)&255);
                    tileId += 128;
                }

                let tileAddress = tilesetRegion + (tileId * 16);
                let address = 0;
                for (let py = 0; py < 8; py++) {
                    let lb = GPU.readByte(tileAddress + address++);
                    let hb = GPU.readByte(tileAddress + address++);

                    for (let px = 0; px < 8; px++) {
                        let l = lb&(1<<(7-px))?1:0;
                        let h = hb&(1<<(7-px))?1:0;
                        let color = (h<<1)+l;
                        let pixelColor = 0;

                        switch (color) {
                            case 0: pixelColor = color0; break;
                            case 1: pixelColor = color1; break;
                            case 2: pixelColor = color2; break;
                            case 3: pixelColor = color3; break;
                        }

                        let index = 256 * ((ty*8)+py) + ((tx*8)+px);
                        GPU._colorMap[index] = pixelColor;
                    }
                }
            }
        }

        let screenData = GPU._bgMapCanvas.getImageData(0, 0, 256, 256);

        for (let y = 0; y < 256; y++){
            for (let x = 0; x < 256; x++){
                bgIndex = 256 * y + x;
                screenIndex = 256 * (y*4) + (x*4);

                screenData.data[screenIndex]   = (GPU._colorMap[bgIndex]>>16)&255;
                screenData.data[screenIndex+1] = (GPU._colorMap[bgIndex]>>8)&255;
                screenData.data[screenIndex+2] = GPU._colorMap[bgIndex]&255;
                screenData.data[screenIndex+3] = 255;
            }
        }

        GPU._bgMapCanvas.putImageData(screenData, 0, 0);
    }
};

GPU.init();