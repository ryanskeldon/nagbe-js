document.addEventListener("DOMContentLoaded", function() {
    window.nagbe = new nagbe();

    document.getElementById("romFileSelect").addEventListener("change", function (e) {
        if (e.target.files.length === 0) return;
    
        window.nagbe.loadFile(this.files[0]);
    });
});


document.getElementById("stepButton").addEventListener("click", function () {
    // Z80.step();
    // updateRegisterDisplay();
});

document.getElementById("frameButton").addEventListener("click", function () {
    // Z80.frame();
    // updateRegisterDisplay();
});

document.getElementById("runButton").addEventListener("click", function () {
    // Z80.run();
});



function updateRegisterDisplay() {
    document.getElementById("af_register").value = ((Z80._register.a<<8)+Z80._register.f).toHex(4);
    document.getElementById("bc_register").value = ((Z80._register.b<<8)+Z80._register.c).toHex(4);
    document.getElementById("de_register").value = ((Z80._register.d<<8)+Z80._register.e).toHex(4);
    document.getElementById("hl_register").value = ((Z80._register.h<<8)+Z80._register.l).toHex(4);
    document.getElementById("pc_register").value = (Z80._register.pc).toHex(4);
    document.getElementById("sp_register").value = (Z80._register.sp).toHex(4);
    document.getElementById("div_register").value = (Timer._register.div).toHex(4);
}

Object.prototype.toHex = function (size) {    
    return !size ? this.toString(16).toUpperCase() : this.toString(16).toUpperCase().padStart(size, "0");
};

Object.prototype.toBin = function () {    
    return this.toString(2).toUpperCase().padStart(8, "0");
};