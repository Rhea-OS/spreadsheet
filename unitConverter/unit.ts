import units, {multipliers, Qty, Unit} from "./units.js";

export { Unit } from './units.js';
export { default as units } from './units.js';

export interface Value {
    source: string,
    unit: Unit,
    multiplier: number,

    number: number
}

export const noUnit = (num: number): Value => ({
    source: String(num),
    multiplier: 1,
    unit: Qty,
    number: num
});

export default class UnitParser {
    private parsers: Record<string, (value: string) => { value: number, multiplier: number } | null>;

    constructor(private unitDatabase: Unit[]) {
        this.parsers = Object.fromEntries(unitDatabase.map(i => this.parseUnit(i)));
    }

    public parseValue(value: string): Value {
        const [unit, candidate] = Object.entries(this.parsers)
            .map(i => [i[0], i[1](value)] as const)
            .filter(i => !!i[1])[0];

        if (!candidate)
            return noUnit(Number(value));

        return {
            multiplier: candidate.multiplier,
            source: value,
            unit: this.unitDatabase.find(i => i.name == unit) ?? Qty,
            number: candidate.value * candidate.multiplier
        }
    }

    private parseUnit(unit: Unit): [string, (value: string) => { value: number, multiplier: number } | null] {
        const [left, right] = unit.matcher.split("{}");

        return [unit.name, (value) => {
            const isValid = !left ? value.endsWith(right) : value.startsWith(left);

            if (!isValid)
                return null;

            const numeric = !left ? value.slice(0, value.length - right.length - 1) : value.slice(left.length);

            if (!unit.metric)
                return {
                    value: Number(numeric),
                    multiplier: 1,
                };

            const multiplier = value.slice(value.indexOf(numeric) + numeric.length);

            const candidateMultiplier = Object.entries(multipliers)
                .map(([suffix, exponent]) => [suffix, 10 ** Number(exponent)] as const)
                .filter(([suffix, _]) => multiplier.startsWith(suffix) && !value.endsWith(suffix))[0] ?? ['', 1];

            return {
                value: Number(numeric),
                multiplier: candidateMultiplier[1]
            };
        }];
    }
}