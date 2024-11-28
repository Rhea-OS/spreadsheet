import * as React from 'react';
import * as rdom from 'react-dom/client';
import * as obs from 'obsidian';

import units, {Unit} from "../../unitConverter/units.js";
import SpreadsheetPlugin from "../main.js";
import Tools from '../actions.js';
import ToolbarSettings from "./toolbar.js";
import DatatypeSettings from "./datatype.js";

export interface Settings {
    toolbar: (keyof typeof Tools | null)[],
    units: Unit[],
    dataTypes: ({ name: string } & Datatype)[]
}

export const default_settings: Settings = {
    toolbar: ['undo', 'redo', null, 'cut', 'copy', 'paste', null, 'viewOptions'],
    units,
    dataTypes: [{
        name: 'Date',
        // This pattern will incorrectly pass things like the 14th month.
        format: '(\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d:[0-5]\\d\\.\\d+)|(\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d:[0-5]\\d)|(\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d)'
    }, {
        name: "IPv4 Address",
        format: ''
    }]
};

export type Datatype = Text | Numeric | List;
export type Text = {
    format: string
};
export type List = {
    options: string[],
    multiple: boolean
};
export type Numeric = {
    unit: Unit,
    format: string,
    metric: boolean
}

export default class SettingsTab extends obs.PluginSettingTab {
    private root: rdom.Root | null = null;

    constructor(readonly app: obs.App, readonly plugin: SpreadsheetPlugin) {
        super(app, plugin);
    }

    display() {
        (this.root = rdom.createRoot(this.containerEl))
            .render(<SpreadsheetSettings tab={this}/>);
    }

    hide() {
        this.root?.unmount();
    }
}

export function SpreadsheetSettings(props: { tab: SettingsTab }) {
    return <div className="spreadsheet-settings">
        <ToolbarSettings plugin={props.tab.plugin} />
        <DatatypeSettings plugin={props.tab.plugin} />
    </div>
}