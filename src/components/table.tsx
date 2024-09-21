import React from "react"
import Spreadsheet, {Value} from "../viewport.js";
import ValueEditor from "./valueEditor.js";

export const DEFAULT_COLUMN_WIDTH = 128;
export const MIN_COLUMN_WIDTH = 24;

export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_ROW_HEIGHT = 6;

interface TableProps {
    raw: Spreadsheet,
    children?: React.ReactNode[],
    columnWidths: number[],
    rowHeights: number[],
    mouseUp: (row: number, col: number) => void
    mouseMove: (row: number, col: number) => void
    mouseDown: (row: number, col: number) => void,
    moveEditor: (relX: number, relY: number) => void
}

export default function Table(props: TableProps) {
    function handleKeyUp(e: React.KeyboardEvent<HTMLElement>) {
        if (e.key == "Enter" && !e.ctrlKey)
            props.moveEditor(0, 1);
        else if (e.key == "Enter" && e.ctrlKey)
            props.moveEditor(0, -1);
        else if (e.key == "Tab" && !e.ctrlKey)
            props.moveEditor(1, 0);
        else if (e.key == "Tab" && e.ctrlKey)
            props.moveEditor(-1, 0);
    }

    return <section
        className={"table-container"}
        style={{
            gridAutoColumns: `min-content ${props.columnWidths.map(i => `${i ?? DEFAULT_COLUMN_WIDTH}px`).join(' ')} min-content`,
            gridAutoRows: `min-content ${props.rowHeights.map(i => `${i ?? DEFAULT_ROW_HEIGHT}px`).join(' ')}`,
        }}
        onKeyUp={e => handleKeyUp(e)}>

        <div className={"top-left-corner"}/>

        {props.children ?? null}

        {props.raw.raw.map((values, row) => values.map((value, col) => <TableCell
            key={`cell-${row}:${col}`}
            row={row}
            col={col}
            mouseUp={(row, col) => props.mouseUp(row, col)}
            mouseMove={(row, col) => props.mouseMove(row, col)}
            mouseDown={(row, col) => props.mouseDown(row, col)}>{value}</TableCell>))}

    </section>;
}

export function TableCell(props: {
    children: Value,
    row: number,
    col: number,
    mouseUp: (row: number, col: number) => void
    mouseMove: (row: number, col: number) => void
    mouseDown: (row: number, col: number) => void
}) {
    return <div
        className={"table-cell"}
        onMouseUp={e => e.button == 0 && props.mouseUp(props.row, props.col)}
        onMouseMove={e => e.button == 0 && props.mouseMove(props.row, props.col)}
        onMouseDown={e => e.button == 0 && props.mouseDown(props.row, props.col)}
        style={{
            gridRow: props.row + 2,
            gridColumn: props.col + 2
        }}>
            <ValueEditor value={props.children} />
        
            {/* {props.children.render(state.editMode, () => setState(prev => ({ ...prev, editMode: false })))} */}
            {/* {props.children.renderer().cell(props.children)} */}
    </div>;
}