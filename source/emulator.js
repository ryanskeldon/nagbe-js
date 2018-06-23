document.getElementById("stepButton").addEventListener("click", function () {
    Z80.step();
    document.getElementById("a_register").value = (Z80._register.a).toString(16);
    document.getElementById("f_register").value = (Z80._register.f).toString(16);
    document.getElementById("b_register").value = (Z80._register.b).toString(16);
    document.getElementById("c_register").value = (Z80._register.c).toString(16);
    document.getElementById("d_register").value = (Z80._register.d).toString(16);
    document.getElementById("e_register").value = (Z80._register.e).toString(16);
    document.getElementById("h_register").value = (Z80._register.h).toString(16);
    document.getElementById("l_register").value = (Z80._register.l).toString(16);
    document.getElementById("af_register").value = ((Z80._register.a<<8)+Z80._register.f).toString(16);
    document.getElementById("bc_register").value = ((Z80._register.b<<8)+Z80._register.c).toString(16);
    document.getElementById("de_register").value = ((Z80._register.d<<8)+Z80._register.e).toString(16);
    document.getElementById("hl_register").value = ((Z80._register.h<<8)+Z80._register.l).toString(16);
    document.getElementById("pc_register").value = (Z80._register.pc).toString(16);
    document.getElementById("sp_register").value = (Z80._register.sp).toString(16);
});