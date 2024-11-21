import units, {multipliers, Qty, Unit} from "./units.js";
import equivalence, {EquivalenceMap} from "./equivalence.js";

export {default as units} from './units.js';

export interface Value<U extends Unit = Unit> {
    unit: U,
    value: number,

    intoUnit<IntoUnit extends Unit>(unit: IntoUnit): Value<IntoUnit>;
}

function valueFactory(parser: UnitParser, equivalenceMap: EquivalenceMap): <U extends Unit>(value: number, unit: U) => Value<U> {
    let factory: <U extends Unit>(value: number, unit: U) => Value<U>;
    return factory = (value, unit) => ({
        value, unit,

        intoUnit<IntoUnit extends Unit>(into: IntoUnit): Value<IntoUnit> {
            const mul = equivalenceMap.getEquivalence(unit, into);

            return factory(value * mul, into);
        }
    });
}

export const noUnit = (value: number): Value<typeof Qty> => ({
    value, unit: Qty,

    intoUnit<IntoUnit extends Unit>(unit: IntoUnit) {
        throw new NotEquivalentError(Qty, unit);
    }
})

export class NotEquivalentError extends Error {
    constructor(public from: Unit, public to: Unit) {
        super();

        this.name = `NotEquivalent(${from.name} := ${to.name})`;
    }
}

export default class UnitParser {
    private parsers: Record<string, (value: string) => { value: number, multiplier: number } | null>;
    private readonly valueFactory: ReturnType<typeof valueFactory>;
    private equivalenceMap: EquivalenceMap;

    constructor(private unitDatabase: Unit[]) {
        this.parsers = Object.fromEntries(unitDatabase.map(i => this.parseUnit(i)));
        this.valueFactory = valueFactory(this, this.equivalenceMap = equivalence(this, unitDatabase));
    }

    public parseValue(value: string): Value {
        const [unit, candidate] = Object.entries(this.parsers)
            .map(i => [i[0], i[1](value)] as const)
            .filter(i => !!i[1])[0];

        if (!candidate)
            return noUnit(Number(value));

        return this.valueFactory(candidate.value * candidate.multiplier, this.unitDatabase.find(i => i.name == unit) ?? Qty);
    }

    public findUnit(name: string): Unit {
        return this.unitDatabase.find(i => i.name.toLowerCase() == name.toLowerCase()) ?? Qty;
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