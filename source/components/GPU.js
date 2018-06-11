GPU = {
    // Memory
    _vram: [],
    _oam: [],

    _colors: [
        0x9bbc0f,
        0x8bac0f,
        0x306230,
        0x0f380f
    ],

    _mode: 0,
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
        _scy: 0, // 0xFF42 (r/w) Scroll Y
        _scx: 0, // 0xFF43 (r/w) Scroll X TODO: Fill in full memory address
        _ly: 0, // 0xFF44 (r) LCDC Y-coordinate
        _bgp: 0, // 0xFF47 (r/w) BG & Window palette
        _obj0: 0, // 0xFF48 (r/w) OBJ 0 Palette
        _obj1: 0, // 0xFF49 (r/w) OBJ 1 Palette
        _wy: 0, // 0xFF4A (r/w) Window Y position
        _wb: 0, // 0xFF4B (r/w) Window X position
    },

    init: function () {
        for (var i = 0; i < 8192; i++) GPU._vram[i] = Math.floor(Math.random() * 256); // Reset Video RAM (8kB)       
        for (var i = 0; i < 128; i++) GPU._oam[i]   = Math.floor(Math.random() * 256); // Sprite Attribute Memory (OAM) (128B)

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
        //traceLog.write("GPU", "Reading from $ 0x" + address.toString(16));

        if (address >= 0x8000 && address <= 0x9FFF) {
            return GPU._vram[address & 0x1FFF];
        }

        switch (address) {
            case 0xFF40:
                return GPU._register._lcdc;
            case 0xFF41:
                return GPU._register._stat;
            case 0xFF42:
                return GPU._register._scy;
            case 0xFF43:
                return GPU._register._scx;
            case 0xFF44:
                return GPU._register._ly;
            case 0xFF47:            
                return GPU._register._bgp;
            case 0xFF48:
                return GPU._register._obj0;
            case 0xFF49:
                return GPU._register._obj1;
            case 0xFF4A:
                return GPU._register._wy;
            case 0xFF4B:
                return GPU._register._wx;
        }

        throw "GPU: Unable to read from @ 0x" + address.toString(16);
    },

    writeByte: function (address, byte) {
        //traceLog.write("GPU", "Writing to $ 0x" + address.toString(16) + " / Value: 0x" + byte.toString(16));

        // Video RAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            // TODO: Check if tile or map data modified.            
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
            case 0xFF40:
                GPU._register._lcdc = byte;
                return;
            case 0xFF41:
                GPU._register._stat = byte;
                return;
            case 0xFF42:
                GPU._register._scy = byte;
                return;
            case 0xFF43:
                GPU._register._scx = byte;
                return;                
            case 0xFF47:
                GPU._register._bgp = byte;                
                return;
            case 0xFF48:
                GPU._register._obj0 = byte;
                return;
            case 0xFF49:
                GPU._register._obj1 = byte;
                return;
            case 0xFF4A:
                GPU._register._wy = byte;
                return;
            case 0xFF4B:
                GPU._register._wx = byte;
                return;
        }

        throw "GPU: Unable to write to @ 0x" + address.toString(16) + " / Value: 0x" + byte.toString(16);
    },

    step: function () {
        // Skip execution if LCD is not enabled.
        if (!(MMU.readByte(0xFF40)&0x80)) return;

        GPU._clock += Z80._register.t; // Add last instruction's clock length.

        if (GPU._clock >= 456) {
            GPU._register._ly++;
        }

        if (GPU._register._ly === 144) {
            GPU.drawScreen();            
            Z80.requestInterrupt(0x01);
        }

        if (GPU._register._ly > 153) {            
            GPU._register._ly = 0;
        }            

        switch (GPU._mode) {
            case 0:
                break;
            case 1:
                break;
            case 2:
                break;
            case 3:
                break;
        }        
    },

    readLine: function () {
        for (var x = 0; x < 160; x++) {
            GPU._linePixelData[x] = Math.floor(Math.random() * 4);
        }
    },

    drawLine: function () {
        // Load color palette for background.
        let palette = MMU.readByte(0xFF47);

        let color0 = GPU._colors[palette&0x3];
        let color1 = GPU._colors[(palette>>2)&0x3];
        let color2 = GPU._colors[(palette>>4)&0x3];
        let color3 = GPU._colors[(palette>>6)&0x3];

        // Get screen data.
        let screenData = GPU._screenCanvas.getImageData(0, 0, 160, 144);

        for (var x = 0; x < 160; x++) {
            let color = GPU._linePixelData[x];

            let pixelIndex = 4 * x + GPU._register._ly;
            screenData.data[pixelIndex] = Math.floor(Math.random() * 256);
            screenData.data[pixelIndex+1] = Math.floor(Math.random() * 256);
            screenData.data[pixelIndex+2] = Math.floor(Math.random() * 256);
            screenData.data[pixelIndex+3] = 255;
        }
 
        GPU._screenCanvas.putImageData(screenData, 0, 0);
    },

    drawScreen: function() {
        GPU.renderBackgroundTileMap();
        // Load color palette for background.
        // let palette = MMU.readByte(0xFF47);

        // let color0 = GPU._colors[palette&0x3];
        // let color1 = GPU._colors[(palette>>2)&0x3];
        // let color2 = GPU._colors[(palette>>4)&0x3];
        // let color3 = GPU._colors[(palette>>6)&0x3];

        // Get screen data.
        let bgData = GPU._bgMapScreen;
        let screenData = GPU._screenCanvas.getImageData(0, 0, 160, 144);

        let sx = GPU._register._scx; let sy = GPU._register._scy;

        for (let y = 0; y < 144; y++){
            for (let x = 0; x < 160*4; x++){
                bgIndex = 256 * ((sy+y)%256) + ((sx+x)%256);
                screenIndex = 160*4 * y + x*4;

                screenData.data[screenIndex] = (GPU._colorMap[bgIndex]>>16)&255;
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
    },

    renderTiles: function() {
        let offX = 0;
        let offY = 0;
        let tileIndex = 0;

        let palette = MMU.readByte(0xFF47);

        let color0 = GPU._colors[palette&0x3];
        let color1 = GPU._colors[(palette>>2)&0x3];
        let color2 = GPU._colors[(palette>>4)&0x3];
        let color3 = GPU._colors[(palette>>6)&0x3];
    
        for (var addr = 0x8000; addr <= 0x97FF; ) {
            for (var y = 0; y < 8; y++) {
                let lb = MMU._vram[addr++&0x1FFF];
                let hb = MMU._vram[addr++&0x1FFF];

                for (var x = 0; x < 8; x++) {
                    var color = ((hb>>(6-x))&2) + ((lb>>(7-x))&1);                   

                    switch (color) {
                        case 0:
                            GPU._canvas.fillStyle = color0;
                            break;
                        case 1:
                            GPU._canvas.fillStyle = color3;
                            break;
                        case 2:
                            GPU._canvas.fillStyle = color3;
                            break;
                        case 3:
                            GPU._canvas.fillStyle = color3;
                            break;
                    }

                    GPU._canvas.fillRect(x+offX, y+offY, 1, 1);
                }
            }
            tileIndex++;
            offX+=8;
            if (offX >= 256) {
                offX = 0;
                offY +=8;
            }
        }
    }
};

GPU.init();