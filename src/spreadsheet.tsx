import React from 'react';
import * as rdom from "react-dom/client";
import * as obs from "obsidian";
import StateManager from '@j-cake/jcake-utils/state';
import useEvent from '@react-hook/event';

import SpreadsheetPlugin, {StateHolder} from "./main.js";
import CSVDocument, {DocumentProperties, value, Value} from "./csv.js";
import {Settings} from "./settings/settingsTab.js";
import Toolbar from "./components/toolbar.js";
import Table, {mkTableCell} from "./components/table.js";
import {computedValue} from "./inline.js";
import {Selection} from "./selection.js";
import {columnContextMenu, rowContextMenu} from "./contextMenu.js";
import {renameColumn} from "./renameColumn.js";

export const SPREADSHEET_VIEW = "spreadsheet-view";

export interface EditorState {
    selection: Selection.CellGroup[],
    activeCell: Selection.Cell | null,

    columnWidths: number[],

    // Values will be sorted according to the first key in the list. If two identical values appear, the next key along is used until no keys left. In which case the row number is used. 
    sortRows: string[],

    // Each value in the list will be used to create a subgroup. 
    groupRows: string[],

    // Each row which when passed to all formulas, returns `true` is displayed.
    // filter: Formula[]
}

export default class SpreadsheetView extends obs.TextFileView implements StateHolder {
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

        this.state.on("selection-change", prev => {
            if (prev.activeCell && !this.doc.getValueAt(prev.activeCell)) {
                for (let col = this.doc.documentProperties.columnTitles.length; col <= prev.activeCell.col; col++)
                    this.insertCol();

                for (let row = this.doc.raw.length; row <= prev.activeCell.row; row++)
                    this.insertRow();
            }
        });
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

    public columnType(col: number): string {
        return this.doc.columnType(col)
    }

    public updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>) {
        this.doc.updateDocumentProperties(update);
    }

    onExternalChange(watcher: () => void): () => void {
        return this.doc.onExternalChange(watcher);
    }

    select(relCol: number, relRow: number, expand: boolean = false) {
        const state = this.state.get();

        if (!expand) {
            const cell = state.activeCell || Selection.topLeft(state.selection);

            if (!cell)
                return;

            cell.col = Math.max(0, cell.col + relCol);
            cell.row = Math.max(0, cell.row + relRow);

            this.state.dispatch("selection-change", prev => ({
                // selection: Selection.simplify(expand ? [...prev.selection, cell] : [cell]),
                selection: [cell],
                activeCell: cell,
            }));
        } else {
            let selection = state.activeCell || state.selection.last();

            if (!selection)
                return;

            if (Selection.isCell(selection))
                selection = Selection.normaliseRange({
                    from: {row: selection.row + relRow, col: selection.col + relCol},
                    to: selection
                } satisfies Selection.Range);

            else if (Selection.isRange(selection))
                selection = Selection.normaliseRange({
                    from: {
                        row: Math.max(0, selection.from.row + Math.min(0, relRow)),
                        col: Math.max(0, selection.from.col + Math.min(0, relCol)),
                    },
                    to: {
                        row: Math.max(0, selection.to.row + Math.max(0, relRow)),
                        col: Math.max(0, selection.to.col + Math.max(0, relCol)),
                    },
                } satisfies Selection.Range)

            else if (Selection.isRowVector(selection))
                selection = Selection.normaliseVectorRange({
                    from: {row: Math.max(0, selection.row + Math.min(0, relRow))},
                    to: {row: Math.max(0, selection.row + Math.max(0, relRow))}
                } satisfies Selection.RowVectorRange);

            else if (Selection.isRowVectorRange(selection))
                selection = Selection.normaliseVectorRange({
                    from: {row: Math.max(0, selection.from.row + Math.min(0, relRow))},
                    to: {row: Math.max(0, selection.from.row + Math.max(0, relRow))},
                } satisfies Selection.RowVectorRange)

            else if (Selection.isColumnVector(selection))
                selection = Selection.normaliseVectorRange({
                    from: {col: Math.max(0, selection.col + Math.min(0, relCol))},
                    to: {col: Math.max(0, selection.col + Math.max(0, relCol))}
                } satisfies Selection.ColumnVectorRange);

            else if (Selection.isColumnVectorRange(selection))
                selection = Selection.normaliseVectorRange({
                    from: {col: Math.max(0, selection.from.col + Math.min(0, relCol))},
                    to: {col: Math.max(0, selection.to.col + Math.max(0, relCol))},
                } satisfies Selection.ColumnVectorRange);

            this.state.dispatch("selection-change", prev => ({
                selection: [selection],
                activeCell: null,
            }));
        }
    }

    insertCol(col?: number) {
        this.doc.insertCol(col);
    }

    insertRow(row?: number) {
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
            .render(<Spreadsheet sheet={this} settings={this.plugin.settings}/>);
    }

    protected async onClose(): Promise<void> {
        this.root?.unmount();
    }

    clear(): void {
        this.doc.clear();
    }
}

export function Spreadsheet(props: { sheet: StateHolder, settings: Settings }) {
    const [{sheet}, setSheet] = React.useState({sheet: props.sheet});
    props.sheet.doc.onExternalChange(() => setSheet({sheet: props.sheet}));

    const [selection, setSelection] = React.useState(sheet.state.get().selection);
    const [active, setActive] = React.useState(sheet.state.get().activeCell);

    const [selectionState, setSelectionState] = React.useState<{
        startCell: Selection.Cell | Selection.Vector,
        currentCell: Selection.Cell | Selection.Vector,
    } | null>(null);

    props.sheet.state.on("selection-change", state => {
        setSelection(state.selection);
        setActive(state.activeCell);
    });

    const table = React.useRef<HTMLDivElement>(null);

    function endSelection(e: React.MouseEvent) {
        if (selectionState)
            props.sheet.state.dispatch("selection-change", e.shiftKey ? prev => ({
                selection: Selection.simplify([...prev.selection, toGroup(selectionState)])
            }) : {
                selection: [toGroup(selectionState)]
            });
        // setSelection(e.shiftKey ? prev => Selection.simplify([...prev, toGroup(selectionState)]) : [toGroup(selectionState)]);

        setSelectionState(null);
    }

    // @ts-ignore
    useEvent(document.body, 'keydown', (e: KeyboardEvent) => {
        if (!table.current?.isActiveElement() && !table.current?.matches(":focus, :focus-within"))
            return;

        const key = ({
            Enter() {
                e.preventDefault();
                props.sheet.select(0, e.shiftKey ? -1 : 1);
            },
            Tab() {
                e.preventDefault();
                props.sheet.select(e.shiftKey ? -1 : 1, 0);
            },
            ArrowUp() {
                if (active) return;

                e.preventDefault();
                props.sheet.select(0, -1, e.shiftKey);
            },
            ArrowLeft() {
                if (active) return;

                e.preventDefault();
                props.sheet.select(-1, 0, e.shiftKey);
            },
            ArrowDown() {
                if (active) return;

                e.preventDefault();
                props.sheet.select(0, 1, e.shiftKey);
            },
            ArrowRight() {
                if (active) return;

                e.preventDefault();
                props.sheet.select(1, 0, e.shiftKey);
            },
            Delete() {
                e.preventDefault();

                for (const cell of Selection.iterCells(selection))
                    props.sheet.doc.getValueAt(cell)?.setRaw("");
            },
            Escape() {
                props.sheet.state.dispatch("selection-change", {
                    activeCell: null
                });
            }
        } as Record<string, () => void>)[e.key];

        if (key) key();
        else if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt")
            props.sheet.state.dispatch("selection-change", prev => ({
                activeCell: prev.activeCell ?? Selection.topLeft(prev.selection),
                selection: [prev.activeCell ?? Selection.topLeft(prev.selection)].filter(i => !!i)
            }))
        else
            e.preventDefault()
    });

    React.useEffect(() => {
        if (!table.current?.matches(":focus, :focus-within"))
            table.current?.focus()
    });

    return <section
        className={"table-widget"}
        ref={table}
        tabIndex={-1}>

        <Toolbar settings={props.settings} sheet={sheet}/>

        <div className={"spreadsheet"}
             onMouseUp={e => endSelection(e)}>
            <Table
                sheet={sheet}
                renderColumn={col => <div className={"column-title"}
                                          onDoubleClick={e => renameColumn(sheet, col)}
                                          onMouseDown={e => {
                                              if (e.button == 0)
                                                  setSelectionState({
                                                      startCell: {col: col.index},
                                                      currentCell: {col: col.index}
                                                  });
                                          }}
                                          onMouseEnter={e => setSelectionState(prev => prev ? ({
                                              ...prev,
                                              currentCell: {col: col.index}
                                          }) : null)}
                                          onContextMenu={e => columnContextMenu(e, col, sheet)}>{col.title}</div>}
                renderRow={row => <div className={"row-title"}
                                       onContextMenu={e => rowContextMenu(e, row, sheet)}>{row}</div>}>
                {mkTableCell(sheet, (cell, addr) => <div className={"table-cell-inner"}
                                                         onMouseDown={e => {
                                                             if (e.button == 0)
                                                                 setSelectionState({
                                                                     startCell: addr,
                                                                     currentCell: addr
                                                                 });
                                                         }}
                                                         onMouseEnter={e => setSelectionState(prev => prev ? ({
                                                             ...prev,
                                                             currentCell: addr
                                                         }) : null)}>
                    <EditableTableCell cell={cell} sheet={props.sheet} addr={addr}
                                       edit={active ? Selection.eqCell(addr, active) : false}/>
                </div>, selectionState ? [...selection, toGroup(selectionState)] : selection)}
            </Table>
        </div>
    </section>;
}

export function EditableTableCell(props: { cell: Value, edit?: boolean, sheet: StateHolder, addr: Selection.Cell }) {
    const [content, setContent] = React.useState(props.cell.getRaw());

    props.cell.onChange(content => setContent(content));

    const ref = React.createRef<HTMLInputElement>();

    React.useEffect(() => {
        if (props.edit) {
            ref.current?.focus();
            ref.current?.select();

            props.sheet.state.dispatch("selection-change", {
                activeCell: props.addr
            });
        }
    }, [props.edit]);

    React.useEffect(() => props.cell.setRaw(content), [content]);

    return <div className={"table-cell-inner"}
                onDoubleClick={_ => props.sheet.state.dispatch("selection-change", {
                    selection: [props.addr],
                    activeCell: props.addr
                })}>{props.edit ? <>
        <input ref={ref}
               type={"text"}
               value={content}
               onChange={e => setContent(e.target.value)}
               onBlur={() => props.sheet.state.dispatch("selection-change", {
                   activeCell: null
               })}/>
    </> : <>
        <span>
            {computedValue(props.cell)}
        </span>
    </>}</div>
}

export function toGroup({startCell, currentCell}: {
    startCell: Selection.Cell | Selection.Vector,
    currentCell: Selection.Cell | Selection.Vector
}): Selection.CellGroup {
    if (Selection.isColumnVector(startCell))
        return Selection.normaliseVectorRange({
            from: startCell,
            to: {col: 'col' in currentCell ? currentCell.col : 0}
        })
    else if (Selection.isRowVector(startCell))
        return Selection.normaliseVectorRange({
            from: startCell,
            to: {row: 'row' in currentCell ? currentCell.row : 0}
        })

    else return Selection.normaliseRange({
            from: startCell,
            to: Selection.isCell(currentCell) ? currentCell : ( // Assume the user released the mouse on a column or row header.
                Selection.isColumnVector(currentCell) ?
                    {col: currentCell.col, row: 0} :
                    {col: 0, row: currentCell.row}
            )
        });
}