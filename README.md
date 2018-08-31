# nagbe-js
Not Another Game Boy Emulator

![Tetris](https://i.imgur.com/hnM4nC5.gif) ![Super Mario Land](https://i.imgur.com/suxozFx.gif) ![Dr. Mario](https://i.imgur.com/O8LCaIv.gif)

## Features
 Completed:
 * Joypad - Keyboard controls
 * Memory bank controllers 1 and 2 fully implemented with battery (uses browser storage).
 * Simple debugger to output CPU registers.
 * Scanline level rendering
 
 Planned/WIP:
 * Memory Bank Controller #3 partially implemented. RTC not functional.
 * Game controller support through HTML5 Gamepad API.
 * Proper rendering of sprite priority.
 * Gameboy Color support.
 
 Not Planned:
 * Sound - Might implement after refactor for Gameboy Color support, though probably not going to happen.
 * Serial port functionality

## References
 * [Imran Nazar: Gameboy Emulation in JavaScript](http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-The-CPU)
 * [Codeslinger: Emulating the Gameboy](http://www.codeslinger.co.uk/pages/projects/gameboy.html)
 * [Gameboy CPU Manual](http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf)
 * [Pandocs](http://bgb.bircd.org/pandocs.htm)
 * [java-gb by Pablo Canseco](https://github.com/pmcanseco/java-gb)
