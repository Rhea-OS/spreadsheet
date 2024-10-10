import React from 'react';
import * as obs from 'obsidian';

import Spreadsheet, {Selection} from './viewport.js';
import Table, {DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT} from './components/table.js';
import Toolbar from "./components/toolbar.js";
import {Settings} from "./settings/settingsTab.js";
import {handleKeyDown} from './components/valueEditor.js';

export type ResizeState = {
    isResizing: false,
} | {
    isResizing: true,
    prevMouse: { x: number, y: number },
    prevSize: { width: number, height: number },
    onResize: (size: { width: number, height: number }) => void
};

export function Ui(props: { sheet: Spreadsheet, settings: Settings }) {
    const [, setResize] = React.useState<ResizeState>({
        isResizing: false,
    });
    // const [isRenamingColumn, setIsRenamingColumn] = React.useState<null | number>(0);
    // const columnName = React.useRef<HTMLInputElement>(null);
    //
    // React.useMemo(() => {
    //     if (columnName.current) {
    //         let ev;
    //
    //         // columnName.current.addEventListener("blur", ev = function() {
    //         //     setIsRenamingColumn(null);
    //         //     columnName.current?.removeEventListener("blur", ev!);
    //         // });
    //
    //         columnName.current.focus();
    //         // columnName.current.select();
    //     }
    // }, [columnName]);

    const [selection, setSelection] = React.useState({
        selection: [{row: 0, col: 0}] as Selection.CellGroup[],
        startCell: null as null | Selection.Cell | Selection.Vector,
        notFinished: null as null | Selection.Cell | Selection.Vector
    });

    React.useEffect(() => {
        props.sheet.state.dispatch("sync-selection", {selection: selection.selection});
        props.sheet.state.dispatch("change-active", {activeCell: null});
    }, [selection.selection]);

    const renameColumn = (col: number) => () => {
        (new class extends obs.Modal {
            constructor() {
                super(props.sheet.app);

                const frag = new DocumentFragment();

                const container = frag.createDiv({cls: ["input-modal"]});
                container.createEl("input", {cls: ["input", "setting", "fill"], attr: {type: "text"}}, input => {
                    input.value = props.sheet.documentProperties.columnTitles[col];

                    input.focus();
                    input.select();

                    input
                        .addEventListener("change", e => props.sheet.updateDocumentProperties(prev => ({
                            columnTitles: prev.columnTitles.with(col, (e.target as HTMLInputElement).value)
                        })));

                    input.addEventListener("keydown", e => {
                        if (e.key != 'Enter')
                            return;

                        e.preventDefault();
                        this.close();
                    })
                });

                container.createDiv({ cls: ["buttons"] })
                    .createEl("button", { cls: ["button"], text: "Rename" }, btn => btn.addEventListener("click", () => this.close()));

                this.setContent(frag)
                    .setTitle("Rename Column");
            }
        }).open();
    };

    // React.useEffect(() => props.sheet.state.dispatch("change-active", { activeCell: null }), [isRenamingColumn]);

    const documentProperties = React.useSyncExternalStore(props.sheet.onExternalChange, () => props.sheet.documentProperties);

    const beginSelection = (start: Selection.Cell | Selection.Vector) => setSelection(prev => ({
        ...prev,
        startCell: start
    }));
    const alterSelection = (cell: Selection.Cell | Selection.Vector) => setSelection(prev => ({
        ...prev,
        notFinished: cell
    }));
    const endSelection = (cell: Selection.Cell | Selection.Vector, replace: boolean) => {
        if (replace)
            setSelection(prev => ({
                ...prev,
                selection: prev.startCell ? [Selection.rangeFromCell(prev.startCell, cell)].filter((i: Selection.CellGroup | null): i is Selection.CellGroup => !!i) : [],
                notFinished: null,
                startCell: null
            }));
        else
            setSelection(prev => ({
                ...prev,
                selection: prev.startCell ? [...prev.selection, Selection.rangeFromCell(prev.startCell, cell)].filter((i: Selection.CellGroup | null): i is Selection.CellGroup => !!i) : prev.selection,
                notFinished: null,
                startCell: null
            }));
    };


    const container = React.createRef<HTMLDivElement>();
    React.useEffect(() => container.current?.focus(), [container]);

    return <section
        className={"table-widget"}
        tabIndex={-1}
        ref={container}
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
            setResize({isResizing: false});
            setSelection(prev => ({...prev, startCell: null}));
        }}
        onKeyDownCapture={e => {
            if (!props.sheet.state.get().activeCell)
                if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key != "Tab" && e.key != "Enter")
                    props.sheet.state.dispatch('change-active', prev => ({
                        activeCell: Selection.topLeft(prev.selection)
                    }));
        }}>

        <Toolbar settings={props.settings} sheet={props.sheet}/>

        <Table raw={props.sheet}
               columnWidths={documentProperties.columnWidths}
               rowHeights={documentProperties.rowHeights}

               mouseUp={(row, col) => endSelection({row, col}, true)}
               mouseMove={(row, col) => alterSelection({row, col})}
               mouseDown={(row, col) => beginSelection({row, col})}>

            <>
                {documentProperties.columnTitles.map((column, col) =>
                    <div className={"table-header-cell"}
                         key={`table-header-${col}`}
                         style={{
                             gridColumn: col + 2,
                             gridRow: 1
                         }}
                         onContextMenu={e => columnContextMenu(e, col, props.sheet, renameColumn(col))}
                         onDoubleClick={e => renameColumn(col)()}
                         onMouseDown={e => () => e.button == 0 && beginSelection({col})}
                         onMouseMove={e => selection.startCell && Selection.isVector(selection.startCell) && e.button == 0 && alterSelection({col})}
                         onMouseUp={e => () => e.button == 0 && endSelection({col}, true)}>

                        <div className={"column-title"}>
                            {column}
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
                        })}/>
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
                    onMouseDown={e => () => beginSelection({row})}
                    onMouseMove={e => selection.startCell && Selection.isVector(selection.startCell) && e.button == 0 && alterSelection({row})}
                    onMouseUp={e => () => endSelection({row}, true)}
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
                        })}/>
                </div>)}
            </>

            <SelectionIndicator selection={selection} sheet={props.sheet}/>

        </Table>
    </section>;
}

export function SelectionIndicator({selection, sheet}: {
    selection: {
        selection: Selection.CellGroup[],
        startCell: null | Selection.Cell | Selection.Vector,
        notFinished: null | Selection.Cell | Selection.Vector
    },
    sheet: Spreadsheet
}) {
    return <>
        {[...selection.selection, ...(selection.startCell && selection.notFinished ? [Selection.rangeFromCell(selection.startCell, selection.notFinished)] : [])]
            .filter(i => !!i)
            .map((selection, a) => {
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
                                    gridColumnEnd: sheet.raw[0].length + 2, // TODO: Figure out why CSS grid isn't accepting end values
                                    gridRowStart: selection.from.row + 2,
                                    gridRowEnd: selection.to.row + 3
                                }}/>

                else if (Selection.isColumnVectorRange(selection))
                    return <div className="selection-range column-vector"
                                key={`selection-${a}`}
                                style={{
                                    gridRowStart: 1,
                                    gridRowEnd: sheet.raw.length + 2,
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
                                    gridRowEnd: sheet.raw.length + 2,
                                    gridColumn: selection.col + 2
                                }}/>

                else if (Selection.isRowVector(selection))
                    return <div className="selection-range row-vector"
                                key={`selection-${a}`}
                                style={{
                                    gridRow: selection.row + 2,
                                    gridColumnStart: 1,
                                    gridColumnEnd: sheet.raw[0].length + 2
                                    // gridColumn: '1 / -1',
                                }}/>
            })}
    </>
}

export function columnContextMenu(e: React.MouseEvent, col: number, sheet: Spreadsheet, editColumn: () => void) {
    const menu = new obs.Menu();

    menu.addItem(item => item
        .setIcon("pencil")
        .setTitle("Rename Column")
        .onClick(_ => editColumn()));

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

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("arrow-up-narrow-wide")
        .setTitle(`Sort by ${sheet.documentProperties.columnTitles[col]}`)
        .onClick(e => void 0));

    menu.addItem(item => item
        .setIcon("arrow-down-wide-narrow")
        .setTitle(`Sort by ${sheet.documentProperties.columnTitles[col]} (Descending)`)
        .onClick(e => void 0));

    menu.addItem(item => item
        .setIcon("filter")
        .setTitle(`Filter on ${sheet.documentProperties.columnTitles[col]}`)
        .onClick(e => void 0));

    menu.addItem(item => item
        .setIcon("group")
        .setTitle(`Group by ${sheet.documentProperties.columnTitles[col]}`)
        .onClick(e => void 0));

    menu.showAtMouseEvent(e.nativeEvent);
}

export function rowContextMenu(e: React.MouseEvent, row: number, sheet: Spreadsheet) {
    sheet.state.dispatch('change-active', {activeCell: null});

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