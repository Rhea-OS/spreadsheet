import * as dom from "react-dom/client";

import CSVDocument, {Value} from "./csv.js";
import React from "react";
import {StateHolder} from "./spreadsheet.js";
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

    root.render(<ReadonlyUi settings={this.settings} sheet={sheet}/>);
}

export function ReadonlyUi(props: {
    settings: Settings,
    sheet: StateHolder
}) {

    return <Table
        sheet={props.sheet}
        columns={Object.fromEntries(props.sheet.documentProperties.columnTitles.map((col, colIndex) => [col, {
            title: col,
            width: props.sheet.documentProperties.columnWidths[colIndex],
            render: col => <span className={"column-title"}>{col.title}</span>
        }]))}>
        {{
            data: props.sheet.doc.raw.map((row, rowIndex) => ({
                id: rowIndex,
                data: Object.fromEntries(row.map((col, colIndex) => [
                    props.sheet.documentProperties.columnTitles[colIndex],
                    () => <div className={"table-cell-inner"}>
                        <span>
                            {computedValue(col)}
                        </span>
                    </div>
                ]))
            }))
        }}
    </Table>
}

export function computedValue(col: Value): React.ReactNode {
    const value = col.getComputedValue();

    if (typeof value == 'string')
        if (col.isComputedValue())
            return <b>
                {value}
            </b>;
        else
            return <>
                {value}
            </>;
    else
        return <i>
            {value.err}
        </i>
}