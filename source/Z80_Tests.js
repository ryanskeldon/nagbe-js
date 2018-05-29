let totalFailedTests = 0;

function assert(expected, actual, message) {
    if (expected != actual) {
        totalFailedTests++;
        console.log(message + " Expected: " + expected + " / Actual: " + actual);
    }
}

// ADD a, b - Actual add check..
Z80.reset();
Z80._register.a = 32;
Z80._register.b = 32;
Z80._map[0x80]();
assert(64, Z80._register.a, "add a,b / Normal operation failed.");

// ADD a, b - subtraction check.
Z80.reset();
Z80._register.a = 1;
Z80._register.b = 1;
Z80._map[0x80]();
assert(0, Z80._register.f & Z80._flags.subtraction, "add a,b / Subtraction check failed.");

// ADD a, b - zero check.
Z80.reset();
Z80._register.a = 255;
Z80._register.b = 1;
Z80._map[0x80]();
assert(Z80._flags.zero, Z80._register.f & Z80._flags.zero, "add a,b / Zero check failed.");

// ADD a, b - half-carry check.
Z80.reset();
Z80._register.a = 62;
Z80._register.b = 34;
Z80._map[0x80]();
assert(Z80._flags.halfCarry, Z80._register.f & Z80._flags.halfCarry, "add a,b / Half-carry check failed.");

// ADD a, b - carry check.
Z80.reset();
Z80._register.a = 255;
Z80._register.b = 128;
Z80._map[0x80]();
assert(Z80._flags.carry, Z80._register.f & Z80._flags.carry, "add a,b / Carry check failed.");

// INC c
Z80.reset();
Z80._register.c = 0xEF;
Z80._map[0x0C]();
assert(Z80._flags.halfCarry, Z80._register.f & Z80._flags.halfCarry, "inc a half-carry failed.");

// Tests complete.
Z80.reset();
console.log("Tests failed: " + totalFailedTests);