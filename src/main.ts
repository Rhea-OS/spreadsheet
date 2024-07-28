import { App, Modal, Plugin, PluginSettingTab } from 'obsidian';

export interface Settings {

}
export const default_settings: Settings = {

};

export default class ContentType extends Plugin {
    settings: Settings = default_settings;

    async onload() {

    }

    async loadSettings() {
		this.settings = Object.assign({}, default_settings, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class SettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: ContentType) {
        super(app, plugin);
    }

    display() {
		this.containerEl.empty();

    }
}