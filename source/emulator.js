let emu;
document.addEventListener("DOMContentLoaded", () => {
    emu = new nagbe();

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
    emu.frame();
    updateRegisterDisplay();
});

document.getElementById("runButton").addEventListener("click", function () {
    emu.start();
});

function updateRegisterDisplay() {
    const cpu = emu.cpu;
    
    document.getElementById("af_register").value = ((cpu.register.a<<8)+cpu.register.f).toHex(4);
    document.getElementById("bc_register").value = ((cpu.register.b<<8)+cpu.register.c).toHex(4);
    document.getElementById("de_register").value = ((cpu.register.d<<8)+cpu.register.e).toHex(4);
    document.getElementById("hl_register").value = ((cpu.register.h<<8)+cpu.register.l).toHex(4);
    document.getElementById("pc_register").value = (cpu.register.pc).toHex(4);
    document.getElementById("sp_register").value = (cpu.register.sp).toHex(4);
}

Object.prototype.toHex = function (size) {    
    return !size ? this.toString(16).toUpperCase() : this.toString(16).toUpperCase().padStart(size, "0");
};

Object.prototype.toBin = function () {    
    return this.toString(2).toUpperCase().padStart(8, "0");
};