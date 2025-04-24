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

    /// B is completely encased by A
    export function isSubrangeOf(a: Range, b: Range): boolean {
        return (a.from.col <= b.from.col && a.to.col >= b.to.col) && (a.from.row <= b.from.row && a.to.row >= b.to.row);
    }

    export function* iterCells(selection: CellGroup[]): Generator<Cell> {
        for (const group of simplify(selection))
            if (Selection.isCell(group))
                yield group;
            else if (Selection.isRange(group))
                for (const row of iter.iterSync.range(group.from.row, group.to.row + 1))
                    for (const col of iter.iterSync.range(group.from.col, group.to.col + 1))
                        yield {row, col};
        // TODO: vectors
    }

    export type Name = {
        'cell': Cell,
        'range': Range,
        'column': Column,
        'row': Row,
        'colvec': ColumnVectorRange,
        'rowvec': RowVectorRange,
    };

    type KeysMatching<T extends object, V> = {
        [K in keyof T]-?: T[K] extends V ? K : never
    }[keyof T];

    export function getGroupType<Group extends CellGroup, Out extends KeysMatching<Name, Group>>(t: Group): Out {
        if (Selection.isCell(t))
            return 'cell' as Out;

        else if (Selection.isRange(t))
            return 'range' as Out;

        else if (Selection.isColumnVector(t))
            return 'column' as Out;

        else if (Selection.isRowVector(t))
            return 'row' as Out;

        else if (Selection.isColumnVectorRange(t))
            return 'colvec' as Out;

        else if (Selection.isRowVectorRange(t))
            return 'rowvec' as Out;

        else throw new Error('Unreachable');
    }

    export function isColliding(a: CellGroup, b: CellGroup): boolean {
        return ({
            cell(a, b): boolean {
                if (Selection.isCell(b))
                    return Selection.eqCell(a, b);

                else if (Selection.isRange(b))
                    return (b.from.col >= a.col && b.to.col <= a.col) && (b.from.row >= a.row && b.to.row <= a.row);

                else if (Selection.isColumnVector(b))
                    return b.col == a.col;

                else if (Selection.isRowVector(b))
                    return b.row == a.row;

                else if (Selection.isColumnVectorRange(b))
                    return b.from.col >= a.col && b.to.col <= a.col;

                else if (Selection.isRowVectorRange(b))
                    return b.from.row >= a.row && b.to.row <= a.row;

                else return false;
            },
            range(a, b): boolean {
                if (Selection.isCell(b))
                    return isColliding(b, a);

                else if (Selection.isRange(b))
                    return (b.to.col >= a.from.col && b.from.col <= a.to.col) &&
                        (b.to.row >= a.from.row && b.from.row <= a.to.row);

                else if (Selection.isColumnVector(b))
                    return b.col >= a.from.col && a.to.col <= a.to.col;

                else if (Selection.isRowVector(b))
                    return b.row >= a.from.row && a.to.row <= a.to.row;

                else if (Selection.isColumnVectorRange(b))
                    return (b.to.col >= a.from.col && b.from.col <= a.to.col);

                else if (Selection.isRowVectorRange(b))
                    return (b.to.row >= a.from.row && b.from.row <= a.to.row);

                else return false;
            },
            column(a, b): boolean {
                if (Selection.isCell(b))
                    return isColliding(b, a);

                else if (Selection.isRange(b))
                    return isColliding(b, a);

                else if (Selection.isColumnVector(b))
                    return a.col == b.col;

                else if (Selection.isRowVector(b))
                    return true;

                else if (Selection.isColumnVectorRange(b))
                    return a.col >= b.from.col && a.col <= b.to.col;

                else if (Selection.isRowVectorRange(b))
                    return true;

                else return false;
            },
            row(a, b): boolean {
                if (Selection.isCell(b))
                    return isColliding(b, a);

                else if (Selection.isRange(b))
                    return isColliding(b, a);

                else if (Selection.isColumnVector(b))
                    return true;

                else if (Selection.isRowVector(b))
                    return a.row == b.row;

                else if (Selection.isColumnVectorRange(b))
                    return true;

                else if (Selection.isRowVectorRange(b))
                    return a.row >= b.from.row && a.row <= b.to.row;

                else return false;
            },
            colvec(a, b): boolean {
                return isColliding(b, a);
            },
            rowvec(a, b): boolean {
                return isColliding(b, a);
            }
        } satisfies { [K in KeysMatching<Name, CellGroup>]: (a: Name[K], b: CellGroup) => boolean })[getGroupType(a)](a as any, b);
    }

    export function boundingRange(a: Selection.CellGroup, b: Selection.CellGroup): Selection.CellGroup | null {
        if (Selection.isCell(a) && Selection.isCell(b)) {
            return Selection.rangeFromCell(a, b);
        } else if (Selection.isRange(a) && Selection.isRange(b)) {
            let min = {
                row: Math.min(a.from.row, b.from.row),
                col: Math.min(a.from.col, b.from.col),
            };
            let max = {
                row: Math.min(a.to.row, b.to.row) + 1,
                col: Math.min(a.to.col, b.to.col) + 1,
            };

            return Selection.rangeFromCell(min, max);
        }

        return null;
    }

    export function isAdjacent(a: Selection.CellGroup, b: Selection.CellGroup): boolean {
        if (Selection.isCell(a) && Selection.isCell(b))
            return Math.abs(a.col - b.col) <= 1 && Math.abs(a.row - b.row) <= 1;

        // if (Selection.isRange(a) && Selection.isRange(b))

        return false;
    }

    /// Reduces the list of selected ranges such that each cell appears at most once.
    /// This function appears to complete in O(n**2) time, so use sparingly.
    export function simplify(selection: CellGroup[]): CellGroup[] {
        const reduced: CellGroup[] = [];

        for (const a of selection.map(i => Selection.isRange(i) ? Selection.normaliseRange(i) : Selection.isVectorRange(i) ? Selection.normaliseVectorRange(i) : i)) {
            let didCollide = false;
            for (const [index, b] of reduced.map((i, a) => [a, i] as const))
                if (isColliding(a, b)) {
                    didCollide = true;

                    if (Selection.isRange(a) && Selection.isRange(b) && !Selection.eqRange(a, b))
                        if (Selection.isSubrangeOf(a, b)) // b is completely contained within a
                            reduced[index] = a;

                        else if (!Selection.isSubrangeOf(b, a)) {
                            // To simplify this function, we slice A horizontally and B vertically

                            const bounded = Selection.boundingRange(a, b);
                            if (bounded)
                                reduced.splice(index, 1, bounded);

                            // const a_split: Range[] = [{
                            //
                            // }];
                            // const b_split: Range[] = [
                            //
                            // ];
                            //
                            // const ranges: Range[] = [...a_split, ...b_split]
                            //     .map(i => Selection.normaliseRange(i));
                            // reduced.splice(index, 1, ...ranges.filter(i => Selection.area(i) > 0));
                        }

                    // else Do nothing, the range is covered by `b`

                    // Do nothing else because:
                    // - Cell is covered by the case above (Do nothing)
                    // - If ranges equal, only keep one, thus do nothing
                    // - Vectors always take precedence over range, thus do nothing
                } else if (isAdjacent(a, b)) {
                    const bounded = Selection.boundingRange(a, b);
                    if (bounded)
                        reduced.splice(index, 1, bounded);
                }

            if (!didCollide)
                reduced.push(a);
        }

        // merge adjacent selections if the orthogonal axis upon which they intersect are equal

        // IE |__|__| would get merged because they both span two units horizontally and share the same `from` horizontal coordinate
        //    |  |  |

        return reduced;
    }

    export function stringify(cell: Cell): string {
        const toLetterString = (num: number): string => num >= 26 ? `${toLetterString(num / 26 - 1)}${String.fromCharCode('A'.charCodeAt(0) + num % 26)}` : `${String.fromCharCode('A'.charCodeAt(0) + num % 26)}`;

        return `${toLetterString(cell.col)}${cell.row.toFixed()}`
    }

    export function parse(str: string): Cell | null {
        const match = str.match(/^([a-zA-Z]+)(\d+)$/);

        if (!match)
            return null;

        const column = [...match[1].toLowerCase()]
            .map(i => i.charCodeAt(0) - "a".charCodeAt(0))
            .reduce((a, i) => a * 26 + i, 0);

        return {row: Number(match[2]), col: column};
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