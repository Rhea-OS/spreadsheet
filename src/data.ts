import {parseYaml, stringifyYaml} from "obsidian";

import {FrontMatter} from "./spreadsheet.js";
import {Cell} from "./range.js";

export const DEFAULT_COLUMN_WIDTH = 128;
export const MIN_COLUMN_WIDTH = 24;

export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_ROW_HEIGHT = 6;

export const typeDef: Record<string, Type<any>> = {
    raw: {
        fromRaw: raw => raw,
        intoRaw: raw => raw
    },
    date: {
        fromRaw: raw => new Date(raw),
        intoRaw: (date: Date) => `${date
            .getDate()
            .toString(10)
            .padStart(2, '0')}-${(date
            .getMonth() + 1)
            .toString(10)
            .padStart(2, '0')}-${date.getFullYear()
            .toString(10)
            .padStart(4, '0')} ${date.getHours()
            .toString(10)
            .padStart(2, '0')}:${date.getMinutes()
            .toString(10)
            .padStart(2, '0')}:${date.getSeconds()
            .toString(10)
            .padStart(2, '0')}`
    }
} as const;

export default class DataSource<FM extends Partial<FrontMatter>> {
    private onChange: () => void = () => void 0;

    private raw: string[][] = [];

    // If not specified, assume the following defaults.
    public frontMatter: FM = { urlEscaped: true } as FM;

    typeDef: Record<string, Type<any>> = typeDef;

    serialise(): string {
        return `---\n${stringifyYaml(this.frontMatter)}\n---\n${this.raw.map(i => i.join(this.frontMatter.columnSeparator ??= ';')).join('\n')}`;
    }

    clear() {
        this.raw = [];
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

        this.raw = rows.map(line => line.split(separator));

        this.onChange();
        return this;
    }

    private parseFrontMatter(frontMatter: string): number {
        Object.assign(this.frontMatter, parseYaml(frontMatter));
        return frontMatter.length;
    }

    onExternalChange(change: () => void) {
        this.onChange = change;
    }

    public get columnNames(): string[] {
        return this.frontMatter.columnTitles ?? [];
    }

    public get columnWidths(): number[] {
        if (!this.frontMatter?.columnWidths)
            this.frontMatter.columnWidths = new Array(this.columnNames.length)
                .fill(DEFAULT_COLUMN_WIDTH);

        return this.frontMatter.columnWidths;
    }

    public get rowHeights(): number[] {
        if (!this.frontMatter?.rowHeights)
            this.frontMatter.rowHeights = new Array(this.data.length)
                .fill(DEFAULT_ROW_HEIGHT);

        return this.frontMatter.rowHeights!;
    }

    public get data(): Cell[][] {
        return this.raw.map((i, a) => i.map((j, b) => new Cell(a, b)));
    }

    public rawValueAt(cell: Cell): string {
        if (!this.raw[cell.row])
            this.raw[cell.row] = new Array(Math.max(cell.col, this.columnNames.length)).fill("").map(_ => "");

        if (this.frontMatter.urlEscaped)
            return decodeURIComponent(this.raw[cell.row][cell.col]);
        else
            return this.raw[cell.row][cell.col];
    }

    public setRawValueAt(cell: Cell, value: string) {
        if (!this.raw[cell.row])
            this.raw[cell.row] = new Array(Math.max(cell.col, this.columnNames.length)).fill("").map(_ => "");

        if (this.frontMatter.urlEscaped)
            this.raw[cell.row][cell.col] = encodeURIComponent(value);
        else
            this.raw[cell.row][cell.col] = value;

        this.onChange();
    }

    public typeof(cell: Cell): string {
        const addr = cell.toString();

        const explicit = Object.entries(this.frontMatter?.explicitTypes ?? {})
            .find(([key, _]) => key.toLowerCase() == addr.toLowerCase());

        if (explicit && explicit[1] in this.typeDef)
            return explicit[1];

        const column = this.frontMatter?.columnTypes?.[cell.col];

        if (column && column in this.typeDef)
            return column;

        return 'raw';
    }

    public valueAt<T>(cell: Cell): Datum<T> {
        const ser = () => this.typeDef[this.typeof(cell)] ?? this.typeDef.raw;

        return {
            typeName: () => this.typeof(cell),

            // TODO: handle errors gracefully
            fromRaw: value => this.setRawValueAt(cell, value),
            intoRaw: () => this.rawValueAt(cell),

            set: value => this.setRawValueAt(cell, ser().intoRaw(value)),
            get: () => ser().fromRaw(this.rawValueAt(cell))
        }
    }

    public addRow() {
        this.data.push(new Array(this.columnNames.length).fill(""));
        this.onChange();
    }
}

export interface Type<T> {
    fromRaw(raw: string): T,
    intoRaw(datum: T): string,
}

export interface Datum<T> {
    typeName: () => string;

    fromRaw(raw: string): void;
    intoRaw(): string;

    get(): T,
    set(value: T): void;
}