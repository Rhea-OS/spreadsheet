import * as path from 'node:path';
import * as obs from 'obsidian';

import Spreadsheet, {SPREADSHEET_VIEW} from "./viewport.js";
import SettingsTab, { default_settings, Settings } from "./settings/settingsTab.js";

export default class SpreadsheetPlugin extends obs.Plugin {
    settingsTab: SettingsTab | null = null;
    settings: Settings = default_settings;

    async onload() {
        this.registerView(SPREADSHEET_VIEW, leaf => new Spreadsheet(leaf, this));
        this.registerExtensions(["csv", "tab"], SPREADSHEET_VIEW);

        this.addSettingTab(this.settingsTab = new SettingsTab(this.app, this));

        this.settings = await this.loadData()
            .then(res => Object.assign({}, default_settings, res));

        this.registerMarkdownCodeBlockProcessor("csv", async function (source, container, cx) {

        });

        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => menu
            .addItem(item => item
                .setTitle("New Spreadsheet")
                .setIcon("sheet")
                .onClick(async _ => {
                    // TODO: Handle existing files
                    const newFile = path.join(obs.normalizePath(file.path ?? this.app.vault.getRoot()), 'sheet.csv');
                    
                    const tfile = await this.app.vault.create(newFile, 'Column 1;Column 2\n;');
                    await this.app.workspace.getLeaf(false).openFile(tfile);
                }))));
    }

    private runCommand(command: string) {
        (this.app as any as {
            commands: {
                executeCommandById: (command: string) => void
            }
        }).commands.executeCommandById(command);
    }
}