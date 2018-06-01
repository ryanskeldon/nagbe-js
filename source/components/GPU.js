function setup() {
    createCanvas(256, 352);
    background(0xEE);
    noLoop();
}

GPU = {
    renderScreen: function() {
        background(0xEE);
        let offX = 0;
        let offY = 256;
        let tileIndex = 0;
    
        for (var addr = 0x8000; addr <= 0x97FF; ) {
            for (var y = 0; y < 8; y++) {
                let hb = MMU.readByte(addr++);
                let lb = MMU.readByte(addr++);

                for (var x = 0; x < 8; x++) {
                    var color = ((hb>>(7-x))&1)<<1 + ((lb>>(7-x))&1);

                    switch (color) {
                        case 0:
                            stroke(0xFF);
                            break;
                        case 1:
                            stroke(0xAC);
                            break;
                        case 2:
                            stroke(0x56);
                            break;
                        case 3:
                            stroke(0x00);
                            break;
                    }

                    point(x+offX,y+offY);
                }
            }
            tileIndex++;
            offX+=8;
            if (offX >= width) {
                offX = 0;
                offY +=8;
            }
        }

        console.log(tileIndex);
        redraw();
    }
};