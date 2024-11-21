import UnitParser, {NotEquivalentError} from "#unit";
import {Unit} from "./units.js";

export interface EquivalenceMap {
    getEquivalence(from: Unit, to: Unit): number;

}

export default function equivalence(parser: UnitParser, database: Unit[]): EquivalenceMap {

    const cache: Map<string, Map<string, number>> = new Map();
    let map: EquivalenceMap;

    return map = {
        getEquivalence(from: Unit, to: Unit, equivalenceChain: string[] = []): number {
            // Get two units to either directly or indirectly connect. If two equivalents are found, cache the multiplier value

            const hit = cache.get(from.name)?.get(to.name);

            if (hit)
                return hit;

            const equivalence = from.equivalence
                .map(i => parser.parseValue(i));

            const direct = equivalence.find(i => i.unit == to || i.unit.name == to.name);

            if (direct) {
                const forUnit = cache.get(from.name);

                if (forUnit)
                    forUnit.set(to.name, direct.value);
                else
                    cache.set(from.name, new Map([[to.name, direct.value]]));

                return direct.value;
            } else {
                // recursively locate two units which may indirectly be equivalent

                if (equivalenceChain.includes(from.name) && equivalenceChain.includes(to.name))
                    throw new NotEquivalentError(from, to);

                for (const to of equivalence)
                    try {
                        return (map as {
                            getEquivalence(from: Unit, to: Unit, chain: string[]): number
                        }).getEquivalence(from, to.unit, equivalenceChain.concat(to.unit.name));
                    } catch {}
            }

            throw new NotEquivalentError(from, to);
        }
    }
}