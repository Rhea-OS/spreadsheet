import * as obs from 'obsidian';

import SpreadsheetView, {EditorState, SPREADSHEET_VIEW} from "./spreadsheet.js";
import SettingsTab, { default_settings, Settings } from "./settings/settingsTab.js";
import inline from "./inline.js";
import CSVDocument, {DocumentProperties} from "./csv.js";
import StateManager from "@j-cake/jcake-utils/state";

export default class SpreadsheetPlugin extends obs.Plugin {
    settingsTab: SettingsTab | null = null;
    settings: Settings = default_settings;

    async onload() {
        this.registerView(SPREADSHEET_VIEW, leaf => new SpreadsheetView(leaf, this));
        this.registerExtensions(["csv", "tab"], SPREADSHEET_VIEW);

        this.addSettingTab(this.settingsTab = new SettingsTab(this.app, this));

        this.settings = await this.loadData()
            .then(res => Object.assign({}, default_settings, res));

        this.registerMarkdownCodeBlockProcessor("csv", inline.bind(this));

        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => menu
            .addItem(item => item
                .setTitle("New Spreadsheet")
                .setIcon("sheet")
                .onClick(async _ => {
                    // TODO: Handle existing files
                    const newFile = `${obs.normalizePath(file.path ?? this.app.vault.getRoot())}/sheet.csv`;

                    const tfile = await this.app.vault.create(newFile, 'Column 1;Column 2\n;');
                    await this.app.workspace.getLeaf(false).openFile(tfile);
                }))));

        this.addCommand({
            checkCallback: (checking: boolean) => {
                if (!checking)
                    this.app.workspace.getActiveViewOfType(SpreadsheetView)?.doc.undo();

                else
                    return !!this.app.workspace.getActiveViewOfType(SpreadsheetView)
            },
            hotkeys: [{
                key: "z",
                modifiers: ['Ctrl']
            }],
            icon: "undo",
            id: "undo",
            name: "Undo",
            repeatable: true
        });
        this.addCommand({
            checkCallback: (checking: boolean) => {
                if (!checking)
                    this.app.workspace.getActiveViewOfType(SpreadsheetView)?.doc.redo();

                else
                    return !!this.app.workspace.getActiveViewOfType(SpreadsheetView);
            },
            hotkeys: [{
                key: "y",
                modifiers: ['Ctrl']
            }],
            icon: "redo",
            id: "redo",
            name: "Redo",
            repeatable: true
        });
        this.addCommand({
            checkCallback: (checking: boolean) => {
                if (!checking)
                    this.app.workspace.getActiveViewOfType(SpreadsheetView)?.cut();

                else
                    return !!this.app.workspace.getActiveViewOfType(SpreadsheetView);
            },
            hotkeys: [{
                key: "x",
                modifiers: ['Ctrl']
            }],
            icon: "cut",
            id: "cut",
            name: "Cut",
            repeatable: true
        });
        this.addCommand({
            checkCallback: (checking: boolean) => {
                if (!checking)
                    this.app.workspace.getActiveViewOfType(SpreadsheetView)?.copy();

                else
                    return !!this.app.workspace.getActiveViewOfType(SpreadsheetView);
            },
            hotkeys: [{
                key: "c",
                modifiers: ['Ctrl']
            }],
            icon: "copy",
            id: "copy",
            name: "Copy",
            repeatable: true
        });
        this.addCommand({
            checkCallback: (checking: boolean) => {
                if (!checking)
                    this.app.workspace.getActiveViewOfType(SpreadsheetView)?.paste();

                else
                    return !!this.app.workspace.getActiveViewOfType(SpreadsheetView);
            },
            hotkeys: [{
                key: "v",
                modifiers: ['Ctrl']
            }],
            icon: "paste",
            id: "paste",
            name: "Paste",
            repeatable: true
        });
    }

    private runCommand(command: string) {
        (this.app as any as {
            commands: {
                executeCommandById: (command: string) => void
            }
        }).commands.executeCommandById(command);
    }
}

export interface StateHolder {
    doc: CSVDocument,
    state: StateManager<EditorState>,
    app: obs.App,

    undo(): void;
    redo(): void;
    cut(): void;
    copy(): void;
    paste(): void;

    getSelectionAsHTMLTable(): HTMLTableElement;

    select(relCol: number, relRow: number, expand?: boolean): void,

    columnType(col: number): string,
    insertCol(col: number): void,
    insertRow(col: number): void,
    removeCol(row: number): void,
    removeRow(row: number): void,

    documentProperties: DocumentProperties,

    updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>): void,
    onExternalChange(watcher: () => void): () => void
}