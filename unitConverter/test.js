import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import UnitParser, * as unit from '#unit';

const parser = new UnitParser(unit.units);

await test.describe("parse", function() {
    const byte = parser.parseValue("10MB");

    assert.equal(byte.value, 10e6);
    assert.equal(byte.unit.name, "Byte");

    const volt = parser.parseValue("0.1kV");

    assert.equal(volt.value, 0.1e3);
    assert.equal(volt.unit.name, "Volt");
});

await test.describe("convert", function() {
    const value = parser.parseValue("10MB");
    const into = parser.findUnit("Bit");

    assert.equal(value.value, 10e6);
    assert.equal(value.unit.name, "Byte");

    assert.equal(into.name, "Bit");

    const result = value.intoUnit(into);

    assert.equal(result.value, 80e6);
    assert.equal(result.unit.name, "Bit");
});