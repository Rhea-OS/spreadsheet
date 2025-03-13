export default function deepCompare(a: any, b: any): boolean {
	if (typeof a != typeof b) return false;

	if (typeof a != 'object' || !a || !b)
		return a === b;

	return Object.entries(a)
		.every(([c, i]) => c in b && deepCompare(b[c], i));
}