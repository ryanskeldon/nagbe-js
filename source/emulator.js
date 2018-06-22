document.getElementById("stepButton").addEventListener("click", function () {
    Z80.step();
    document.getElementById("AF").innerHTML = ((Z80._register.a<<8)+Z80._register.f).toString(16);
    document.getElementById("BC").innerHTML = ((Z80._register.b<<8)+Z80._register.c).toString(16);
    document.getElementById("DE").innerHTML = ((Z80._register.d<<8)+Z80._register.e).toString(16);
    document.getElementById("HL").innerHTML = ((Z80._register.h<<8)+Z80._register.l).toString(16);
    document.getElementById("PC").innerHTML = (Z80._register.pc).toString(16);
    document.getElementById("SP").innerHTML = (Z80._register.sp).toString(16);
});