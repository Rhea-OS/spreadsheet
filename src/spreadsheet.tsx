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


export function value(raw: string, row: number, col: number, sheet: Spreadsheet): Value {
    const watches: ((raw: string) => void)[] = [];

    return {
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
            return renderers[sheet.columnType(col) as keyof typeof renderers];
        }
    }
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

        this.raw[0].push(value("", 0, 0, this));
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

    public columnType(col: number): string {
        if (this.#props.columnTypes[col] in renderers)
            return this.#props.columnTypes[col];

        return 'raw';
    }

    public updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>) {
        this.#props = Object.freeze({
            ...this.#props,
            ...update(this.#props)
        });

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
        this.raw = [];

        for (const [cells, row] of rows.map((i, row) => [i.split(separator), row] as const)) {
            this.raw.push(new Array(this.documentProperties.columnTitles.length).fill("").map((i, col) => value(i, row, col, this)));

            for (const [raw, col] of cells.map((i, col) => [i, col] as const)) {
                const prev = prevRaw[row]?.[col];

                if (prev) {
                    this.raw[row][col] = prev;
                    if (prev.getRaw() != raw)
                        prev.setRaw(raw);
                } else
                    this.raw[row][col] = value(raw, row, col, this);
            }
        }

        this.updateDocumentProperties(prev => ({
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
        rdom.createRoot(this.contentEl)
            .render(<Ui sheet={this}/>);
    }
}

export function Ui(props: { sheet: Spreadsheet }) {
    const [active, setActive] = React.useState(props.sheet.raw[0][0]);
    const [resize, setResize] = React.useState<ResizeState>({
        isResizing: false,
    });

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
                         onContextMenu={e => columnContextMenu(e, col, props.sheet)}>
                        <div className={"column-title"}>
                            {column} {props.sheet.columnType(col) != 'raw' ?
                            <div className={"nav-file-tag"}>{props.sheet.columnType(col)}</div> : null}
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

export function columnContextMenu(e: React.MouseEvent, col: number, sheet: Spreadsheet) {
    const menu = new obs.Menu();

    menu.addItem(item => {
        const submenu: obs.Menu = item
            .setIcon("languages")
            .setTitle("Set column format")
            .setSubmenu();

        for (const [key, ren] of Object.entries(renderers))
            submenu.addItem(item => item
                .setIcon(ren.friendlyName.icon ?? null)
                .setTitle(ren.friendlyName.label)
                .onClick(_ => sheet.editFormat(col, key)));
    });
    menu.addSeparator();
    menu.addItem(item => item
        .setIcon("trash-2")
        .setTitle("Delete Column")
        .onClick(e => {
        }));

    menu.showAtMouseEvent(e.nativeEvent);
}

export function rowContextMenu(e: React.MouseEvent, row: number, sheet: Spreadsheet) {
    const menu = new obs.Menu();

    menu.addSeparator();
    menu.addItem(item => item
        .setIcon("trash-2")
        .setTitle("Delete Row")
        .onClick(e => {
        }));

    menu.showAtMouseEvent(e.nativeEvent);
}