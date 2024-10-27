import React from "react"

import Spreadsheet, {Selection, SPREADSHEET_VIEW} from "../viewport.js";
import ValueEditorOld from "./valueEditor.old.js";
import {Value} from "../csv.js";
import {StateHolder} from "../spreadsheet.js";

export const DEFAULT_COLUMN_WIDTH = 128;
export const MIN_COLUMN_WIDTH = 24;

export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_ROW_HEIGHT = 6;

interface TableProps {
    children?: React.ReactNode[],
    spreadsheet: StateHolder,
    columnWidths: number[],
    rowHeights: number[],
    mouseUp: (row: number, col: number) => void
    mouseMove: (row: number, col: number) => void
    mouseDown: (row: number, col: number) => void,
}

let syncGlobState: (onStateChange: () => void) => () => void;
let getGlobState: () => any;

export default function TableOld(props: TableProps) {
    React.useSyncExternalStore(syncGlobState ??= onStateChange => {
        const off = props.spreadsheet.state.onStateChange(onStateChange);
        return () => props.spreadsheet.state.off(off);
    }, getGlobState ??= () => props.spreadsheet.state.get());

    return <section
        className={"table-container"}
        style={{
            gridAutoColumns: `min-content ${props.columnWidths.map(i => `${i ?? DEFAULT_COLUMN_WIDTH}px`).join(' ')} min-content`,
            gridAutoRows: `min-content ${props.rowHeights.map(i => `${i ?? DEFAULT_ROW_HEIGHT}px`).join(' ')}`,
        }}>

        <div className={"top-left-corner"}/>

        {props.children ?? null}

        {props.spreadsheet.doc.raw.map((values, row) => values.map((value, col) => <TableCell
            key={`cell-${row}:${col}`}
            row={row}
            col={col}
            spreadsheet={props.spreadsheet}
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
    mouseDown: (row: number, col: number) => void,
    spreadsheet: StateHolder
}) {
    const [edit, setEdit] = React.useState(false);

    React.useEffect(() => {
        const off = props.spreadsheet.state.on('change-active', state => setEdit(state.activeCell ? Selection.eqCell(state.activeCell, { row: props.row, col: props.col }) : false));
        return () => props.spreadsheet.state.off(off);
    }, []);

    React.useEffect(() => props.spreadsheet.state.dispatch('change-active', {
        activeCell: edit ? { row: props.row, col: props.col } : null,
    }), [edit]);

    const handleEditMode = (e: React.MouseEvent<HTMLElement>, ok: () => void) => {
        if (props.spreadsheet.state.get().activeCell == null) {
            ok();
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
            <ValueEditorOld value={props.children} edit={edit} setEdit={edit => setEdit(edit)} spreadsheet={props.spreadsheet}/>
        
            {/* {props.children.render(state.editMode, () => setState(prev => ({ ...prev, editMode: false })))} */}
            {/* {props.children.renderer().cell(props.children)} */}
    </div>;
}