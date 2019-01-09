export default class GPU {
    constructor(system) {
        this.system = system;

        this.displayScale = 2;
        this.screenWidth = 160;
        this.screenHeight = 144;

        this.vram = [];
        this.oam = [];

        this.frameBuffer = [];

        for (let i = 0; i < 8192; i++) this.vram[i] = Math.floor(Math.random() * 256); // Reset Video RAM (8kB)       
        for (let i = 0; i < 160; i++) this.oam[i] = Math.floor(Math.random() * 256); // Sprite Attribute Memory (OAM) (160B)

        // DMA
        this.oamDmaActive = false;
        this.oamDmaByte = 0;

        // Registers
        this.register = {
            lcdc: 0, // $FF40 (r/w) LCD control
            stat: 0, // $FF41 (r/w) LCDC Status
            scy: 0, // $FF42 (r/w) Scroll Y
            scx: 0, // $FF43 (r/w) Scroll X TODO: Fill in full memory address
            ly: 0, // $FF44 (r) LCDC Y-coordinate
            lyc: 0, // $FF45 (r/w) LY Compare
            dma: 0, // $FF46 (w) DM Transfer & Start Address
            bgp: 0, // $FF47 (r/w) BG & Window palette
            obj0: 0, // $FF48 (r/w) OBJ 0 Palette
            obj1: 0, // $FF49 (r/w) OBJ 1 Palette
            wy: 0, // $FF4A (r/w) Window Y position
            wx: 0, // $FF4B (r/w) Window X position

            vbk: 0, // $FF4F VRAM Bank

            hdma1: 0, // $FF51 New DMA source, high
            hdma2: 0, // $FF52 New DMA source, low
            hdma3: 0, // $FF53 New DMA destination, high
            hdma4: 0, // $FF54 New DMA destination, low
            hdma5: 0, // $FF55 New DMA length/mode/start

            bgpi: 0, // $FF68 Background Palette Index
            bgpd: 0, // $FF69 Background Palette Data
            obpi: 0, // $FF6A Sprite Palette Index
            obpd: 0, // $FF6B Sprite Palette Data
        };

        this.bgColors = [
            0xE0F8D0, // White
            0x88C070, // Light Grey
            0x346856, // Dark Grey
            0x081820 // Black
        ];

        this.obj0Colors = [
            0xE0F8D0, // White
            0x88C070, // Light Grey
            0x346856, // Dark Grey
            0x081820 // Black
        ];

        this.obj1Colors = [
            0xE0F8D0, // White
            0x88C070, // Light Grey
            0x346856, // Dark Grey
            0x081820 // Black
        ];

        this.clock = 0;

        // Initialize screen.
        this.backgroundMapElement = document.getElementById("screen");
        this.screenCanvas = this.backgroundMapElement.getContext("2d");
        this.screenData = this.screenCanvas.createImageData(this.screenWidth * this.displayScale, this.screenHeight * this.displayScale);

        for (let i = 0; i < this.screenWidth * this.displayScale * this.screenHeight * this.displayScale * 4;) {
            this.screenData.data[i] = 0xEF;
            this.screenData.data[i + 1] = 0xEF;
            this.screenData.data[i + 2] = 0xEF;
            this.screenData.data[i + 3] = 0xFF;
            i += 4;
        }

        this.screenCanvas.putImageData(this.screenData, 0, 0);
    }

    readByte(address) {
        if (address >= 0x8000 && address <= 0x9FFF) {
            return this.vram[(address - 0x8000) + (this.register.vbk * 0x2000)];
        }

        // Sprite Attribute Memory
        if (address >= 0xFE00 && address <= 0xFE9F) {
            return this.oam[address - 0xFE00];
        }

        switch (address) {
            case 0xFF40:
                return this.register.lcdc;
            case 0xFF41:
                let stat = this.register.stat;

                // Bit 7 is unused and always returns 1.
                stat |= 0x80;

                // Bits 0-2 return 0 when LCD is off.
                if (!this.isLcdEnabled()) stat &= ~(0x07);

                return stat;
            case 0xFF42:
                return this.register.scy;
            case 0xFF43:
                return this.register.scx;
            case 0xFF44:
                let ly = this.register.ly;

                // When the LCD is off, LY is fixed at 0.
                if (!this.isLcdEnabled()) ly = 0;

                return ly;
            case 0xFF45:
                return this.register.lyc;
            case 0xFF46:
                return this.register.dma;
            case 0xFF47:
                return this.register.bgp;
            case 0xFF48:
                return this.register.obj0;
            case 0xFF49:
                return this.register.obj1;
            case 0xFF4A:
                return this.register.wy;
            case 0xFF4B:
                return this.register.wx;
            case 0xFF4F:
                return this.register.vbk;
        }

        throw `GPU: Unknown read at $${address.toHex(4)}`;
    }

    writeByte(address, byte) {
        // Video RAM
        if (address >= 0x8000 && address <= 0x9FFF) {
            this.vram[(address - 0x8000) + (this.register.vbk * 0x2000)] = byte;
            return;
        }

        // Sprite Attribute Memory
        if (address >= 0xFE00 && address <= 0xFE9F) {
            this.oam[address - 0xFE00] = byte;
            return;
        }

        // GPU Registers
        switch (address) {
            case 0xFF40:
                this.register.lcdc = byte;
                return;
            case 0xFF41:
                this.register.stat = byte;
                return;
            case 0xFF42:
                this.register.scy = byte;
                return;
            case 0xFF43:
                this.register.scx = byte;
                return;
            case 0xFF44:
                this.register.ly = 0;
                return; // Note: any outside write to LY resets the value to 0;
            case 0xFF45:
                this.register.lyc = byte;
                return;
            case 0xFF46:
                this.register.dma = byte;
                this.initializeOAM_DMA();
                return;
            case 0xFF47:
                this.register.bgp = byte;
                return;
            case 0xFF48:
                this.register.obj0 = byte;
                return;
            case 0xFF49:
                this.register.obj1 = byte;
                return;
            case 0xFF4A:
                this.register.wy = byte;
                return;
            case 0xFF4B:
                this.register.wx = byte;
                return;
            case 0xFF4F:
                this.register.vbk = byte;
                return;
        }

        throw `GPU: Unknown write at $${address.toHex(4)} / value: 0x${byte.toHex(2)}`;
    }

    initializeOAM_DMA() {
        this.oamDmaActive = true;
        this.oamDmaByte = 0;
    }

    isLcdEnabled() {
        return !!(this.register.lcdc & 0x80);
    }

    getLcdMode() {
        return this.register.stat & 0x03;
    }

    setLcdMode(mode) {
        this.register.stat &= ~0x03; // Clear mode.
        this.register.stat |= mode; // Set mode.
    }

    step(cycles) {
        // Process OAM DMA transfer.
        if (this.oamDmaActive) {
            const address = this.register.dma << 8;
            let cyclesToProcess = cycles / 4;

            for (let i = 0; i < cyclesToProcess; i++) {
                this.system.mmu.writeByte(0xFE00 + this.oamDmaByte, this.system.mmu.readByte(address + this.oamDmaByte));
                this.oamDmaByte++;
            }

            if (this.oamDmaByte >= 160) {
                // Transfer complete
                this.oamDmaActive = false;
                this.oamDmaByte = 0;
            }
        }

        if (this.isLcdEnabled()) {
            this.clock = (this.clock + cycles) & 0xFFFFFFFF;
        } else {
            this.setLcdMode(1);
            return;
        }

        // Set LCD status.
        let currentMode = this.getLcdMode();
        let mode = null;
        let interruptRequested = false;

        if (this.register.ly < 144) {
            if (this.clock <= 80) {
                // Mode 2
                mode = 2;
                interruptRequested = !!(this.register.stat & 0x20);
            } else if (this.clock >= 80 && this.clock < 252) {
                // Mode 3
                mode = 3;
            } else if (this.clock >= 252 && this.clock < 456) {
                // Mode 0
                mode = 0;
                interruptRequested = !!(this.register.stat & 0x08);
            }
        } else {
            // Mode 1
            mode = 1;
            interruptRequested = !!(this.register.stat & 0x10);
        }

        this.setLcdMode(mode);

        // Request interrupt if modes changed and interrupt requested for LCD stat.
        if (currentMode != mode && interruptRequested) {
            this.system.requestInterrupt(1);
        }

        // Check for coincidence flag.
        if (this.register.ly === this.register.lyc) {
            // Set coincidence flag, lines match.
            this.register.stat |= 0x04;

            if (this.register.stat & 0x40) this.system.requestInterrupt(1);
        } else {
            // Reset coincidence flag, lines don't match.
            this.register.stat &= ~0x04;
        }

        if (this.clock >= 456) {
            if (this.register.ly < 144)
                this.renderScanline();

            this.clock = 0;
            this.register.ly++;

            if (this.register.ly == 144) {
                this.system.requestInterrupt(0);
            } else if (this.register.ly > 153) {
                this.register.ly = 0;
                this.drawScreen();
            }
        }
    }

    renderScanline() {
        const pixels = [];

        const sx = this.register.scx;
        const sy = this.register.scy;
        const wx = this.register.wx - 7;
        const wy = this.register.wy;
        const ly = this.register.ly;

        // Check if window is enabled.
        const windowEnabled = !!(this.register.lcdc & 0x20) && wy <= ly;
        let tilemapRegion = 0;

        if (windowEnabled) {
            if (this.register.lcdc & 0x40) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        } else {
            if (this.register.lcdc & 0x08) {
                tilemapRegion = 0x9C00; // 0x9C00 - 0x9FFF
            } else {
                tilemapRegion = 0x9800; // 0x9800 - 0x9BFF
            }
        }

        // Get tileset region.
        let tilesetRegion = 0;
        let unsignedTiles = true;
        if (this.register.lcdc & 0x10) {
            tilesetRegion = 0x8000; // 0x8000 - 0x8FFF
        } else {
            tilesetRegion = 0x8800; // 0x8800 - 0x97FF
            unsignedTiles = false;
        }

        // Load color palette for background.
        const bgPalette = this.readByte(0xFF47);

        // Calculate which scanline we're on.
        let yPos = 0;
        if (windowEnabled)
            yPos = ly - wy;
        else
            yPos = (sy + ly) % 256;

        // Generate background / window pixels
        for (let x = 0; x < 160; x++) {
            let xPos = (sx + x) % 256;

            if (windowEnabled && x >= wx) {
                xPos = x - wx;
            }

            let tx = (xPos / 8) & 255;
            let ty = (yPos / 8) & 255;
            let tileId = this.readByte(tilemapRegion + (32 * ty + tx));

            if (!unsignedTiles) {
                // Adjust for signed byte.
                if (tileId > 127) tileId = -((~tileId + 1) & 255);
                tileId += 128;
            }

            // Find tile pixel data for color.
            let tileAddress = tilesetRegion + (tileId * 16);
            let px = 0;
            let py = 0;
            if (windowEnabled) {
                px = (x - wx) % 8;
                py = (ly - wy) % 8;
            } else {
                px = (sx + x) % 8;
                py = (sy + ly) % 8;
            }
            let pixelRow = py * 2;
            let lb = this.readByte(tileAddress + pixelRow);
            let hb = this.readByte(tileAddress + pixelRow + 1);

            let l = lb & (1 << (7 - px)) ? 1 : 0;
            let h = hb & (1 << (7 - px)) ? 1 : 0;
            const colorCode = (h << 1) + l;
            let pixelColor = 0;

            switch (colorCode) {
                case 0:
                    pixelColor = this.bgColors[bgPalette & 0x03];
                    break;
                case 1:
                    pixelColor = this.bgColors[(bgPalette >> 2) & 0x3];
                    break;
                case 2:
                    pixelColor = this.bgColors[(bgPalette >> 4) & 0x3];
                    break;
                case 3:
                    pixelColor = this.bgColors[(bgPalette >> 6) & 0x3];
                    break;
            }

            pixels[x] = { code: colorCode, color: pixelColor, type: "BG" };
        }

        // Load sprites
        if (this.register.lcdc & 0x02) {
            let renderedSprites = 0;

            for (let spriteId = 0; spriteId < 40; spriteId++) {
                const height = this.register.lcdc & 0x04 ? 16 : 8;
                const sprite = this.getSprite(spriteId, height);

                if (ly >= sprite.y && ly < (sprite.y + height)) {
                    for (let tx = 0; tx < 8; tx++) {
                        // Load color palette for background.
                        const palette = sprite.paletteId == 0 ? this.obj0Colors : this.obj1Colors;
                        let py = ly - sprite.y;

                        if (sprite.yFlip) {
                            py -= height - 1;
                            py *= -1;
                        }

                        // Find tile pixel data for color.
                        let px = tx;
                        if (sprite.xFlip) {
                            px -= 7;
                            px *= -1;
                        }

                        const colorCode = sprite.pixels[py % height][px % 8];
                        if (colorCode === 0) continue; // Pixel is white meaning transparent.

                        let pixelColor = 0;

                        switch (colorCode) {
                            case 0:
                                pixelColor = palette[sprite.palette & 0x3];;
                                break;
                            case 1:
                                pixelColor = palette[(sprite.palette >> 2) & 0x3];
                                break;
                            case 2:
                                pixelColor = palette[(sprite.palette >> 4) & 0x3];
                                break;
                            case 3:
                                pixelColor = palette[(sprite.palette >> 6) & 0x3];
                                break;
                        }

                        const pixel = sprite.x + tx;

                        if (sprite.priority === 0) {
                            // Priority 0: sprite above background.                            
                            pixels[pixel] = { code: colorCode, color: pixelColor, type: "OBJ", objId: spriteId };
                        } else if (sprite.priority === 1) {
                            const currentPixel = pixels[pixel];
                            if (currentPixel && currentPixel.type === "BG" && currentPixel.code !== (bgPalette & 0x3)) continue;

                            pixels[pixel] = { code: colorCode, color: pixelColor, type: "OBJ", objId: spriteId };
                        } else {
                            throw "Invalid sprite priority";
                        }
                    }

                    renderedSprites++;

                    // Limit 10 sprites per line.
                    if (renderedSprites == 10) break;
                }
            }
        }

        this.frameBuffer[ly] = pixels;
    }

    drawScreen() {
        let screenData = this.screenCanvas.getImageData(0, 0, this.screenWidth * this.displayScale, this.screenHeight * this.displayScale);

        for (let y = 0; y < this.screenHeight; y++) {
            for (let x = 0; x < this.screenWidth; x++) {
                let pixel = this.frameBuffer[y][x];

                for (let sy = 0; sy < this.displayScale; sy++) {
                    for (let sx = 0; sx < this.displayScale; sx++) {
                        const screenIndex = (this.screenWidth * this.displayScale * 4) * ((y * this.displayScale) + sy) + ((x * this.displayScale) + sx) * 4;

                        screenData.data[screenIndex] = (pixel.color >> 16) & 255;
                        screenData.data[screenIndex + 1] = (pixel.color >> 8) & 255;
                        screenData.data[screenIndex + 2] = pixel.color & 255;
                        screenData.data[screenIndex + 3] = 255;
                    }
                }
            }
        }

        this.screenCanvas.putImageData(screenData, 0, 0);
    }

    getSprite(spriteId, height) {
        let spriteAddress = 0xFE00 + (spriteId * 4);
        let spriteY = this.readByte(spriteAddress) - 16; // Offset for display window.
        let spriteX = this.readByte(spriteAddress + 1) - 8; // Offset for display window.
        let tileId = this.readByte(spriteAddress + 2);
        let attributes = this.readByte(spriteAddress + 3);

        // TODO: Get sprite priority.

        let pixels = [];
        let tileAddress = 0x8000 + (tileId * 16);

        for (let y = 0; y < height; y++) {
            pixels[y] = [];

            let lb = this.readByte(tileAddress + (y * 2));
            let hb = this.readByte(tileAddress + (y * 2) + 1);
            for (let x = 0; x < 8; x++) {
                let l = lb & (1 << (7 - x)) ? 1 : 0;
                let h = hb & (1 << (7 - x)) ? 1 : 0;
                let color = (h << 1) + l;

                pixels[y][x] = color;
            }
        }

        return {
            id: spriteId,
            address: spriteAddress,
            tileId: tileId,
            x: spriteX,
            y: spriteY,
            xFlip: !!(attributes & 0x20),
            yFlip: !!(attributes & 0x40),
            pixels: pixels,
            palette: attributes & 0x10 ? this.readByte(0xFF49) : this.readByte(0xFF48),
            paletteId: attributes & 0x10,
            priority: attributes >> 7
        };
    }
}