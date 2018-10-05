let emu;
let easyjoypad;
document.addEventListener("DOMContentLoaded", () => {
    emu = new nagbe();
    easyjoypad = new EasyJoypad();
    easyjoypad.startListener((id, pressed) => {
        /* 360 Controller mapping
            A = 0
            B = 1
            X = 2
            Y = 3
            L1 = 4
            R1 = 5
            L2 = 6
            R2 = 7
            Select = 8
            Start = 9
            L3 = 10
            R3 = 11
            Up = 12
            Down = 13
            Left = 14
            Right = 15
        */

        const buttons = [
            15,
            14,
            12,
            13,
            1,
            0,
            8,
            9
        ]

        if (pressed) {
            emu.joypad.buttonPressed(buttons.indexOf(id));
        } else {
            emu.joypad.buttonReleased(buttons.indexOf(id));
        }            
    });

    document.getElementById("romFileSelect").addEventListener("change", function (e) {
        if (e.target.files.length === 0) return;
    
        emu.loadFile(this.files[0]);
    });
});


document.getElementById("stepButton").addEventListener("click", function () {
    emu.step();
    updateRegisterDisplay();
});

document.getElementById("frameButton").addEventListener("click", function () {
    // Z80.frame();
    // updateRegisterDisplay();
});

document.getElementById("runButton").addEventListener("click", function () {
    emu.start();
});

window.addEventListener("gamepadconnected", (e) => {
    console.log(e);
});

function updateRegisterDisplay() {
    const cpu = emu.cpu;
    
    document.getElementById("af_register").value = ((cpu.register.a<<8)+cpu.register.f).toHex(4);
    document.getElementById("bc_register").value = ((cpu.register.b<<8)+cpu.register.c).toHex(4);
    document.getElementById("de_register").value = ((cpu.register.d<<8)+cpu.register.e).toHex(4);
    document.getElementById("hl_register").value = ((cpu.register.h<<8)+cpu.register.l).toHex(4);
    document.getElementById("pc_register").value = (cpu.register.pc).toHex(4);
    document.getElementById("sp_register").value = (cpu.register.sp).toHex(4);
    // document.getElementById("div_register").value = (Timer._register.div).toHex(4);
}

Object.prototype.toHex = function (size) {    
    return !size ? this.toString(16).toUpperCase() : this.toString(16).toUpperCase().padStart(size, "0");
};

Object.prototype.toBin = function () {    
    return this.toString(2).toUpperCase().padStart(8, "0");
};