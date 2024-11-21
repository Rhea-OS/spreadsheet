import React from 'react';
// import useResizeObserver from '@react-hook/resize-observer';
import useMousePosition from '@react-hook/mouse-position';

import {DocumentProperties, Value} from "../csv.js";
import {StateHolder} from "../main.js";
import SelectionIndicator, {Selection} from "../selection.js";

export const DEFAULT_COLUMN_WIDTH = 128;
export const MIN_COLUMN_WIDTH = 24;

export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_ROW_HEIGHT = 6;

// export type ColumnHeader = () => React.ReactNode;
export interface ColumnHeader {
    title: string,
    width: number,
    index: number,

    render: (col: ColumnHeader) => React.ReactNode
}

interface TableRow {
    id: number;

    data: Record<string, () => React.ReactNode>
}

export interface TableProps<Row extends TableRow> {
    children: {
        data: Row[],
        selection?: Selection.CellGroup[]
    },
    sheet: StateHolder,

    renderColumn: (col: ColumnHeader) => React.ReactNode,
    renderRow: (row: number) => React.ReactNode
}

export default function Table<Row extends TableRow>(props: TableProps<Row>) {

    const [columns, setColumns] = React.useState<ColumnHeader[]>([]);

    const ref = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => void setColumns(props.sheet.documentProperties.columnTitles.map((col, colIndex) => ({
        title: col,
        width: columns?.[colIndex]?.width ?? DEFAULT_COLUMN_WIDTH,
        render: props.renderColumn,
        index: colIndex
    }))), [props.sheet.documentProperties]);

    // props.sheet.state.setState({ columnWidths: columns.map(i => i.width ?? DEFAULT_COLUMN_WIDTH) })
    //
    // props.sheet.state.on("resize-column", state => setColumns(prev => prev.map((i, a) => ({
    //     ...i,
    //     width: state.columnWidths[a] ?? DEFAULT_COLUMN_WIDTH
    // }))));
    //
    // React.useEffect(() => void props.sheet.state.setState({
    //     columnWidths: columns.map(i => i.width)
    // }), [columns]);

    const resizeColumn = (colIndex: number, width: number) => setColumns(prev => prev.with(colIndex, {
        ...prev[colIndex],

        width: Math.max(MIN_COLUMN_WIDTH, width),
    }));

    return <section
        className={"table-widget"}
        ref={ref}
        onMouseOut={e => void 0}>

        <section
            className={"table-container"}
            style={{
                gridAutoColumns: `min-content ${columns.slice(0, -1).map(i => `${i.width ?? DEFAULT_COLUMN_WIDTH}px`).join(' ')} 1fr min-content`,
                gridAutoRows: `min-content`, //  ${props.rowHeights.map(i => `${i ?? DEFAULT_ROW_HEIGHT}px`).join(' ')}
            }}>

            <div className={"top-left-corner"}/>

            {columns.map((header, colIndex) => <TableHeaderCell
                onResize={size => resizeColumn(colIndex, size)}
                header={header}
                colIndex={colIndex}
            />)}

            {props.children.data.map((row, rowIndex) => <>
                <div
                    className={["row", rowIndex % 2 == 0 ? '' : 'odd'].join(' ')}
                    style={{
                        gridColumn: 1,
                        gridRow: rowIndex + 2
                    }}>
                    {props.renderRow(rowIndex)}
                </div>

                {columns.map((col, colIndex) => <div
                    className={["table-cell", rowIndex % 2 == 0 ? '' : 'odd'].join(' ')}
                    key={`table-cell-${colIndex}:${rowIndex}`}
                    style={{
                        gridRow: rowIndex + 2,
                        gridColumn: colIndex + 2
                    }}>
                    {row.data[col.title]?.() ?? ""}
                </div>)}
            </>)}

            {props.children.selection ?
                <SelectionIndicator selection={props.children.selection} sheet={props.sheet}/> : null}

        </section>
    </section>;
}

export function TableHeaderCell(props: {
    onResize?: (width: number) => void,
    header: ColumnHeader,
    colIndex: number
}) {
    const ref = React.useRef<HTMLDivElement>(null);

    const [state, setState] = React.useState({
        width: props.header.width ?? DEFAULT_COLUMN_WIDTH,
        prevMouseX: null as null | number
    });

    // @ts-ignore
    const mouse = useMousePosition(document.body, {fps: 60});

    React.useEffect(() => {
        if (state.prevMouseX && mouse.isDown)
            setState(prev => ({
                width: prev.width + (mouse.x - (prev.prevMouseX ?? mouse.x)),
                prevMouseX: mouse.x
            }));
        else if (state.prevMouseX && !mouse.isDown)
            setState(prev => ({
                width: prev.width,
                prevMouseX: null
            }))
    }, [mouse]);

    if (props.onResize)
        React.useEffect(() => props.onResize?.(state.width), [state]);

    return <header
        className={"table-header-cell"}
        key={`table-header-${props.colIndex}`}
        style={{
            gridColumn: props.colIndex + 2,
            gridRow: 1,
        }}
        ref={ref}>

        {props.header.render(props.header)}

        {props.onResize ? <span className={"resize-handle"}
                                onMouseDown={e => {
                                    setState(prev => ({
                                        ...prev,
                                        prevMouseX: mouse.x
                                    }))
                                }}></span> : null}

    </header>
}

export function columnHeadersFromDocument(document: StateHolder, render: (col: ColumnHeader) => React.ReactNode): Record<string, ColumnHeader> {
    return Object.fromEntries(document.documentProperties.columnTitles.map((col, colIndex) => [col, {
        title: col,
        width: document.documentProperties.columnWidths[colIndex],
        index: colIndex,
        render
    }]))
}

export function mkTableCell<Row extends TableRow>(document: StateHolder, child: (col: Value, addr: Selection.Cell) => React.ReactNode, selection?: Selection.CellGroup[]): TableProps<Row>["children"] {
    return {
        data: document.doc.raw.map((row, rowIndex) => ({
            id: rowIndex,
            data: Object.fromEntries(row.map((col, colIndex) => [
                document.documentProperties.columnTitles[colIndex],
                () => child(col, {col: colIndex, row: rowIndex})
            ]))
        })) as Row[],
        selection
    }
}