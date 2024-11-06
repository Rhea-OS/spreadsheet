import React from 'react';
import * as rdom from "react-dom/client";
import * as obs from "obsidian";
import StateManager from '@j-cake/jcake-utils/state';

import SpreadsheetPlugin, {StateHolder} from "./main.js";
import CSVDocument, {DocumentProperties, value, Value} from "./csv.js";
import {Settings} from "./settings/settingsTab.js";
import Toolbar from "./components/toolbar.js";
import Table, {mkTableCell} from "./components/table.js";
import {computedValue} from "./inline.js";
import {Selection} from "./selection.js";
import {columnContextMenu} from "./contextMenu.js";
import {renameColumn} from "./renameColumn.js";

export const SPREADSHEET_VIEW = "spreadsheet-view";

export interface EditorState {
    selection: Selection.CellGroup[],
    activeCell: Selection.Cell | null,

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
    }

    moveActive(relCol: number, relRow: number) {
        const state = this.state.get();

        const active = {
            row: Math.max(0, (state.activeCell?.row ?? 0) + relRow),
            col: Math.max(0, (state.activeCell?.col ?? 0) + relCol)
        };

        if (active.row >= 0 && !Array.isArray(this.doc.raw[active.row]))
            this.doc.insertRow(active.row);

        this.state.dispatch('change-active', _ => ({activeCell: active}));
        this.state.dispatch("sync-selection", _ => ({selection: [active]}))
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

    insertCol(col: number) {
        this.doc.insertCol(col);
    }

    insertRow(row: number) {
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

    const [selectionState, setSelectionState] = React.useState<{
        startCell: Selection.Cell | Selection.Vector,
        currentCell: Selection.Cell | Selection.Vector,
    } | null>(null);

    props.sheet.state.on("selection-change", state => setSelection(state.selection));

    function endSelection(e: React.MouseEvent) {
        if (selectionState)
            setSelection(e.shiftKey ? prev => [...prev, toGroup(selectionState)] : [toGroup(selectionState)]);

        setSelectionState(null);
    }

    return <section
        className={"table-widget"}>

        <Toolbar settings={props.settings} sheet={sheet}/>

        <div className={"spreadsheet"}
             onMouseUp={e => endSelection(e)}>
            <Table
                sheet={sheet}
                renderColumn={col => <div className={"column-title"}
                                          onDoubleClick={e => renameColumn(sheet, col)}
                                          onContextMenu={e => columnContextMenu(e, col, sheet)}>{col.title}</div>}>
                {mkTableCell(sheet, (cell, addr) => <div className={"table-cell-inner"}
                                                         onMouseDown={e => setSelectionState({
                                                             startCell: addr,
                                                             currentCell: addr
                                                         })}
                                                         onMouseEnter={e => setSelectionState(prev => prev ? ({
                                                             ...prev,
                                                             currentCell: addr
                                                         }) : null)}>
                    <EditableTableCell cell={cell}/>
                </div>, selectionState ? [...selection, toGroup(selectionState)] : selection)}
            </Table>
        </div>
    </section>;
}

export function EditableTableCell(props: { cell: Value, edit?: boolean }) {
    const [content, setContent] = React.useState(props.cell.getRaw());
    const [edit, setEdit] = React.useState(props.edit ?? false);

    const ref = React.createRef<HTMLInputElement>();

    React.useEffect(() => {
        if (edit) {
            ref.current?.focus();
            ref.current?.select();
        }
    }, [edit]);

    React.useEffect(() => props.cell.setRaw(content), [content]);

    return <div className={"table-cell-inner"}
                onDoubleClick={_ => setEdit(true)}>{edit ? <>
        <input ref={ref}
               type={"text"}
               value={content}
               onChange={e => setContent(e.target.value)}
               onBlur={() => setEdit(false)}/>
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