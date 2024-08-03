import {FrontMatter} from "./spreadsheet.js";
import {editorLivePreviewField, parseYaml, stringifyYaml} from "obsidian";
import * as iter from "@j-cake/jcake-utils/iter";
import {Cell} from "./range.js";

export const typeDefList: Record<string, ((value: string) => any)> = {
    raw: column => column,
} as const;

export type Row<FM extends FrontMatter> = string[];

export default class DataSource<FM extends FrontMatter> {
    private onChange: () => void = () => void 0;

    public data: Row<FM>[] = [];

    frontMatter: FM = {} as any;

    parsers = typeDefList;

    serialise(): string {
        return `---\n${stringifyYaml(this.frontMatter)}\n---\n${this.data.map(i => i.join(this.frontMatter.columnSeparator ??= ';')).join('\n')}`;
    }

    clear() {
        this.data = [];
        this.onChange();
    }

    fromString(data: string): this {
        const frontMatterMarker = data.indexOf("---\n");

        if (frontMatterMarker > -1) {
            const end = data.indexOf("---\n", frontMatterMarker + 3);
            this.parseFrontMatter(data.slice(frontMatterMarker + 3, end).trim());
            data = data.slice(end + 3).trim();
        }

        const separator = this.frontMatter.columnSeparator ?? /[,;]/g;
        const rows = data.split(/\r?\n/);

        if (!this.frontMatter.columnTitles)
            this.frontMatter.columnTitles = rows.shift()?.split(separator) ?? [];

        this.data =  rows
            .map(line => {
                const column = [];

                const iterator = zip(iter.IterSync(line.split(separator)), this.frontMatter.columnTypes ?? new InfiniteIterator("raw"));

                for (const [value, parser] of iterator)
                    column.push((this.parsers[parser] ?? this.parsers.raw)(value));

                return column;
            });

        this.onChange();
        return this;
    }

    private parseFrontMatter(frontMatter: string): number {
        this.frontMatter = parseYaml(frontMatter);
        return frontMatter.length;
    }

    onExternalChange(change: () => void) {
        this.onChange = change;
    }

    public get columnNames(): string[] {
        return this.frontMatter.columnTitles ?? [];
    }

    public valueAt(cell: Cell): string {
        return this.data[cell.row][cell.col];
    }

    public setValueAt(cell: Cell, value: string) {
        this.data[cell.row][cell.col] = value;
        this.onChange();
    }
}

export class InfiniteIterator<T> {
    [Symbol.iterator]() {
        return this.iter();
    }

    constructor(private readonly data: T) {}

    private *iter(): Generator<T> {
        while (true)
            yield this.data;
    }
}

export function zip<A, B>(iter1: Iterable<A>, iter2: Iterable<B>): iter.iterSync.Iter<[A, B]> {
    const zip = function* (iter1: Iterable<A>, iter2: Iterable<B>): Generator<[A, B]> {
        for (const i of iter1) {
            const next = iter2[Symbol.iterator]().next();

            yield [i, next.value];

            if (next.done)
                break;
        }
    }

    return iter.IterSync(zip(iter1, iter2));
}