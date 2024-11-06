import * as obs from "obsidian";

import {ColumnHeader} from "./components/table.js";
import {StateHolder} from "./main.js";

export default class RenameColumnModal extends obs.Modal {
    constructor(sheet: StateHolder, col: ColumnHeader) {
        super(sheet.app);

        const frag = new DocumentFragment();

        const container = frag.createDiv({cls: ["input-modal"]});
        container.createEl("input", {cls: ["input", "setting", "fill"], attr: {type: "text"}}, input => {
            input.value = sheet.documentProperties.columnTitles[col.index];

            input.focus();
            input.select();

            input
                .addEventListener("change", e => sheet.updateDocumentProperties(prev => ({
                    columnTitles: prev.columnTitles.with(col.index, (e.target as HTMLInputElement).value)
                })));

            input.addEventListener("keydown", e => {
                if (e.key != 'Enter')
                    return;

                e.preventDefault();
                this.close();
            })
        });

        container.createDiv({cls: ["buttons"]})
            .createEl("button", {
                cls: ["button"],
                text: "Rename"
            }, btn => btn.addEventListener("click", () => this.close()));

        this.setContent(frag)
            .setTitle("Rename Column");
    }
}

export function renameColumn(sheet: StateHolder, col: ColumnHeader) {
    return (new RenameColumnModal(sheet, col)).open();
}