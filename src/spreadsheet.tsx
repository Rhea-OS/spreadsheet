import * as obs from "obsidian";
import * as React from "react";
import * as rdom from "react-dom/client";

import Table, {DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT} from "./table.js";
import FormulaBar, {CellRenderer, renderers} from "./formula.js";

export const SPREADSHEET_VIEW = "spreadsheet-view";

export interface FrontMatter extends Record<string, any> {
    columnTypes?: string[],
    explicitTypes?: { [cell in string]: string },
    constrainToDefinedColumns?: boolean,

    columnWidths?: number[],
    rowHeights?: number[],

    columnTitles?: string[],
    allowedTypes?: string[],
    columnSeparator?: string,
    urlEscaped?: boolean
}

export interface Value {
    setRaw(raw: string): void,

    getRaw(): string,

    onChange: (callback: (raw: string) => void) => () => void,

    renderer(): CellRenderer
}

export type ResizeState = {
    isResizing: false,
} | {
    isResizing: true,
    prevMouse: { x: number, y: number },
    prevSize: { width: number, height: number },
    onResize: (size: { width: number, height: number }) => void
};


export function value(raw: string, sheet: Spreadsheet): Value {
    const watches: ((raw: string) => void)[] = [];
    let type: keyof typeof renderers = 'raw';

    let lastUpdate: Date = new Date();

    const value: Value = {
        setRaw: data => {
            raw = data;
            for (const watch of watches)
                watch(raw);
        },
        getRaw: () => raw,
        onChange: callback => {
            watches.push(callback);
            return () => watches.includes(callback) ? void watches.splice(watches.indexOf(callback), 1) : void 0
        },

        renderer(): CellRenderer {
            if (lastUpdate < sheet.lastChanged) {
                const row = sheet.raw?.find(row => row.includes(value));
                const col = row?.findIndex(cell => cell == value);

                lastUpdate = new Date();

                if (typeof col == "number")
                    return renderers[type = sheet.columnType(col)];
            }

            return renderers[type];
        }
    };

    return value;
}

export interface DocumentProperties {
    frontMatter: FrontMatter;

    separator: string;
    uriEncoding: boolean;

    columnTitles: string[];

    columnTypes: string[];

    columnWidths: number[];
    rowHeights: number[];
}

export default class Spreadsheet extends obs.TextFileView {
    raw: Value[][] = [[]];

    private root: rdom.Root | null = null;
    #change: Date = new Date();

    get lastChanged(): Date {
        return this.#change;
    }

    #props: DocumentProperties = {
        frontMatter: {},

        columnTitles: [],

        columnTypes: [],

        columnWidths: [],
        rowHeights: [],

        separator: ";",
        uriEncoding: false
    };

    constructor(leaf: obs.WorkspaceLeaf) {
        super(leaf);

        const watchers: (() => void)[] = [];

        const onExternalChange = function (this: Spreadsheet, watcher: () => void): () => void {
            watchers.push(watcher);
            return () => watchers.remove(watcher);
        }.bind(this);

        const notifyChange = () => watchers.forEach(i => i());

        this.onExternalChange = onExternalChange;
        this.notifyChange = notifyChange;

        this.raw[0].push(value("", this));
    }

    public readonly onExternalChange: (watcher: () => void) => (() => void);
    private readonly notifyChange: (() => void);

    getViewData(): string {
        const rows = [];

        if (!this.documentProperties.frontMatter.columnTitles)
            rows.push(this.documentProperties.columnTitles.map(i => this.documentProperties.uriEncoding ? encodeURIComponent(i) : i));

        for (const row of this.raw)
            rows.push(row
                .map(i => i.getRaw())
                .map(value => this.documentProperties.uriEncoding ? encodeURIComponent(value) : value));

        return rows
            .map(i => i.join(this.documentProperties.separator))
            .join("\n");
    }

    public get documentProperties(): DocumentProperties {
        return this.#props;
    }

    public columnType(col: number): keyof typeof renderers {
        if (this.#props.columnTypes[col] in renderers)
            return this.#props.columnTypes[col] as any;

        return 'raw';
    }

    public updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>) {
        this.#props = Object.freeze({
            ...this.#props,
            ...update(this.#props)
        });

        this.#change = new Date();

        this.notifyChange();
    }

    setViewData(data: string, clear: boolean): void {
        if (clear)
            this.clear();

        const frontMatterMarker = data.indexOf("---\n");

        if (frontMatterMarker > -1) {
            const end = data.indexOf("---\n", frontMatterMarker + 3);
            this.parseFrontMatter(data.slice(frontMatterMarker + 3, end).trim());
            data = data.slice(end + 3).trim();
        }

        const separator = this.documentProperties.separator ?? /[,;\t]/g;
        const rows = data.trim().split(/\r?\n/);

        if (!this.documentProperties.frontMatter?.columnTitles)
            this.updateDocumentProperties(prev => ({
                columnTitles: rows.shift()?.split(separator).map(i => this.documentProperties.uriEncoding ? decodeURIComponent(i) : i) ?? []
            }));

        const prevRaw = [...this.raw];
        const prevProps = {...this.documentProperties};
        this.raw = [];

        for (const [cells, row] of rows.map((i, row) => [i.split(separator), row] as const)) {
            this.raw.push(new Array(this.documentProperties.columnTitles.length).fill("").map(cell => value(cell, this)));

            for (const [raw, col] of cells.map((i, col) => [i, col] as const)) {
                const prev = prevRaw[row]?.[col];

                if (prev) {
                    this.raw[row][col] = prev;
                    if (prev.getRaw() != raw)
                        prev.setRaw(raw);
                } else
                    this.raw[row][col] = value(raw, this);
            }
        }

        this.updateDocumentProperties(prev => ({
            ...prevProps,

            columnTypes: new Array(this.documentProperties.columnTitles.length).fill("raw"),
            columnWidths: new Array(this.documentProperties.columnTitles.length).fill(DEFAULT_COLUMN_WIDTH),
            rowHeights: new Array(this.raw.length).fill(DEFAULT_ROW_HEIGHT)
        }));
    }

    private parseFrontMatter(frontMatter: string): number {
        this.updateDocumentProperties(prev => ({
            frontMatter: obs.parseYaml(frontMatter)
        }));

        return frontMatter.length;
    }

    editFormat(col: number, format: string) {
        this.updateDocumentProperties(prev => ({
            columnTypes: prev.columnTypes.with(col, format)
        }));
    }

    insertCol(col: number) {
        // Warning: I see a potential for bugs here.
        for (const row of this.raw)
            row.splice(col + 1, 0, value("", this));

        this.#change = new Date();

        this.updateDocumentProperties(prev => ({
            columnTitles: [...prev.columnTitles.slice(0, col + 1), `Column ${col + 2}`, ...prev.columnTitles.slice(col + 1)],
            columnTypes: [...prev.columnTypes.slice(0, col + 1), 'raw', ...prev.columnTypes.slice(col + 1)],
            columnWidths: [...prev.columnWidths.slice(0, col + 1), DEFAULT_COLUMN_WIDTH, ...prev.columnWidths.slice(col + 1)],
        }));
    }

    insertRow(row: number) {
        // Warning: I see a potential for bugs here.
        this.raw.splice(row + 1, 0, new Array(this.#props.columnTypes.length).fill("").map(cell => value(cell, this)));
        this.#change = new Date();

        this.updateDocumentProperties(prev => ({
            rowHeights: [...prev.rowHeights.slice(0, row + 1), DEFAULT_ROW_HEIGHT, ...prev.rowHeights.slice(row + 1)],
        }));
    }

    removeCol(col: number) {
        for (const row of this.raw)
            row.splice(col, 1);

        this.#change = new Date();
        this.updateDocumentProperties(prev => ({
            columnWidths: [...prev.columnWidths.slice(0, col), ...prev.columnWidths.slice(col + 1)],
            columnTitles: [...prev.columnTitles.slice(0, col), ...prev.columnTitles.slice(col + 1)],
            columnTypes: [...prev.columnTypes.slice(0, col), ...prev.columnTypes.slice(col + 1)]
        }));
    }

    removeRow(row: number) {
        this.raw.splice(row, 1);
        this.#change = new Date();
        this.updateDocumentProperties(prev => ({
            rowHeights: [...prev.rowHeights.slice(0, row), ...prev.rowHeights.slice(row + 1)]
        }));
    }

    clear(): void {
        this.raw = [[]];
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
            .render(<Ui sheet={this}/>);
    }

    protected async onClose(): Promise<void> {
        this.root?.unmount();
    }
}

export function Ui(props: { sheet: Spreadsheet }) {
    const [active, setActive] = React.useState(props.sheet.raw[0][0]);
    const [resize, setResize] = React.useState<ResizeState>({
        isResizing: false,
    });
    const [isRenamingColumn, setIsRenamingColumn] = React.useState<null | number>(null);

    const documentProperties = React.useSyncExternalStore(props.sheet.onExternalChange, () => props.sheet.documentProperties);

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
        onMouseUp={() => setResize({isResizing: false})}>

        {/*<SelectionBar/>*/}

        <FormulaBar activeCell={active}/>

        <Table raw={props.sheet.raw}
               columnWidths={documentProperties.columnWidths}
               rowHeights={documentProperties.rowHeights}
               mouseUp={(row, col) => setActive(props.sheet.raw[row][col])}
               mouseDown={(row, col) => setActive(props.sheet.raw[row][col])}>

            <>
                {documentProperties.columnTitles.map((column, col) =>
                    <div className={"table-header-cell"}
                         key={`table-header-${col}`}
                         style={{
                             gridColumn: col + 2,
                             gridRow: 1
                         }}
                         onContextMenu={e => columnContextMenu(e, col, props.sheet, setIsRenamingColumn)}
                        onDoubleClick={e => setIsRenamingColumn(col)}>
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
                                }))}/> : column}
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

        for (const [key, ren] of Object.entries(renderers))
            submenu.addItem(item => item
                .setIcon(ren.friendlyName.icon ?? null)
                .setTitle(ren.friendlyName.label)
                .onClick(_ => sheet.editFormat(col, key)));
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