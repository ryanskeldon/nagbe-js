document.getElementById("stepButton").addEventListener("click", function () {
    Z80.step();
    updateRegisterDisplay();
});

document.getElementById("updateBackgroundButton").addEventListener("click", function () {
    GPU.renderBackgroundTileMap();
});

function updateRegisterDisplay() {
    document.getElementById("af_register").value = ((Z80._register.a<<8)+Z80._register.f).toString(16).toUpperCase().padStart(4,"0");
    document.getElementById("bc_register").value = ((Z80._register.b<<8)+Z80._register.c).toString(16).toUpperCase().padStart(4,"0");
    document.getElementById("de_register").value = ((Z80._register.d<<8)+Z80._register.e).toString(16).toUpperCase().padStart(4,"0");
    document.getElementById("hl_register").value = ((Z80._register.h<<8)+Z80._register.l).toString(16).toUpperCase().padStart(4,"0");
    document.getElementById("pc_register").value = (Z80._register.pc).toString(16).toUpperCase().padStart(4,"0");
    document.getElementById("sp_register").value = (Z80._register.sp).toString(16).toUpperCase().padStart(4,"0");
}