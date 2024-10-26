import React from 'react';
import * as rdom from "react-dom/client";
import * as obs from "obsidian";
import StateManager from '@j-cake/jcake-utils/state';

import {renderers} from "./.formula.js";
import {StateHolder, Ui} from "./spreadsheet.js";
import SpreadsheetPlugin from "./main.js";
import CSVDocument, {DocumentProperties, value, Value} from "./csv.js";

export const SPREADSHEET_VIEW = "spreadsheet-view";

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

export default class Spreadsheet extends obs.TextFileView implements StateHolder {
    doc: CSVDocument;

    private root: rdom.Root | null = null;

    state: StateManager<EditorState>;

    constructor(leaf: obs.WorkspaceLeaf, readonly plugin: SpreadsheetPlugin) {
        super(leaf);

        this.doc = new CSVDocument();

        this.doc.raw[0].push(value("", this.doc));

        this.state = new StateManager<EditorState>({
            selection: [],
            activeCell: null
        });
    }

    moveActive(relCol: number, relRow: number) {
        const state = this.state.get();

        const active = {
            row: Math.max(0, (state.activeCell?.row ?? 0) + relRow),
            col: Math.max(0, (state.activeCell?.col ?? 0) + relCol)
        };

        // console.log([relCol, relRow], state.activeCell, active);
        
        if (active.row >= 0 && !Array.isArray(this.doc.raw[active.row]))
            this.doc.insertRow(active.row);

        this.state.dispatch('change-active', _ => ({ activeCell: active }));
        this.state.dispatch("sync-selection", _ => ({ selection: [active] }))
    }

    getViewData(): string {
        return this.doc.getRaw()
    }

    setViewData(data: string, clear: boolean): void {
        this.doc.setRaw(data, clear);
    }

    public get documentProperties(): DocumentProperties {
        return this.doc.documentProperties;
    }

    public columnType(col: number): keyof typeof renderers {
        return this.doc.columnType(col)
    }

    public updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>) {
        this.doc.updateDocumentProperties(update);
    }

    onExternalChange(watcher: () => void): () => void {
        return this.doc.onExternalChange(watcher);
    }

    insertCol(col: number) {
        this.doc.insertCol(col);
    }

    insertRow(row: number) {
        this.doc.insertRow(row);
    }

    removeCol(col: number) {
        this.doc.removeCol(col)
    }

    removeRow(row: number) {
        this.doc.removeRow(row)
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

    clear(): void {
        this.doc.clear();
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