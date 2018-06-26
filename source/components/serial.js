Serial = {
    readByte: function (address) {},
    writeByte: function (address, byte) {
        console.log(String.fromCharCode(byte));
    }
};