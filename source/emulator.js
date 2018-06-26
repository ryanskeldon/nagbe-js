document.getElementById("stepButton").addEventListener("click", function () {
    Z80.step();
    // document.getElementById("a_register").value = (Z80._register.a).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("f_register").value = (Z80._register.f).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("b_register").value = (Z80._register.b).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("c_register").value = (Z80._register.c).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("d_register").value = (Z80._register.d).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("e_register").value = (Z80._register.e).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("h_register").value = (Z80._register.h).toString(16).toUpperCase().padStart(2,"0");
    // document.getElementById("l_register").value = (Z80._register.l).toString(16).toUpperCase().padStart(2,"0");
    document.getElementById("af_register").value = ((Z80._register.a<<8)+Z80._register.f).toString(16).toUpperCase().padStart(4,"0");;
    document.getElementById("bc_register").value = ((Z80._register.b<<8)+Z80._register.c).toString(16).toUpperCase().padStart(4,"0");;
    document.getElementById("de_register").value = ((Z80._register.d<<8)+Z80._register.e).toString(16).toUpperCase().padStart(4,"0");;
    document.getElementById("hl_register").value = ((Z80._register.h<<8)+Z80._register.l).toString(16).toUpperCase().padStart(4,"0");;
    document.getElementById("pc_register").value = (Z80._register.pc).toString(16).toUpperCase().padStart(4,"0");;
    document.getElementById("sp_register").value = (Z80._register.sp).toString(16).toUpperCase().padStart(4,"0");;
});

document.getElementById("updateBackgroundButton").addEventListener("click", function () {
    GPU.renderBackgroundTileMap();
});
