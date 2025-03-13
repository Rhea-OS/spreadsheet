import length from '../units/length.json' with { type: 'json' };
import time from '../units/time.json' with { type: 'json' };
import data from '../units/data.json' with { type: 'json' };
import physics from '../units/physics.json' with { type: 'json' };
import currency from '../units/currency.json' with { type: 'json' };

export default [
    ...length,
    ...time,
    ...data,
    ...physics,
    ...currency
] as Unit[];

export {default as multipliers} from '../units/multipliers.json';

export const Qty = {
    equivalence: [],
    matcher: `{}`,
    metric: true,
    name: "NoUnit" as const
} satisfies Unit;

export type Unit = {
    name: string,
    matcher: `${string}{}`|`{}${string}`,
    equivalence: (`${number}${string}`|`${string}${number}`)[],
    metric: boolean
};