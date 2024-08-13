import * as React from 'react';
import * as rdom from 'react-dom/client';
import * as obs from 'obsidian';

import units, {Unit} from "./units.js";
import SpreadsheetPlugin from "./main.js";

export interface Settings {
    units: Unit[]
}
export const default_settings: Settings = {
    units
};

export default class SettingsTab extends obs.SettingTab {
    private root: rdom.Root | null = null;
    settings: Settings = default_settings;

    constructor(readonly app: obs.App, private plugin: SpreadsheetPlugin) {
        super();
    }

    load(settings: Partial<Settings>) {

    }

    get(): Settings {
        return Object.freeze({ ...this.settings });
    }

    display() {
        (this.root = rdom.createRoot(this.containerEl))
            .render(<div>

            </div>);
    }

    hide() {
        if (this.root)
            this.root.unmount();
    }
}