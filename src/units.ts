import length from '../units/length.json';
import time from '../units/length.json';
import data from '../units/length.json';
import physics from '../units/length.json';
import currency from '../units/length.json';

export default [
    ...length,
    ...time,
    ...data,
    ...physics,
    ...currency
] as Unit[];

export type Unit = {
    name: string,
    matcher: `${string}{}`|`{}${string}`,
    equivalence: (`${number}${string}`|`${string}${number}`)[],
    metric: boolean
};