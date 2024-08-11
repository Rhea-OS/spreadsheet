import React from "react"
import {Value} from "./spreadsheet.js";

export const DEFAULT_COLUMN_WIDTH = 128;
export const MIN_COLUMN_WIDTH = 24;

export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_ROW_HEIGHT = 6;

interface TableProps {
    raw: Value[][],
    children?: React.ReactNode[],
    columnWidths: number[],
    rowHeights: number[],
    mouseUp: (row: number, col: number) => void
    mouseDown: (row: number, col: number) => void
}

export default function Table(props: TableProps) {
    return <section
        className={"table-container"}
        style={{
            gridAutoColumns: `min-content ${props.columnWidths.map(i => `${i ?? DEFAULT_COLUMN_WIDTH}px`).join(' ')} min-content`,
            gridAutoRows: `min-content ${props.rowHeights.map(i => `${i ?? DEFAULT_ROW_HEIGHT}px`).join(' ')}`,
        }}>

        <div className={"top-left-corner"}/>

        {props.children ?? null}

        {props.raw.map((values, row) => values.map((value, col) => <TableCell
            key={`cell-${row}:${col}`}
            row={row}
            col={col}
            mouseUp={(row, col) => props.mouseUp(row, col)}
            mouseDown={(row, col) => props.mouseDown(row, col)}>{value}</TableCell>))}

    </section>;
}

export function TableCell(props: {
    children: Value,
    row: number,
    col: number,
    mouseUp: (row: number, col: number) => void
    mouseDown: (row: number, col: number) => void
}) {
    return <div
        className={"table-cell"}
        onMouseUp={e => props.mouseUp(props.row, props.col)}
        onMouseDown={e => props.mouseUp(props.row, props.col)}
        style={{
            gridRow: props.row + 2,
            gridColumn: props.col + 2
        }}
    >{props.children.renderer().cell(props.children)}</div>;
}