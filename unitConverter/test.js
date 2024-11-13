import * as test from 'node:test';
import UnitParser, * as unit from '#unit';

const parser = new UnitParser(unit.units);

await test.describe("parse", function() {
    const value = parser.parseValue("10MB");

    console.log(value);
});