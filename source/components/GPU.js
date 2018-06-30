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
        for (var i = 0; i < 8192; i++) GPU._vram[i] = Math.floor(Math.random() * 256);  // Reset Video RAM (8kB)       
        for (var i = 0; i < 128; i++)  GPU._oam[i]   = Math.floor(Math.random() * 256); // Sprite Attribute Memory (OAM) (128B)

        // Initialize background map.
        let backgroundMapElement = document.getElementById("map");
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
            GPU._oam[address & 0x7F] = byte;
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

        switch (GPU.getLcdMode()) {
            case 2:
                if (GPU._clock >= 80) {
                    // Enter scanline mode 3
                    GPU._clock = 0;
                    GPU.setLcdMode(3);
                }
                break;
            case 3:
                if (GPU._clock >= 172) {
                    // Enter H-Blank
                    GPU._clock = 0;
                    GPU.setLcdMode(0);
                    GPU.renderScanline();
                }
                break;
            case 0:
                if (GPU._clock >= 204) {
                    GPU._clock = 0;
                    GPU._register._ly++;

                    if (GPU._register._ly == 143) {
                        GPU.setLcdMode(1);
                        GPU.drawScreen();
                        Z80.requestInterrupt(0x01);                        
                    } else {
                        GPU.setLcdMode(2);
                    }
                }
                break;
            case 1:
                if (GPU._clock >= 456) {
                    GPU._clock = 0;
                    GPU._register._ly++;

                    if (GPU._register._ly > 153) {
                        GPU.setLcdMode(2);
                        GPU._register._ly = 0;
                    }
                }
                break;
        }

        if (GPU._register._ly > 153) throw `GPU ERROR: LY out of range ${GPU._register._ly}`;
    },

    renderScanline: function () { },

    drawLine: function () {
        let unsignedTiles = true; // Used when in tile data is signed.
        let scrollY = GPU._register._scy;
        let scrollX = GPU._register._scx;
        let windowY = GPU._register._wy;
        let windowX = GPU._register._wx - 7; // Added offset for visibility.
        let usingWindow = GPU._register._lcdc&0x20 && windowY <= GPU._register._ly; // Is window enabled and visible?

        // Load tiles for background map.
        let tileOffset = 0;

        if (GPU._register._lcdc & 0x10)
            tileOffset = 0x8000; // 0x8000 - 0x8FFF
        else {
            tileOffset = 0x8800; // 0x8800 - 0x97FF
            unsignedTiles = false;
        }

        let bgMapOffset = 0;
        if (usingWindow) {
            if (GPU._register._lcdc&0x40) bgMapOffset = 0x9C00;
            else                          bgMapOffset = 0x9800;
        } else {
            if (GPU._register._lcdc&0x08) bgMapOffset = 0x9C00;
            else                          bgMapOffset = 0x9800;
        }
        
        let yPos = 0;

        if (usingWindow)
            yPos = GPU._register._ly - windowY;
        else
            yPos = scrollY + GPU._register._ly;

        let tileRow = (yPos/8)*32;
        
        for (let pixel = 0; pixel < 160; pixel++) {
            let xPos = pixel + scrollX;

            if (usingWindow && pixel >= windowX)
                xPos = pixel - windowX;

            let tileCol = xPos/8;
            let tileNum = 0;
            let tileAddress = bgMapOffset+tileRow+tileCol;

            if (unsignedTiles)
                tileNum = MMU.readByte(tileAddress);
            else
                tileNum = -((~MMU.readByte(tileAddress)+1)&255);

            let tileLocation = tileOffset;

            if (unsignedTiles)
                tileLocation += (tileNum*16);
            else
                tileLocation += ((tileNum+128)*16);

            let line = yPos%8;
            line *= 2;
            let data1 = GPU.readByte(tileLocation+line);
            let data2 = GPU.readByte(tileLocation+line+1);

            let colorBit = xPos%8;
            colorBit -= 7;
            colorBit *= -1;

            let colorNum = data2&colorBit;
            colorNum <<= 1;
            colorNum |= data1&colorBit;

            let palette = GPU.readByte(0xFF47);
            let color0 = GPU._colors[palette&0x3];
            let color1 = GPU._colors[(palette>>2)&0x3];
            let color2 = GPU._colors[(palette>>4)&0x3];
            let color3 = GPU._colors[(palette>>6)&0x3];

            let pixelColor = 0;

            switch (colorNum) {
                case 0:
                    pixelColor = color0;
                    break;
                case 1:
                    pixelColor = color1;
                    break;
                case 2:
                    pixelColor = color2;
                    break;
                case 3:
                    pixelColor = color3;
                    break;
            }

            let finalY = GPU._register._ly;

            if (finalY < 0 || finalY > 143 || pixel < 0 || pixel > 159) continue;

            let r = (pixelColor>>16)&255;
            let g = (pixelColor>>8)&255;
            let b = pixelColor&255;
            GPU._screenCanvas.fillStyle = `rgb(${r}, ${g}, ${b})`;
            GPU._screenCanvas.fillRect(pixel, finalY, 1, 1);

            //let screenData = GPU._screenCanvas.getImageData(0, 0, 160, 144);

            //let sx = GPU._register._scx; let sy = GPU._register._scy;
            // let screenIndex = 160*4 * GPU._register._ly + pixel*4;    
    
            // screenData.data[screenIndex]   = r;
            // screenData.data[screenIndex+1] = g;
            // screenData.data[screenIndex+2] = b;
            // screenData.data[screenIndex+3] = 255;
    
            // GPU._screenCanvas.putImageData(screenData, 0, 0);
        }
    },

    drawScreen: function() {
        GPU.renderBackgroundTileMap();

        // Get screen data.
        let bgData = GPU._bgMapScreen;
        let screenData = GPU._screenCanvas.getImageData(0, 0, 160, 144);

        let sx = GPU._register._scx; let sy = GPU._register._scy;

        for (let y = 0; y < 144; y++){
            for (let x = 0; x < 160*4; x++){
                bgIndex = 256 * ((sy+y)%256) + ((sx+x)%256);
                screenIndex = 160*4 * y + x*4;

                screenData.data[screenIndex]   = (GPU._colorMap[bgIndex]>>16)&255;
                screenData.data[screenIndex+1] = (GPU._colorMap[bgIndex]>>8)&255;
                screenData.data[screenIndex+2] = GPU._colorMap[bgIndex]&255;
                screenData.data[screenIndex+3] = 255;
            }
        }

        GPU._screenCanvas.putImageData(screenData, 0, 0);
    },

    renderBackgroundTileMap: function () {
        // Determine which tile map to use.
        let tileMap = [];
        let tileMapOffset = 0;

        if (GPU._register._lcdc & 0x8) tileMapOffset = 0x9C00; // 0x9C00 - 0x9FFF
        else                           tileMapOffset = 0x9800; // 0x9800 - 0x9BFF
        for (var i = 0; i < 1024; i++) tileMap[i] = MMU.readByte(tileMapOffset+i);        

        // Load tiles for background map.
        let tiles = [];
        let tileOffset = 0;

        if (GPU._register._lcdc & 0x10) tileOffset = 0x8000; // 0x8000 - 0x8FFF
        else                            tileOffset = 0x8800; // 0x8800 - 0x97FF

        for (var address = 0; address < 4096;) {
            let tileIndex = tiles.length;

            tiles[tileIndex] = {
                data: []
            };

            for (var y = 0; y < 8; y++) {
                let lb = GPU.readByte(tileOffset + address++);
                let hb = GPU.readByte(tileOffset + address++);

                for (var x = 0; x < 8; x++) {
                    let color = ((hb>>(6-x))&2) + ((lb>>(7-x))&1);
                    tiles[tileIndex].data[8 * y + x] = color;
                }
            }
        }

        // Load color palette for background.
        let palette = MMU.readByte(0xFF47);        

        let color0 = GPU._colors[palette&0x3];
        let color1 = GPU._colors[(palette>>2)&0x3];
        let color2 = GPU._colors[(palette>>4)&0x3];
        let color3 = GPU._colors[(palette>>6)&0x3];

        // Draw tiles.
        for (var ty = 0; ty < 32; ty++) {
            for (var tx = 0; tx < 32; tx++) {
                let tileId = tileMap[32 * ty + tx];
                let tile = tiles[tileId];                

                for (var py = 0; py < 8; py++) {
                    for (var px = 0; px < 8; px++) {
                        let colorCode = tile.data[8 * py + px];
                        let pixelColor = 0;

                        switch (colorCode) {
                            case 0:
                                pixelColor = color0;
                                break;
                            case 1:
                                pixelColor = color1;
                                break;
                            case 2:
                                pixelColor = color2;
                                break;
                            case 3:
                                pixelColor = color3;
                                break;
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
                bgIndex = 256 * ((y)%256) + ((x)%256);
                screenIndex = 256*4 * y + x*4;

                screenData.data[screenIndex]   = (GPU._colorMap[bgIndex]>>16)&255;
                screenData.data[screenIndex+1] = (GPU._colorMap[bgIndex]>>8)&255;
                screenData.data[screenIndex+2] = GPU._colorMap[bgIndex]&255;
                screenData.data[screenIndex+3] = 255;
            }
        }

        GPU._bgMapCanvas.putImageData(screenData, 0, 0);
    },

    // renderTiles: function() {
    //     let offX = 0;
    //     let offY = 0;
    //     let tileIndex = 0;

    //     let palette = MMU.readByte(0xFF47);

    //     let color0 = GPU._colors[palette&0x3];
    //     let color1 = GPU._colors[(palette>>2)&0x3];
    //     let color2 = GPU._colors[(palette>>4)&0x3];
    //     let color3 = GPU._colors[(palette>>6)&0x3];
    
    //     for (var addr = 0x8000; addr <= 0x97FF; ) {
    //         for (var y = 0; y < 8; y++) {
    //             let lb = MMU._vram[addr++&0x1FFF];
    //             let hb = MMU._vram[addr++&0x1FFF];

    //             for (var x = 0; x < 8; x++) {
    //                 var color = ((hb>>(6-x))&2) + ((lb>>(7-x))&1);                   

    //                 switch (color) {
    //                     case 0:
    //                         GPU._canvas.fillStyle = color0;
    //                         break;
    //                     case 1:
    //                         GPU._canvas.fillStyle = color3;
    //                         break;
    //                     case 2:
    //                         GPU._canvas.fillStyle = color3;
    //                         break;
    //                     case 3:
    //                         GPU._canvas.fillStyle = color3;
    //                         break;
    //                 }

    //                 GPU._canvas.fillRect(x+offX, y+offY, 1, 1);
    //             }
    //         }
    //         tileIndex++;
    //         offX+=8;
    //         if (offX >= 256) {
    //             offX = 0;
    //             offY +=8;
    //         }
    //     }
    // }
};

GPU.init();