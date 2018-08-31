GPU = {
    // Memory
    _vram: [],
    _oam: [],

    _bgColors: [
        0xe0f8d0, // White
        0x88c070, // Light Grey
        0x346856, // Dark Grey
        0x081820  // Black
    ],

    _obj0Colors: [
        0xe0f8d0, // White
        0x88c070, // Light Grey
        0x346856, // Dark Grey
        0x081820  // Black
    ],

    _obj1Colors: [
        0xe0f8d0, // White
        0x88c070, // Light Grey
        0x346856, // Dark Grey
        0x081820  // Black
    ],

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
        lcdc: 0, // 0xFF40 (r/w) LCD control
        stat: 0, // 0xFF41 (r/w) LCDC Status
        scy:  0, // 0xFF42 (r/w) Scroll Y
        scx:  0, // 0xFF43 (r/w) Scroll X TODO: Fill in full memory address
        ly:   0, // 0xFF44 (r) LCDC Y-coordinate
        lyc:  0, // 0xFF45 (r/w) LY Compare
        dma:  0, // 0xFF46 (w) DM Transfer & Start Address
        bgp:  0, // 0xFF47 (r/w) BG & Window palette
        obj0: 0, // 0xFF48 (r/w) OBJ 0 Palette
        obj1: 0, // 0xFF49 (r/w) OBJ 1 Palette
        wy:   0, // 0xFF4A (r/w) Window Y position
        wx:   0, // 0xFF4B (r/w) Window X position
    },

    init: function () {
        // Fill memory with random values to emulate realistic hardware.
        for (var i = 0; i < 8192; i++) this._vram[i] = Math.floor(Math.random() * 256); // Reset Video RAM (8kB)       
        for (var i = 0; i < 160; i++)  this._oam[i]  = Math.floor(Math.random() * 256); // Sprite Attribute Memory (OAM) (160B)

        // Initialize background map.
        let backgroundMapElement = document.getElementById("backgroundMap");
        this._bgMapCanvas = backgroundMapElement.getContext("2d");
        this._bgMapScreen = this._bgMapCanvas.createImageData(256, 256);

        for (var i = 0; i < 256*256*4;) {
            this._bgMapScreen.data[i] = 0xEF;
            this._bgMapScreen.data[i+1] = 0xEF;
            this._bgMapScreen.data[i+2] = 0xEF;
            this._bgMapScreen.data[i+3] = 0xFF;
            i+=4;
        }

        this._bgMapCanvas.putImageData(this._bgMapScreen, 0, 0);

        // Initialize screen.
        backgroundMapElement = document.getElementById("screen");
        this._screenCanvas = backgroundMapElement.getContext("2d");
        this._screenData = this._screenCanvas.createImageData(160, 144);

        for (var i = 0; i < 160*144*4;) {
            this._screenData.data[i] = 0xEF;
            this._screenData.data[i+1] = 0xEF;
            this._screenData.data[i+2] = 0xEF;
            this._screenData.data[i+3] = 0xFF;
            i+=4;
        }

        this._screenCanvas.putImageData(this._screenData, 0, 0);

        // Initialize tile map.
        let tileMapElement = document.getElementById("tileMap");
        this._tileMapCanvas = tileMapElement.getContext("2d");
        this._tileMapData = this._tileMapCanvas.createImageData(128, 192);

        for (var i = 0; i < 128*192*4;) {
            this._tileMapData.data[i] = 0xEF;
            this._tileMapData.data[i+1] = 0xEF;
            this._tileMapData.data[i+2] = 0xEF;
            this._tileMapData.data[i+3] = 0xFF;
            i+=4;
        }

        this._tileMapCanvas.putImageData(this._tileMapData, 0, 0);

        // Initialize sprite map.
        let spriteMapElement = document.getElementById("spriteMap");
        this._spriteMapCanvas = spriteMapElement.getContext("2d");
        this._spriteMapData = this._spriteMapCanvas.createImageData(89, 35);

        for (var i = 0; i < 89*35*4;) {
            this._spriteMapData.data[i] = 0xEF;
            this._spriteMapData.data[i+1] = 0xEF;
            this._spriteMapData.data[i+2] = 0xEF;
            this._spriteMapData.data[i+3] = 0xFF;
            i+=4;
        }

        this._spriteMapCanvas.putImageData(this._spriteMapData, 0, 0);

        // Initialize screen buffer
        this._screenBuffer = document.createElement("canvas");
        this._screenBuffer.width = 160; this._screenBuffer.height = 144;
        this._screenBufferCanvas = this._screenBuffer.getContext("2d");
    },

    readByte: function (address) {
        if (address >= 0x8000 && address <= 0x9FFF) {
            return this._vram[address - 0x8000];
        }

        // Sprite Attribute Memory
        if (address >= 0xFE00 && address <= 0xFE9F) {
            return this._oam[address - 0xFE00];
        }

        switch (address) {
            case 0xFF40: return this._register.lcdc;
            case 0xFF41: 
                let stat = this._register.stat;                
                
                // Bit 7 is unused and always returns 1.
                stat |= 0x80; 

                // Bits 0-2 return 0 when LCD is off.
                if (!this.isLcdEnabled()) stat &= ~(0x07);

                return stat; 
            case 0xFF42: return this._register.scy;
            case 0xFF43: return this._register.scx;
            case 0xFF44: 
                let ly = this._register.ly;

                // When the LCD is off, LY is fixed at 0.
                if (!this.isLcdEnabled()) ly = 0;

                return ly;
            case 0xFF45: return this._register.lyc;
            case 0xFF46: return this._register.dma;
            case 0xFF47: return this._register.bgp;
            case 0xFF48: return this._register.obj0;
            case 0xFF49: return this._register.obj1;
            case 0xFF4A: return this._register.wy;
            case 0xFF4B: return this._register.wx;
        }

        throw `GPU: Invalid read from $${address.toString(16)}`;
    },

    writeByte: function (address, byte) {
        // Video RAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            this._vram[address - 0x8000] = byte;
            return;
        }

        // Sprite Attribute Memory
        if (address >= 0xFE00 && address <= 0xFE9F) {
            this._oam[address - 0xFE00] = byte;
            return;
        }

        // GPU Registers
        switch (address) {            
            case 0xFF40: this._register.lcdc = byte; return;
            case 0xFF41: this._register.stat = byte; return;
            case 0xFF42: this._register.scy = byte; return;
            case 0xFF43: this._register.scx = byte; return;                
            case 0xFF44: this._register.ly = 0; return; // Note: any outside write to LY resets the value to 0;
            case 0xFF45: this._register.lyc = byte; return;
            case 0xFF46: this._register.dma = byte; this.transferDMA(); return;
            case 0xFF47: this._register.bgp = byte; return;
            case 0xFF48: this._register.obj0 = byte; return;
            case 0xFF49: this._register.obj1 = byte; return;
            case 0xFF4A: this._register.wy = byte; return;
            case 0xFF4B: this._register.wx = byte; return;
        }

        throw `GPU: Invalid write to $${address.toString(16)}`;
    },

    transferDMA: function () {
        let address = this._register.dma << 8;

        for (let i = 0; i < 160; i++)
            MMU.writeByte(0xFE00+i, MMU.readByte(address+i));
    },

    isLcdEnabled: function () {
        return !!(this._register.lcdc&0x80);
    },

    getLcdMode: function () {
        return this._register.stat&0x03;
    },
    setLcdMode: function (mode) {
        this._register.stat &= ~0x03; // Clear mode.
        this._register.stat |= mode;  // Set mode.
    },

    step: function () {
        if (this.isLcdEnabled()) {
            // Add last instruction's clock time.
            this._clock += Z80._register.t;
            this._clock &= 0xFFFFFFFF;
        } else {
            this.setLcdMode(1);
            return;
        }

        // Set LCD status.
        let currentMode = this.getLcdMode();
        let mode = null;
        let interruptRequested = false;

        if (this._register.ly < 144) {
            if (this._clock <= 80) {
                // Mode 2
                mode = 2;
                interruptRequested = !!(this._register.stat&0x20);
            } else if (this._clock >= 80 && this._clock < 252) {
                // Mode 3
                mode = 3;                
            } else if (this._clock >= 252 && this._clock < 456) {
                // Mode 0
                mode = 0;
                interruptRequested = !!(this._register.stat&0x08);                
            }
        } else {
            // Mode 1
            mode = 1;
            interruptRequested = !!(this._register.stat&0x10);
        }
        this.setLcdMode(mode);

        // Request interrupt if modes changed and interrupt requested for LCD stat.
        if (currentMode != mode && interruptRequested) {
            Z80.requestInterrupt(1);
        }

        // Check for coincidence flag.
        if (this._register.ly === this._register.lyc) {
            // Set coincidence flag, lines match.
            this._register.stat |= 0x04;

            if (this._register.stat&0x40)
                Z80.requestInterrupt(1);
        } else {
            // Reset coincidence flag, lines don't match.
            this._register.stat &= ~0x04;
        }

        if (this._clock >= 456) {
            if (this._register.ly < 144)
                this.renderScanline();

            this._clock = 0;
            this._register.ly++;

            if (this._register.ly == 144) {
                Z80.requestInterrupt(0);
            }
            else if (this._register.ly > 153) {
                this._register.ly = 0;
                this.drawScreen();
            }
        }
    },

    renderScanline: function () { 
        let pixels = [];        
        
        let sx = this._register.scx; 
        let sy = this._register.scy;
        let wx = this._register.wx - 7;
        let wy = this._register.wy;
        let ly = this._register.ly;

        // Check if window is enabled.
        let windowEnabled = !!(this._register.lcdc&0x20) && wy <= ly;
        let tilemapRegion = 0;
        
        if (windowEnabled) {
            if (this._register.lcdc & 0x40) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        } else {
            if (this._register.lcdc & 0x08) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        }

        // Get tileset region.
        let tilesetRegion = 0;
        let unsignedTiles = true;
        if (this._register.lcdc & 0x10) {
            tilesetRegion = 0x8000; // 0x8000 - 0x8FFF
        } else {
            tilesetRegion = 0x8800; // 0x8800 - 0x97FF
            unsignedTiles = false;
        }   

        // Load color palette for background.
        let bgPalette = this.readByte(0xFF47);        

        let color0 = this._bgColors[bgPalette&0x3];
        let color1 = this._bgColors[(bgPalette>>2)&0x3];
        let color2 = this._bgColors[(bgPalette>>4)&0x3];
        let color3 = this._bgColors[(bgPalette>>6)&0x3];  

        // Calculate which scanline we're on.
        let yPos = 0;
        if (!windowEnabled)
            yPos = (sy + ly)%256;
        else
            yPos = ly - wy;
        
        // Generate background / window pixels
        for (let x = 0; x < 160; x++) {
            let xPos = (sx + x)%256;

            if (windowEnabled && x >= wx) {
                xPos = x - wx;
            }

            let tx = (xPos/8)&255; let ty = (yPos/8)&255;
            let tileId = this.readByte(tilemapRegion + (32 * ty + tx));

            if (!unsignedTiles) {
                // Adjust for signed byte.
                if (tileId > 127) tileId = -((~tileId+1)&255);
                tileId += 128;
            }

            // Find tile pixel data for color.
            let tileAddress = tilesetRegion + (tileId * 16);
            let px = 0; let py = 0;
            if (windowEnabled) {
                px = (x-wx)%8;
                py = (ly-wy)%8;
            } else {
                px = (sx+x)%8; 
                py = (sy+ly)%8;
            }
            let pixelRow = py*2;
            let lb = this.readByte(tileAddress + pixelRow);
            let hb = this.readByte(tileAddress + pixelRow + 1);

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

        // Load sprites
        if (this._register.lcdc&0x02) {        
            let renderedSprites = 0;
            
            for (let spriteId = 0; spriteId < 40; spriteId++) {
                let height = this._register.lcdc&0x04 ? 16 : 8;
                let sprite = this.getSprite(spriteId, height);
                
                if (ly >= sprite.y && ly < (sprite.y+height)) {
                    // Load color palette for background.
                    let palette = sprite.paletteId == 0 ? this._obj0Colors : this._obj1Colors;
                    let color0 = palette[sprite.palette&0x3];
                    let color1 = palette[(sprite.palette>>2)&0x3];
                    let color2 = palette[(sprite.palette>>4)&0x3];
                    let color3 = palette[(sprite.palette>>6)&0x3]; 

                    let py = ly - sprite.y;

                    if (sprite.yFlip) {
                        py -= height;
                        py *= -1;
                    }

                    for (let tx = 0; tx < 8; tx++) {
                        // Find tile pixel data for color.
                        let px = tx;
                        if (sprite.xFlip) {
                            px -= 7;
                            px *= -1;
                        }

                        let color = sprite.pixels[py%height][px%8];
                        let pixelColor = 0;

                        if (color === 0) continue; // Skip pixel if it's transparent.
                        if (sprite.priority == 1) continue;

                        switch (color) {
                            case 0: pixelColor = color0; break;
                            case 1: pixelColor = color1; break;
                            case 2: pixelColor = color2; break;
                            case 3: pixelColor = color3; break;
                        }

                        let pixel = sprite.x + tx;                        
                        
                        pixels[pixel] = pixelColor;
                    }

                    renderedSprites++;

                    // Limit 10 sprites per line.
                    if (renderedSprites == 10) break;
                }
            }
        }

        this._frameBuffer[ly] = pixels;
    },

    drawScreen: function () {
        let screenData = this._screenCanvas.getImageData(0, 0, 160, 144);
        
        for (let y = 0; y < 144; y++) {
            for (let x = 0; x < 160*4; x++) {
                let pixel = this._frameBuffer[y][x];
                screenIndex = 160*4 * y + x*4;

                screenData.data[screenIndex]   = (pixel>>16)&255;
                screenData.data[screenIndex+1] = (pixel>>8)&255;
                screenData.data[screenIndex+2] = pixel&255;
                screenData.data[screenIndex+3] = 255;
            }
        }

        this._screenCanvas.putImageData(screenData, 0, 0);
    },

    getSprite: function (spriteId, height) {
        let spriteAddress = 0xFE00 + (spriteId * 4);
        let spriteY = this.readByte(spriteAddress) - 16; // Offset for display window.
        let spriteX = this.readByte(spriteAddress+1) - 8; // Offset for display window.
        let tileId = this.readByte(spriteAddress+2);
        let attributes = this.readByte(spriteAddress+3);
        
        // TODO: Get sprite priority.

        let pixels = [];
        let tileAddress = 0x8000 + (tileId * 16);

        for (let y = 0; y < height; y++) {
            pixels[y] = [];

            let lb = this.readByte(tileAddress + (y*2));
            let hb = this.readByte(tileAddress + (y*2) + 1);
            for (let x = 0; x < 8; x++) {
                let l = lb&(1<<(7-x))?1:0;
                let h = hb&(1<<(7-x))?1:0;
                let color = (h<<1)+l;

                pixels[y][x] = color;
            }
        }

        return {
            id: spriteId,
            address: spriteAddress,
            tileId: tileId,
            x: spriteX,
            y: spriteY,
            xFlip: !!(attributes&0x20),
            yFlip: !!(attributes&0x40),            
            pixels: pixels,
            palette: attributes&0x10 ? this.readByte(0xFF49) : this.readByte(0xFF48),
            paletteId: attributes&0x10,
            priority: attributes&0x80
        }
    },

    updatePalette: function () {
        switch (Cartridge._header.checksum) {
            case 0x3C: this.palette_3C(); break;
            case 0x46: this.palette_46(); break;
            case 0x61: this.palette_61(); break;
            case 0x70: this.palette_70(); break;
        }
    },

    renderBackgroundTileMap: function () {
        // Check if window is enabled.
        let windowEnabled = !!(this._register.lcdc&0x20);
        let tilemapRegion = 0;
        
        if (windowEnabled) {
            if (this._register.lcdc & 0x40) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        } else {
            if (this._register.lcdc & 0x08) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        }
        
        // Get tileset region.
        let tilesetRegion = 0;
        let unsignedTiles = true;
        if (this._register.lcdc & 0x10) {
            tilesetRegion = 0x8000; // 0x8000 - 0x8FFF
        } else {
            tilesetRegion = 0x8800; // 0x8800 - 0x97FF
            unsignedTiles = false;
        }        

        // Load color palette for background.
        let palette = this.readByte(0xFF47);        

        let color0 = this._bgColors[palette&0x3];
        let color1 = this._bgColors[(palette>>2)&0x3];
        let color2 = this._bgColors[(palette>>4)&0x3];
        let color3 = this._bgColors[(palette>>6)&0x3];        

        // Build map.
        for (let ty = 0; ty < 32; ty++) {
            for (let tx = 0; tx < 32; tx++) {
                // Find tile.
                let tileId = this.readByte(tilemapRegion + (32 * ty + tx));

                if (!unsignedTiles) {
                    // Adjust for signed byte.
                    if (tileId > 127) tileId = -((~tileId+1)&255);
                    tileId += 128;
                }

                let tileAddress = tilesetRegion + (tileId * 16);
                let address = 0;
                for (let py = 0; py < 8; py++) {
                    let lb = this.readByte(tileAddress + address++);
                    let hb = this.readByte(tileAddress + address++);

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
                        this._colorMap[index] = pixelColor;
                    }
                }
            }
        }

        let screenData = this._bgMapCanvas.getImageData(0, 0, 256, 256);

        for (let y = 0; y < 256; y++){
            for (let x = 0; x < 256; x++){
                bgIndex = 256 * y + x;
                screenIndex = 256 * (y*4) + (x*4);

                screenData.data[screenIndex]   = (this._colorMap[bgIndex]>>16)&255;
                screenData.data[screenIndex+1] = (this._colorMap[bgIndex]>>8)&255;
                screenData.data[screenIndex+2] = this._colorMap[bgIndex]&255;
                screenData.data[screenIndex+3] = 255;
            }
        }

        this._bgMapCanvas.putImageData(screenData, 0, 0);
    },

    renderSpriteMap: function () {
        let spriteMap = [];
        
        for (let sY = 0; sY < 4; sY++) {
            for (let sX = 0; sX < 10; sX++) {
                let spriteId = 10 * sY + sX;
                let sprite = this.getSprite(spriteId, 8);

                let color0 = this._bgColors[sprite.palette&0x3];
                let color1 = this._bgColors[(sprite.palette>>2)&0x3];
                let color2 = this._bgColors[(sprite.palette>>4)&0x3];
                let color3 = this._bgColors[(sprite.palette>>6)&0x3]; 

                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++){
                        let pixelColor = 0;

                        switch (sprite.pixels[y][x]) {
                            case 0: pixelColor = 0xFFFFFF; break;
                            case 1: pixelColor = color1; break;
                            case 2: pixelColor = color2; break;
                            case 3: pixelColor = color3; break;
                        }

                        let pixel = 80 * ((sY*8)+y) + ((sX*8)+x);
                        spriteMap[pixel] = pixelColor;
                    }                    
                }
            }
        }

        let spriteData = this._spriteMapCanvas.getImageData(0, 0, 80, 32);

        for (let y = 0; y < 32; y++){
            for (let x = 0; x < 80*4; x++) {
                let pixelIndex = 80 * y + x;
                let imageIndex = 80 * (y*4) + (x*4);

                spriteData.data[imageIndex]   = (spriteMap[pixelIndex]>>16)&255;
                spriteData.data[imageIndex+1] = (spriteMap[pixelIndex]>>8)&255;
                spriteData.data[imageIndex+2] = spriteMap[pixelIndex]&255;
                spriteData.data[imageIndex+3] = 255;
            }
        }

        this._spriteMapCanvas.putImageData(spriteData, 0, 0);
    },

    renderTileMap: function () {
        let palette = this.readByte(0xFF47);        

        let color0 = this._bgColors[palette&0x3];
        let color1 = this._bgColors[(palette>>2)&0x3];
        let color2 = this._bgColors[(palette>>4)&0x3];
        let color3 = this._bgColors[(palette>>6)&0x3]; 

        this._tileMap = [];

        let offset = 0;
        let tileAddress = 0x8000;
        for (let ty = 0; ty < 24; ty++) {
            for (let tx = 0; tx < 16; tx++) {

                for (let py = 0; py < 8; py++) {
                    let lb = this.readByte(tileAddress + offset++);
                    let hb = this.readByte(tileAddress + offset++);

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

                        let index = 128 * ((ty*8)+py) + ((tx*8)+px);
                        this._tileMap[index] = pixelColor;
                    }
                }
            }
        }

        let tileData = this._tileMapCanvas.getImageData(0, 0, 128, 192);

        for (let y = 0; y < 192; y++){
            for (let x = 0; x < 128*4; x++) {
                let pixelIndex = 128 * y + x;
                let imageIndex = 128 * y * 4 + x * 4;

                tileData.data[imageIndex]   = (this._tileMap[pixelIndex]>>16)&255;
                tileData.data[imageIndex+1] = (this._tileMap[pixelIndex]>>8)&255;
                tileData.data[imageIndex+2] = this._tileMap[pixelIndex]&255;
                tileData.data[imageIndex+3] = 255;
            }
        }

        this._tileMapCanvas.putImageData(tileData, 0, 0);
    }
};

GPU.palette_3C = function () {
    GPU._bgColors = [0xFFFFFF, 0x63A5FF, 0x0000FF, 0x000000];
    GPU._obj0Colors = [0xFFFFFF, 0x63A5FF, 0x0000FF, 0x000000];
    GPU._obj1Colors = [0xFFFFFF, 0xFF8484, 0x943A3A, 0x000000];
}

GPU.palette_46 = function () {
    GPU._bgColors = [0xB5B5FF, 0xFFFF94, 0xAD5A42, 0x000000];
    GPU._obj0Colors = [0x000000, 0xFFFFFF, 0xFF8484, 0x943A3A];
    GPU._obj1Colors = [0x000000, 0xFFFFFF, 0xFF8484, 0x943A3A];
}

GPU.palette_61 = function () {
    GPU._bgColors = [0xFFFFFF, 0x63A5FF, 0x0000FF, 0x000000];
    GPU._obj0Colors = [0xFFFFFF, 0xFF8484, 0x943A3A, 0x000000];
    GPU._obj1Colors = [0xFFFFFF, 0x63A5FF, 0x0000FF, 0x000000];
}

GPU.palette_70 = function () {
    GPU._bgColors = [0xFFFFFF, 0xFF8484, 0x943A3A, 0x000000];
    GPU._obj0Colors = [0xFFFFFF, 0x00FF00, 0x318400, 0x004A00];
    GPU._obj1Colors = [0xFFFFFF, 0x63A5FF, 0x0000FF, 0x000000];
}

GPU.init();