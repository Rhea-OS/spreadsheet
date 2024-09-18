import React from 'react';
import * as obs from 'obsidian';

import Spreadsheet, { Selection } from './viewport.js';
// import FormulaBar, { renderers } from './formula.js';
import Table, { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, MIN_ROW_HEIGHT } from './table.js';

export type ResizeState = {
    isResizing: false,
} | {
    isResizing: true,
    prevMouse: { x: number, y: number },
    prevSize: { width: number, height: number },
    onResize: (size: { width: number, height: number }) => void
};

export function Ui(props: { sheet: Spreadsheet }) {
    // const [active, setActive] = React.useState(props.sheet.raw[0][0]);
    const [, setResize] = React.useState<ResizeState>({
        isResizing: false,
    });
    const [isRenamingColumn, setIsRenamingColumn] = React.useState<null | number>(null);

    const [selection, setSelection] = React.useState({
        selection: [{ row: 0, col: 0 }] as Selection.CellGroup[],
        startCell: null as null | Selection.Cell | Selection.Vector
    });

    const documentProperties = React.useSyncExternalStore(props.sheet.onExternalChange, () => props.sheet.documentProperties);

    const beginSelection = (start: Selection.Cell | Selection.Vector) => setSelection(prev => ({
        ...prev,
        startCell: start
    }));
    const alterSelection = (cell: Selection.Cell) => {};
    const endSelection = (cell: Selection.Cell | Selection.Vector, replace: boolean) => {
        if (replace)
            setSelection(prev => ({
                ...prev,
                selection: prev.startCell ? [Selection.rangeFromCell(prev.startCell, cell)].filter((i: Selection.CellGroup | null): i is Selection.CellGroup => !!i) : []
            }));
        else
            setSelection(prev => ({
                ...prev,
                selection: prev.startCell ? [...prev.selection, Selection.rangeFromCell(prev.startCell, cell)].filter((i: Selection.CellGroup | null): i is Selection.CellGroup => !!i) : prev.selection
            }));
    };

    // React.useEffect(() => {
    //     if (!selection.selection[0])
    //         setActive(props.sheet.raw[0][0]);

    //     else if (Selection.isCell(selection.selection[0]))
    //         setActive(props.sheet.raw[selection.selection[0].row][selection.selection[0].col]);

    //     else if (Selection.isRange(selection.selection[0])) {
    //         const range = Selection.normaliseRange(selection.selection[0]);
    //         setActive(props.sheet.raw[range.from.row][range.from.col]);
    //     } else if (Selection.isRowVector(selection.selection[0]))
    //         setActive(props.sheet.raw[selection.selection[0].row][0]);
    //     else if (Selection.isColumnVector(selection.selection[0]))
    //         setActive(props.sheet.raw[0][selection.selection[0].col])
    //     else if (Selection.isRowVectorRange(selection.selection[0])) {
    //         const range = Selection.normaliseVectorRange(selection.selection[0]) as Selection.RowVectorRange;
    //         setActive(props.sheet.raw[range.from.row][0]);
    //     } else if (Selection.isColumnVectorRange(selection.selection[0])) {
    //         const range = Selection.normaliseVectorRange(selection.selection[0]) as Selection.ColumnVectorRange;
    //         setActive(props.sheet.raw[0][range.from.col]);
    //     }
    // }, [selection]);

    return <section
        className={"table-widget"}
        onMouseMove={e => setResize(prev => {
            if (!prev.isResizing)
                return prev;

            const size = {
                width: prev.prevSize.width + (e.clientX - prev.prevMouse.x),
                height: prev.prevSize.height + (e.clientY - prev.prevMouse.y),
            };

            prev.onResize(size);

            return {
                isResizing: true,
                prevMouse: {
                    x: e.clientX,
                    y: e.clientY,
                },
                prevSize: size, 
                onResize: prev.onResize
            };
        })}
        onMouseUp={() => {
            setResize({ isResizing: false });
            setSelection(prev => ({ ...prev, startCell: null }));
        }}>

        {/*<SelectionBar/>*/}

        {/* <FormulaBar selection={selection.selection} /> */}

        <Table raw={props.sheet.raw}
            columnWidths={documentProperties.columnWidths}
            rowHeights={documentProperties.rowHeights}

            mouseUp={(row, col) => endSelection({ row, col }, true)}
            mouseMove={(row, col) => alterSelection({ row, col })}
            mouseDown={(row, col) => beginSelection({ row, col })}>

            <>
                {documentProperties.columnTitles.map((column, col) =>
                    <div className={"table-header-cell"}
                        key={`table-header-${col}`}
                        style={{
                            gridColumn: col + 2,
                            gridRow: 1
                        }}
                        onContextMenu={e => columnContextMenu(e, col, props.sheet, setIsRenamingColumn)}
                        onDoubleClick={e => setIsRenamingColumn(col)}
                        onMouseDown={e => beginSelection({ col })}
                        onMouseUp={e => endSelection({ col }, true)}>
                        <div className={"column-title"}>
                            {isRenamingColumn == col ? <input
                                type={"text"}
                                className={"column-title-rename"}
                                value={column}
                                autoFocus={true}
                                onFocus={e => e.currentTarget.select()}
                                onBlur={e => setIsRenamingColumn(null)}
                                onKeyUp={e => ["Tab", "Enter"].includes(e.key) && setIsRenamingColumn(null)}
                                onChange={e => props.sheet.updateDocumentProperties(prev => ({
                                    columnTitles: prev.columnTitles.with(col, e.currentTarget.value)
                                }))} /> : column}
                            {props.sheet.columnType(col) != 'raw' ?
                                <div className={"nav-file-tag"}>
                                    {props.sheet.columnType(col)}
                                </div> : null}
                        </div>
                        <span className={"resize-handle"} onMouseDown={e => setResize({
                            isResizing: true,
                            prevMouse: {
                                x: e.clientX,
                                y: e.clientY
                            },
                            prevSize: {
                                width: documentProperties.columnWidths[col] ?? DEFAULT_COLUMN_WIDTH,
                                height: e.currentTarget.innerHeight
                            },
                            onResize: size => props.sheet.updateDocumentProperties(prev => ({
                                columnWidths: prev.columnWidths.with(col, Math.max(size.width, MIN_COLUMN_WIDTH))
                            }))
                        })} />
                    </div>)}
            </>
            <>
                {documentProperties.rowHeights.map((_, row) => <div
                    key={`row-title-${row}`}
                    className={"row"}
                    style={{
                        gridColumn: 1,
                        gridRow: row + 2
                    }}
                    onMouseDown={e => beginSelection({ row })}
                    onMouseUp={e => endSelection({ row }, true)}
                    onContextMenu={e => rowContextMenu(e, row, props.sheet)}>
                    <div className={"row-title"}>{row + 1}</div>
                    <span
                        className={"resize-handle horizontal"}
                        onMouseDown={e => setResize({
                            isResizing: true,
                            prevMouse: {
                                x: e.clientX,
                                y: e.clientY
                            },
                            prevSize: {
                                height: documentProperties.rowHeights[row] ?? DEFAULT_ROW_HEIGHT,
                                width: e.currentTarget.innerWidth
                            },
                            onResize: size => props.sheet.updateDocumentProperties(prev => ({
                                rowHeights: prev.rowHeights.with(row, Math.max(size.height, MIN_ROW_HEIGHT))
                            }))
                        })} />
                </div>)}
            </>

            <>{selection.selection.map(selection => {
                if (Selection.isRange(selection))
                    return <div className="selection-range" 
                                style={{
                                    gridRowStart: selection.from.row + 2,
                                    gridRowEnd: selection.to.row + 3,
                                    gridColumnStart: selection.from.col + 2,
                                    gridColumnEnd: selection.to.col + 3,
                                }}/>

                else if (Selection.isRowVectorRange(selection))
                    return <div className="selection-range row-vector" 
                                style={{
                                    gridColumnStart: 1,
                                    gridColumnEnd: props.sheet.raw[0].length + 2, // TODO: Figure out why CSS grid isn't accepting end values
                                    gridRowStart: selection.from.row + 2,
                                    gridRowEnd: selection.to.row + 3
                                }}/>

                else if (Selection.isColumnVectorRange(selection))
                    return <div className="selection-range column-vector" 
                                style={{
                                    gridRowStart: 1,
                                    gridRowEnd: props.sheet.raw.length + 2,
                                    gridColumnStart: selection.from.col + 2,
                                    gridColumnEnd: selection.to.col + 3
                                }}/>

                else if (Selection.isCell(selection))
                    return <div className="selection-range" 
                                style={{
                                    gridRow: selection.row + 2,
                                    gridColumn: selection.col + 2
                                }}/>
                
                else if (Selection.isColumnVector(selection))
                    return <div className="selection-range column-vector" 
                                style={{
                                    // gridRow: '1 / -1',
                                    gridRowStart: 1,
                                    gridRowEnd: props.sheet.raw.length + 2,
                                    gridColumn: selection.col + 2
                                }}/>

                else if (Selection.isRowVector(selection))
                    return <div className="selection-range row-vector" 
                                style={{
                                    gridRow: selection.row + 2,
                                    gridColumnStart: 1,
                                    gridColumnEnd: props.sheet.raw[0].length + 2
                                    // gridColumn: '1 / -1',
                                }}/>
            })}</>

        </Table>
    </section>;
}

export function columnContextMenu(e: React.MouseEvent, col: number, sheet: Spreadsheet, setIsRenamingColumn: React.Dispatch<React.SetStateAction<null | number>>) {
    const menu = new obs.Menu();

    menu.addItem(item => item
        .setIcon("pencil")
        .setTitle("Rename Column")
        .onClick(_ => setIsRenamingColumn(col)));

    menu.addItem(item => {
        const submenu = (item
            .setIcon("languages")
            .setTitle("Set column format") as any as { setSubmenu: () => obs.Menu })
            .setSubmenu();

        // for (const [key, ren] of Object.entries(renderers))
        //     submenu.addItem(item => item
        //         .setIcon(ren.friendlyName.icon ?? null)
        //         .setTitle(ren.friendlyName.label)
        //         .onClick(_ => sheet.editFormat(col, key)));
    });

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("arrow-left-to-line")
        .setTitle("Swap column leftwards"));
    menu.addItem(item => item
        .setIcon("arrow-right-to-line")
        .setTitle("Swap column rightwards"));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert column before")
        .onClick(_ => sheet.insertCol(col - 1)));
    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert column after")
        .onClick(_ => sheet.insertCol(col)));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("trash-2")
        .setTitle("Delete Column")
        .onClick(e => sheet.removeCol(col)));

    menu.showAtMouseEvent(e.nativeEvent);
}

export function rowContextMenu(e: React.MouseEvent, row: number, sheet: Spreadsheet) {
    const menu = new obs.Menu();

    menu.addItem(item => item
        .setIcon("arrow-up-to-line")
        .setTitle("Swap row upwards"));
    menu.addItem(item => item
        .setIcon("arrow-down-to-line")
        .setTitle("Swap row downwards"));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert row above")
        .onClick(_ => sheet.insertRow(row - 1)));
    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert row below")
        .onClick(_ => sheet.insertRow(row)));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("trash-2")
        .setTitle("Delete Row")
        .onClick(e => sheet.removeRow(row)));

    menu.showAtMouseEvent(e.nativeEvent);
}