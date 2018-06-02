GPU = {
    _mode: 0,
    _clock: 0,
    _scanLine: 0,

    _canvas: {},
    _screen: {},

    _colors: [
        "#9bbc0f",
        "#8bac0f",
        "#306230",
        "#0f380f"
    ],

    // Registers
    _register: {
        _lcdc: 0, // 0xFF40 (r/w) LCD control
        _scy: 0, // 0xFF42 (r/w) Scroll Y
        _ly: 0, // 0xFF44 (r) LCDC Y-coordinate
        _bgp: 0 // 0xFF47 (r/w) BG & Window palette
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
            default:            
                throw "GPU: No registers found @ 0x" + address.toString(16);
        }
    },

    writeByte: function (address, byte) {
        traceLog.write("GPU", "Writing to $ 0x" + address.toString(16) + " / Value: 0x" + byte.toString(16));
        switch (address) {            
            case 0xFF40:
                GPU._register._lcdc = byte;
                break;
            case 0xFF42:
                GPU._register._scy = byte;
                break;
            case 0xFF47:
                GPU._register._bgp = byte;
                break;
            default:
                throw "GPU: No registers found @ 0x" + address.toString(16);
        }
    },

    reset: function () {
        let c = document.getElementById('tile_set');

        if (c && c.getContext) {
            GPU._canvas = c.getContext('2d');

            if (GPU._canvas) {
                if (GPU._canvas.createImageData) 
                    GPU._screen = GPU._canvas.createImageData(160, 144);
                else if (GPU._canvas.getImageData)
                    GPU._screen = GPU._canvas.getImageData(0, 0, 160, 144);
                else
                    GPU._screen = {
                        'width': 160,
                        'height': 144,
                        'data': new Array(160*144*4)
                    };

                for (var i = 0; i < 160*144*4;) {
                    GPU._screen.data[i] = 0xEF;
                    GPU._screen.data[i+1] = 0xEF;
                    GPU._screen.data[i+2] = 0xEF;
                    GPU._screen.data[i+3] = 255;
                    i+=4;
                }

                traceLog.write("GPU", "Resetting screen.");
                GPU._canvas.putImageData(GPU._screen, 0, 0);
            }
        }
    },

    step: function () {
        // Step V Blank flag.
        // let interruptFlags = MMU.readByte(0xFF0F);
        // interruptFlags |= 0x01;
        // MMU.writeByte(0xFF0F, interruptFlags);
        GPU._register._ly++;
        if (GPU._register._ly > 153) GPU._register._ly = 0;        
    },

    renderTiles: function() {
        let offX = 0;
        let offY = 0;
        let tileIndex = 0;

        let palette = 0xFC; // MMU.readByte(0xFF47);

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