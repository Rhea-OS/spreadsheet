import * as path from 'node:path';
import * as obs from 'obsidian';

import Spreadsheet, {SPREADSHEET_VIEW} from "./spreadsheet.js";
import SettingsTab from "./settingsTab.js";

export default class SpreadsheetPlugin extends obs.Plugin {
    settings: SettingsTab | null = null;

    async onload() {
        this.registerView(SPREADSHEET_VIEW, leaf => new Spreadsheet(leaf));
        this.registerExtensions(["csv", "tab"], SPREADSHEET_VIEW);

        this.addSettingTab(this.settings = new SettingsTab(this.app, this));

        this.addCommand({
            id: "open-new-spreadsheet",
            name: "New Spreadsheet",
            callback: async () => {
                // this.app.vault.create(obs.normalizePath(i));
                // this.app.vault.getRoot
                // return await this.app.workspace.getLeaf(true).setViewState({ type: SPREADSHEET_VIEW, active: true });
            }
        });

        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => menu
            .addItem(item => item
                .setTitle("New Spreadsheet")
                .setIcon("sheet")
                .onClick(async _ => {
                    // TODO: Handle existing files
                    const newFile = path.join(obs.normalizePath(file.path ?? this.app.vault.getRoot()), 'sheet.csv');
                    
                    const tfile = await this.app.vault.create(newFile, ';\n;');
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

    async loadSettings() {
        this.settings?.load(await this.loadData());
		// this.settings = Object.assign({}, default_settings, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings?.get());
	}
}