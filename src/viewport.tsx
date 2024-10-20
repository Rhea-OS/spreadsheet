import React from 'react';
import * as rdom from "react-dom/client";
import * as obs from "obsidian";
import StateManager from '@j-cake/jcake-utils/state';
import * as expr from 'expression';

import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from "./components/table.js";
import { renderers } from "./.formula.js";
import { Ui } from "./spreadsheet.js";
import SpreadsheetPlugin from "./main.js";

export const SPREADSHEET_VIEW = "spreadsheet-view";

export interface FrontMatter extends Record<string, any> {
    columnTypes?: string[],
    explicitTypes?: { [cell in string]: string },
    constrainToDefinedColumns?: boolean,

    columnWidths?: number[],
    rowHeights?: number[],

    columnTitles?: string[],
    allowedTypes?: string[],
    columnSeparator?: string,
    urlEscaped?: boolean
}

export interface Value {
    isComputedValue: boolean,

    setRaw(raw: string): void,
    getRaw(): string,

    onChange: (callback: (raw: string) => void) => () => void,

    spreadsheet: () => Spreadsheet,
}

export function value(raw: string, sheet: Spreadsheet): Value {
    const watches: ((raw: string) => void)[] = [];

    return {
        spreadsheet: () => sheet,

        isComputedValue: raw.startsWith("="),
        setRaw: data => {
            raw = data;
            for (const watch of watches)
                watch(raw);
        },
        getRaw: () => raw,
        onChange: callback => {
            watches.push(callback);
            return () => watches.includes(callback) ? void watches.splice(watches.indexOf(callback), 1) : void 0
        },
    };
}

export interface EditorState {
    selection: Selection.CellGroup[],
    activeCell: Selection.Cell | null,

    // Values will be sorted according to the first key in the list. If two identical values appear, the next key along is used until no keys left. In which case the row number is used. 
    sortRows: string[],

    // Each value in the list will be used to create a subgroup. 
    groupRows: string[],

    // Each row which when passed to all formulas, returns `true` is displayed.
    // filter: Formula[]
}

export interface DocumentProperties {
    frontMatter: FrontMatter;

    separator: string;
    uriEncoding: boolean;

    columnTitles: string[];

    columnTypes: string[];

    columnWidths: number[];
    rowHeights: number[];
}

export default class Spreadsheet extends obs.TextFileView {
    raw: Value[][] = [[]];

    cx: expr.Context;

    private root: rdom.Root | null = null;
    #change: Date = new Date();

    get lastChanged(): Date {
        return this.#change;
    }

    #props: DocumentProperties = {
        frontMatter: {},

        columnTitles: [],

        columnTypes: [],

        columnWidths: [],
        rowHeights: [],

        separator: ";",
        uriEncoding: false
    };

    state: StateManager<EditorState>;

    constructor(leaf: obs.WorkspaceLeaf, readonly plugin: SpreadsheetPlugin) {
        super(leaf);

        const watchers: (() => void)[] = [];

        this.cx = new expr.Context(new expr.DataSource({
            countRows: () => this.raw.length,
            getRow: (row: number) => this.raw[row],
            listColumns: () => this.documentProperties.columnTitles,
            listRows: () => this.raw.map(i => i.map(j => j.getRaw()))
        }));

        console.log(this.cx.evaluate("1+2"));

        const onExternalChange = function (this: Spreadsheet, watcher: () => void): () => void {
            watchers.push(watcher);
            return () => watchers.remove(watcher);
        }.bind(this);

        const notifyChange = () => watchers.forEach(i => i());

        this.onExternalChange = onExternalChange;
        this.notifyChange = notifyChange;

        this.raw[0].push(value("", this));

        this.state = new StateManager<EditorState>({
            selection: [],
            activeCell: null
        });
    }

    public readonly onExternalChange: (watcher: () => void) => (() => void);
    private readonly notifyChange: (() => void);

    moveActive(relCol: number, relRow: number) {
        const state = this.state.get();

        const active = {
            row: Math.max(0, (state.activeCell?.row ?? 0) + relRow),
            col: Math.max(0, (state.activeCell?.col ?? 0) + relCol)
        };

        console.log([relCol, relRow], state.activeCell, active);
        
        if (active.row >= 0 && !Array.isArray(this.raw[active.row]))
            this.insertRow(active.row);

        this.state.dispatch('change-active', _ => ({ activeCell: active }));
        this.state.dispatch("sync-selection", _ => ({ selection: [active] }))
    }

    getViewData(): string {
        const rows = [];

        if (!this.documentProperties.frontMatter.columnTitles)
            rows.push(this.documentProperties.columnTitles.map(i => this.documentProperties.uriEncoding ? encodeURIComponent(i) : i));

        for (const row of this.raw)
            rows.push(row
                .map(i => i.getRaw())
                .map(value => this.documentProperties.uriEncoding ? encodeURIComponent(value) : value));

        return rows
            .map(i => i.join(this.documentProperties.separator))
            .join("\n");
    }

    public get documentProperties(): DocumentProperties {
        return this.#props;
    }

    public columnType(col: number): keyof typeof renderers {
        if (this.#props.columnTypes[col] in renderers)
            return this.#props.columnTypes[col] as any;

        return 'raw';
    }

    public updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>) {
        this.#props = Object.freeze({
            ...this.#props,
            ...update(this.#props)
        });

        this.#change = new Date();

        this.notifyChange();
    }

    setViewData(data: string, clear: boolean): void {
        if (clear)
            this.clear();

        const frontMatterMarker = data.indexOf("---\n");

        if (frontMatterMarker > -1) {
            const end = data.indexOf("---\n", frontMatterMarker + 3);
            this.parseFrontMatter(data.slice(frontMatterMarker + 3, end).trim());
            data = data.slice(end + 3).trim();
        }

        const separator = this.documentProperties.separator ?? /[,;\t]/g;
        const rows = data.trim().split(/\r?\n/);

        if (!this.documentProperties.frontMatter?.columnTitles)
            this.updateDocumentProperties(prev => ({
                columnTitles: rows.shift()?.split(separator).map(i => this.documentProperties.uriEncoding ? decodeURIComponent(i) : i) ?? []
            }));

        const prevRaw = [...this.raw];
        const prevProps = { ...this.documentProperties };
        this.raw = [];

        for (const [cells, row] of rows.map((i, row) => [i.split(separator), row] as const)) {
            this.raw.push(new Array(this.documentProperties.columnTitles.length).fill("").map(cell => value(cell, this)));

            for (const [raw, col] of cells.map((i, col) => [i, col] as const)) {
                const prev = prevRaw[row]?.[col];

                if (prev) {
                    this.raw[row][col] = prev;
                    if (prev.getRaw() != raw)
                        prev.setRaw(raw);
                } else
                    this.raw[row][col] = value(raw, this);
            }
        }

        this.updateDocumentProperties(prev => ({
            ...prevProps,

            columnTypes: new Array(this.documentProperties.columnTitles.length).fill("raw"),
            columnWidths: new Array(this.documentProperties.columnTitles.length).fill(DEFAULT_COLUMN_WIDTH),
            rowHeights: new Array(this.raw.length).fill(DEFAULT_ROW_HEIGHT)
        }));
    }

    private parseFrontMatter(frontMatter: string): number {
        this.updateDocumentProperties(prev => ({
            frontMatter: obs.parseYaml(frontMatter)
        }));

        return frontMatter.length;
    }

    editFormat(col: number, format: string) {
        this.updateDocumentProperties(prev => ({
            columnTypes: prev.columnTypes.with(col, format)
        }));
    }

    insertCol(col: number) {
        // Warning: I see a potential for bugs here.
        for (const row of this.raw)
            row.splice(col + 1, 0, value("", this));

        this.#change = new Date();

        this.updateDocumentProperties(prev => ({
            columnTitles: [...prev.columnTitles.slice(0, col + 1), `Column ${col + 2}`, ...prev.columnTitles.slice(col + 1)],
            columnTypes: [...prev.columnTypes.slice(0, col + 1), 'raw', ...prev.columnTypes.slice(col + 1)],
            columnWidths: [...prev.columnWidths.slice(0, col + 1), DEFAULT_COLUMN_WIDTH, ...prev.columnWidths.slice(col + 1)],
        }));
    }

    insertRow(row: number) {
        // Warning: I see a potential for bugs here.
        this.raw.splice(row + 1, 0, new Array(this.#props.columnTypes.length).fill("").map(cell => value(cell, this)));
        this.#change = new Date();

        this.updateDocumentProperties(prev => ({
            rowHeights: [...prev.rowHeights.slice(0, row + 1), DEFAULT_ROW_HEIGHT, ...prev.rowHeights.slice(row + 1)],
        }));
    }

    removeCol(col: number) {
        for (const row of this.raw)
            row.splice(col, 1);

        this.#change = new Date();
        this.updateDocumentProperties(prev => ({
            columnWidths: [...prev.columnWidths.slice(0, col), ...prev.columnWidths.slice(col + 1)],
            columnTitles: [...prev.columnTitles.slice(0, col), ...prev.columnTitles.slice(col + 1)],
            columnTypes: [...prev.columnTypes.slice(0, col), ...prev.columnTypes.slice(col + 1)]
        }));
    }

    removeRow(row: number) {
        this.raw.splice(row, 1);
        this.#change = new Date();
        this.updateDocumentProperties(prev => ({
            rowHeights: [...prev.rowHeights.slice(0, row), ...prev.rowHeights.slice(row + 1)]
        }));
    }

    clear(): void {
        this.raw = [[]];
    }

    getViewType(): string {
        return SPREADSHEET_VIEW
    }

    getDisplayText(): string {
        return this.file?.basename ?? "Untitled Spreadsheet";
    }

    getIcon(): string {
        return "sheet";
    }

    onPaneMenu(menu: obs.Menu, source: string) {
        menu.addItem(item => item
            .setIcon("settings")
            .setTitle("Spreadsheet Preferences"));
    }

    protected async onOpen(): Promise<void> {
        (this.root = rdom.createRoot(this.contentEl))
            .render(<Ui sheet={this} settings={this.plugin.settings} />);
    }

    protected async onClose(): Promise<void> {
        this.root?.unmount();
    }
}

export namespace Selection {
    export type CellGroup = Range | Cell | VectorRange | Vector;
    export type Range = { from: Cell, to: Cell };
    export type Vector = Row | Column;
    export type VectorRange = ColumnVectorRange | RowVectorRange;
    export type ColumnVectorRange = { from: Column, to: Column };
    export type RowVectorRange = { from: Row, to: Row };
    export type Column = { col: number };
    export type Row = { row: number };
    export type Cell = { row: number, col: number };

    export const normaliseRange = (range: Range): Range => ({
        from: {
            row: Math.min(range.from.row, range.to.row),
            col: Math.min(range.from.col, range.to.col)
        },
        to: {
            row: Math.max(range.from.row, range.to.row),
            col: Math.max(range.from.col, range.to.col)
        }
    });
    export const normaliseVectorRange = (range: VectorRange): VectorRange =>
        isColumnVectorRange(range) ?
            { from: { col: Math.min(range.from.col, range.to.col) }, to: { col: Math.max(range.from.col, range.to.col) } } :
            { from: { row: Math.min(range.from.row, range.to.row) }, to: { row: Math.max(range.from.row, range.to.row) } };

    export const isCell = (cell: CellGroup): cell is Cell => 'row' in cell && 'col' in cell;
    export const isRange = (cell: CellGroup): cell is Range => 'from' in cell && 'to' in cell && isCell(cell.from) && isCell(cell.to);
    export const isVector = (cell: CellGroup): cell is Vector => !isCell(cell) && ('row' in cell || 'col' in cell);
    export const isVectorRange = (cell: CellGroup): cell is VectorRange => !isRange(cell) && 'from' in cell && 'to' in cell && isColumnVector(cell.from) == isColumnVector(cell.to);
    export const isColumnVector = (cell: CellGroup): cell is Column => isVector(cell) && 'col' in cell;
    export const isColumnVectorRange = (cell: CellGroup): cell is ColumnVectorRange => isVectorRange(cell) && 'col' in cell.from && 'col' in cell.to;
    export const isRowVectorRange = (cell: CellGroup): cell is RowVectorRange => isVectorRange(cell) && 'row' in cell.from && 'row' in cell.to;
    export const isRowVector = (cell: CellGroup): cell is Row => isVector(cell) && 'row' in cell;

    export const area = (range: CellGroup): number => {
        if (isCell(range))
            return 1;

        else if (isVector(range) || isVectorRange(range))
            return Infinity;

        const norm = normaliseRange(range);
        return ((norm.to.row + 1) - norm.from.row) * ((norm.to.col + 1) - norm.from.col);
    };

    export const eqCell = (left: Cell, right: Cell): boolean => left.col == right.col && left.row == right.row;
    export const eqRange = (left: Range, right: Range): boolean => {
        left = normaliseRange(left);
        right = normaliseRange(right);

        return eqCell(left.from, right.from) && eqCell(left.to, right.to);
    }

    export const eq = (left: Range | Cell, right: Range | Cell): boolean => {
        left = isRange(left) ? normaliseRange(left) : left;
        right = isRange(right) ? normaliseRange(right) : right;

        if (isCell(left) && isCell(right))
            return eqCell(left, right);

        else if (isRange(left) && isRange(right))
            return eqRange(left, right);

        // We have one range and one cell. The cell must have an area of 1.
        else if (area(left) != area(right))
            return false;

        // If the area's two components aren't equal, then fail
        else if ((isRange(left) ? !eqCell(left.from, left.to) : false) || (isRange(right) ? !eqCell(right.from, right.to) : false))
            return false;

        return true;
    };

    export const rangeFromCell = (from: Cell | Vector, to: Cell | Vector): CellGroup | null => {
        if (isCell(from) && isCell(to))
            return normaliseRange({ from, to });
        else if ((isColumnVector(from) && isColumnVector(to)) || (isRowVector(from) && isRowVector(to)))
            return normaliseVectorRange({ from, to } as VectorRange);
        else if (isColumnVector(from) && isCell(to))
            return { from, to: { col: to.col } };
        else if (isRowVector(from) && isCell(to))
            return { from, to: { row: to.row } };
        else if (isCell(to) && isColumnVector(from))
            return { from: { col: to.col }, to };
        else if (isCell(to) && isColumnVector(from))
            return { from: { row: to.row }, to };
        else
            return null;
    }

    export function topLeft(selection: CellGroup[]): Cell | null {
        return selection.filter(i => isCell(i) || isRange(i))
            .map(i => isCell(i) ? i : { row: Math.min(i.from.row, i.to.row), col: Math.min(i.from.col, i.to.col) })
            .sort((i, j) => {
                if (eqCell(i, j))
                    return 0;

                else if (i.row > j.row)
                    return 1;
                else if (i.col > j.col)
                    return 1;
                else
                    return -1;
            })[0];        
    }
}