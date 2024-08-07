import {ItemView, Menu, Notice, TextFileView, WorkspaceLeaf} from "obsidian";
import * as React from "react";
import * as rdom from "react-dom/client";
import DataSource from "./data.js";
import Table from "./table.js";

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

export default class Spreadsheet extends TextFileView {
    front: FrontMatter = {};
    separator: string = ";";

    dataSource: DataSource<any> = new DataSource();

    getViewData(): string {
        return this.dataSource.serialise();
    }

    setViewData(data: string, clear: boolean): void {
        if (clear)
            this.clear();

        this.dataSource.fromString(data);
    }

    clear(): void {
        this.dataSource.clear();
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

    onPaneMenu(menu: Menu, source: string) {
        menu.addItem(item => item
            .setIcon("settings")
            .setTitle("Spreadsheet Preferences"));
    }

    protected async onOpen(): Promise<void> {
        const spreadsheet = rdom.createRoot(this.contentEl);

        spreadsheet.render(<Table data={this.dataSource}/>);
    }
}