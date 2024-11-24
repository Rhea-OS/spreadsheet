import React from "react";
import * as iter from '@j-cake/jcake-utils/iter';

import {StateHolder} from "./main.js";

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
            {from: {col: Math.min(range.from.col, range.to.col)}, to: {col: Math.max(range.from.col, range.to.col)}} :
            {from: {row: Math.min(range.from.row, range.to.row)}, to: {row: Math.max(range.from.row, range.to.row)}};

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
            return normaliseRange({from, to});
        else if ((isColumnVector(from) && isColumnVector(to)) || (isRowVector(from) && isRowVector(to)))
            return normaliseVectorRange({from, to} as VectorRange);
        else if (isColumnVector(from) && isCell(to))
            return {from, to: {col: to.col}};
        else if (isRowVector(from) && isCell(to))
            return {from, to: {row: to.row}};
        else if (isCell(to) && isColumnVector(from))
            return {from: {col: to.col}, to};
        else if (isCell(to) && isColumnVector(from))
            return {from: {row: to.row}, to};
        else
            return null;
    }

    export function topLeft(selection: CellGroup[]): Cell | null {
        return selection.filter(i => isCell(i) || isRange(i))
            .map(i => isCell(i) ? i : {row: Math.min(i.from.row, i.to.row), col: Math.min(i.from.col, i.to.col)})
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

    export function* iterCells(selection: CellGroup[]): Generator<Cell> {
        for (const group of simplify(selection))
            if (Selection.isCell(group))
                yield group;
            else if (Selection.isRange(group))
                for (const row of iter.iterSync.range(group.from.row, group.to.row + 1))
                    for (const col of iter.iterSync.range(group.from.col, group.to.col + 1))
                        yield { row, col };
            // TODO: vectors
    }

    export function isColliding(a: CellGroup, b: CellGroup): boolean {

    }

    export function simplify(selection: CellGroup[]): CellGroup[] {
        const reduced: CellGroup[] = [];



        return reduced;
    }
}

export default function SelectionIndicator({selection, sheet}: {
    selection: Selection.CellGroup[],
    sheet: StateHolder
}) {
    return <>
        {selection.map((selection, a) => {
            if (Selection.isRange(selection))
                return <div className="selection-range"
                            key={`selection-${a}`}
                            style={{
                                gridRowStart: selection.from.row + 2,
                                gridRowEnd: selection.to.row + 3,
                                gridColumnStart: selection.from.col + 2,
                                gridColumnEnd: selection.to.col + 3,
                            }}/>

            else if (Selection.isRowVectorRange(selection))
                return <div className="selection-range row-vector"
                            key={`selection-${a}`}
                            style={{
                                gridColumnStart: 1,
                                gridColumnEnd: sheet.doc.raw[0].length + 2, // TODO: Figure out why CSS grid isn't accepting end values
                                gridRowStart: selection.from.row + 2,
                                gridRowEnd: selection.to.row + 3
                            }}/>

            else if (Selection.isColumnVectorRange(selection))
                return <div className="selection-range column-vector"
                            key={`selection-${a}`}
                            style={{
                                gridRowStart: 1,
                                gridRowEnd: sheet.doc.raw.length + 2,
                                gridColumnStart: selection.from.col + 2,
                                gridColumnEnd: selection.to.col + 3
                            }}/>

            else if (Selection.isCell(selection))
                return <div className="selection-range"
                            key={`selection-${a}`}
                            style={{
                                gridRow: selection.row + 2,
                                gridColumn: selection.col + 2
                            }}/>

            else if (Selection.isColumnVector(selection))
                return <div className="selection-range column-vector"
                            key={`selection-${a}`}
                            style={{
                                // gridRow: '1 / -1',
                                gridRowStart: 1,
                                gridRowEnd: sheet.doc.raw.length + 2,
                                gridColumn: selection.col + 2
                            }}/>

            else if (Selection.isRowVector(selection))
                return <div className="selection-range row-vector"
                            key={`selection-${a}`}
                            style={{
                                gridRow: selection.row + 2,
                                gridColumnStart: 1,
                                gridColumnEnd: sheet.doc.raw[0].length + 2
                                // gridColumn: '1 / -1',
                            }}/>
        })}
    </>
}