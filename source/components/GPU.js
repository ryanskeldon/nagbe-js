GPU = {
    // Memory
    _oam: [],

    _colors: [
        "#9bbc0f",
        "#8bac0f",
        "#306230",
        "#0f380f"
    ],

    _clock: 0,

    // Background Map
    _bgMapCanvas: {},
    _bgMapScreen: {},

    // Registers
    _register: {
        _lcdc: 0, // 0xFF40 (r/w) LCD control
        _scy: 0, // 0xFF42 (r/w) Scroll Y
        _ly: 0, // 0xFF44 (r) LCDC Y-coordinate
        _bgp: 0 // 0xFF47 (r/w) BG & Window palette
    },

    init: function () {
        for (var i = 0; i < 128; i++) GPU._oam[i] = 0;   // Sprite Attribute Memory (OAM)

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
    },

    readByte: function (address) {
        traceLog.write("GPU", "Reading from $ 0x" + address.toString(16));

        switch (address) {
            case 0xFF40:
                return GPU._register._lcdc;
            case 0xFF42:
                return GPU._register._scy;
            case 0xFF44:
                return GPU._register._ly;
            case 0xFF47:
                return GPU._register._bgp;
        }

        throw "GPU: Unable to read from @ 0x" + address.toString(16);
    },

    writeByte: function (address, byte) {
        traceLog.write("GPU", "Writing to $ 0x" + address.toString(16) + " / Value: 0x" + byte.toString(16));

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
                break;
            case 0xFF42:
                GPU._register._scy = byte;
                return;
                break;
            case 0xFF47:
                GPU._register._bgp = byte;
                return;
                break;
        }

        throw "GPU: Unable to write to @ 0x" + address.toString(16) + " / Value: 0x" + byte.toString(16);
    },

    step: function () {
        // Step V Blank flag.
        // let interruptFlags = MMU.readByte(0xFF0F);
        // interruptFlags |= 0x01;
        // MMU.writeByte(0xFF0F, interruptFlags);
        GPU._register._ly++;
        
        if (GPU._register._ly > 153) {
            GPU._register._ly = 0;        
        }
    },

    renderBackgroundTileMap: function () {
        // Determine which tile map to use.
        let tileMap = [];
        let tileMapOffset = 0;

        if (GPU._register._lcdc & 0x8) start = 0x9C00; // 0x9C00 - 0x9FFF
        else                           start = 0x9800; // 0x9800 - 0x9BFF
        for (var i = 0; i < 1024; i++) tileMap[i] = MMU.readByte(start+i);        

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
                let lb = MMU.readByte(tileOffset + address++);
                let hb = MMU.readByte(tileOffset + address++);

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
                        let color = tile.data[8 * py + px];

                        switch (color) {
                            case 0:
                                GPU._bgMapCanvas.fillStyle = color0;
                                break;
                            case 1:
                                GPU._bgMapCanvas.fillStyle = color1;
                                break;
                            case 2:
                                GPU._bgMapCanvas.fillStyle = color2;
                                break;
                            case 3:
                                GPU._bgMapCanvas.fillStyle = color3;
                                break;
                        }
    
                        GPU._bgMapCanvas.fillRect(px + (tx*8), py + (ty*8), 1, 1);
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