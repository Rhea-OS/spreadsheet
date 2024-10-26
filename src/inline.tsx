import * as dom from "react-dom/client";

import CSVDocument from "./csv.js";
import React from "react";
import {ResizeState, StateHolder, Ui} from "./spreadsheet.js";
import SpreadsheetPlugin from "./main.js";
import {MarkdownPostProcessorContext} from "obsidian";
import StateManager from "@j-cake/jcake-utils/state";
import {EditorState} from "./viewport.js";
import {Settings} from "./settings/settingsTab.js";
import Table from "./components/table.js";

export default async function inline(this: SpreadsheetPlugin, source: string, container: HTMLElement, cx: MarkdownPostProcessorContext) {
    let doc = new CSVDocument();

    doc.setRaw(source, true);

    const root = dom.createRoot(container);

    const sheet: StateHolder = new Proxy({
        doc,
        app: this.app,

        state: new StateManager<EditorState>({
            selection: [],
            activeCell: null
        }),
    } as StateHolder, {
        get(target: StateHolder, p: keyof StateHolder) {
            if (p in target)
                return target[p];

            if (typeof (target.doc as any)[p] == 'function')
                return (target.doc as any)[p].bind(target.doc);
            else
                return (target.doc as any)[p];
        }
    }) as any as StateHolder;

    root.render(<Ui settings={this.settings} sheet={sheet} toolbar={false}/>);
}
