import React from "react"

import Spreadsheet, {Value, Selection} from "../viewport.js";
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
    const [edit, setEdit] = React.useState(false);

    React.useEffect(() => {
        const off = props.children.spreadsheet().state.on('change-active', state => setEdit(state.activeCell ? Selection.eqCell(state.activeCell, { row: props.row, col: props.col }) : false));
        return () => props.children.spreadsheet().state.off(off);
    }, []);

    React.useEffect(() => {
        if (edit)
            props.children.spreadsheet().state.dispatch('change-active', {
                activeCell: { row: props.row, col: props.col },
            });
    }, [edit]);

    const handleEditMode = (e: React.MouseEvent<HTMLElement>, ok: () => void) => {
        if (props.children.spreadsheet().state.get().activeCell == null)
            ok();
        else {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return <div
        className={"table-cell"}
        onMouseUp={e => handleEditMode(e, () => e.button == 0 && props.mouseUp(props.row, props.col))}
        onMouseMove={e => handleEditMode(e, () => e.button == 0 && props.mouseMove(props.row, props.col))}
        onMouseDown={e => handleEditMode(e, () => e.button == 0 && props.mouseDown(props.row, props.col))}

        style={{
            gridRow: props.row + 2,
            gridColumn: props.col + 2
        }}>
            <ValueEditor value={props.children} edit={edit} setEdit={edit => setEdit(edit)}/>
        
            {/* {props.children.render(state.editMode, () => setState(prev => ({ ...prev, editMode: false })))} */}
            {/* {props.children.renderer().cell(props.children)} */}
    </div>;
}