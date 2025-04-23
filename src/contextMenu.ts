import React from "react";
import * as obs from "obsidian";

import {ColumnHeader} from "./components/table.js";
import {renameColumn} from "./renameColumn.js";
import {StateHolder} from "./main.js";

export function columnContextMenu(e: React.MouseEvent, col: ColumnHeader, sheet: StateHolder) {
    e.preventDefault();

    const menu = new obs.Menu();

    menu.addItem(item => item
        .setIcon("pencil")
        .setTitle("Rename Column")
        .onClick(_ => renameColumn(sheet, col)));

    menu.addItem(item => {
        const submenu = (item
            .setIcon("languages")
            .setTitle("Set column format") as any as { setSubmenu: () => obs.Menu })
            .setSubmenu();

        // for (const [key, ren] of Object.entries(renderers))
        //     submenu.addItem(item => item
        //         .setIcon(ren.friendlyName.icon ?? null)
        //         .setTitle(ren.friendlyName.label)
        //         .onClick(_ => sheet.editFormat(col, key)));
    });

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("arrow-left-to-line")
        .setTitle("Swap column leftwards"));
    menu.addItem(item => item
        .setIcon("arrow-right-to-line")
        .setTitle("Swap column rightwards"));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert column before")
        .onClick(_ => sheet.insertCol(col.index - 1)));
    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert column after")
        .onClick(_ => sheet.insertCol(col.index)));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("trash-2")
        .setTitle("Delete Column")
        .onClick(e => sheet.removeCol(col.index)));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("arrow-up-narrow-wide")
        .setTitle(`Sort by ${sheet.documentProperties.columnTitles[col.index]}`)
        .onClick(e => void 0));

    menu.addItem(item => item
        .setIcon("arrow-down-wide-narrow")
        .setTitle(`Sort by ${sheet.documentProperties.columnTitles[col.index]} (Descending)`)
        .onClick(e => void 0));

    menu.addItem(item => {
        const filter = (item
            .setIcon("filter")
            .setTitle(`Filter on ${sheet.documentProperties.columnTitles[col.index]}`)
            .onClick(e => alert("hi"))  as any as { setSubmenu: () => obs.Menu })
            .setSubmenu()
            .addItem(item => item
                .setTitle("By Value"))
            .addItem(item => item
                .setTitle("Unique"))
            .addItem(item => item
                .setTitle("Empty"))
            .addItem(item => item
                .setTitle("Not Empty"))

    });

    menu.addItem(item => item
        .setIcon("group")
        .setTitle(`Group by ${sheet.documentProperties.columnTitles[col.index]}`)
        .onClick(e => void 0));

    menu.showAtMouseEvent(e.nativeEvent);
}

export function rowContextMenu(e: React.MouseEvent, row: number, sheet: StateHolder) {
    sheet.state.dispatch('change-active', {activeCell: null});

    const menu = new obs.Menu();

    menu.addItem(item => item
        .setIcon("arrow-up-to-line")
        .setTitle("Swap row upwards"));
    menu.addItem(item => item
        .setIcon("arrow-down-to-line")
        .setTitle("Swap row downwards"));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert row above")
        .onClick(_ => sheet.insertRow(row - 1)));
    menu.addItem(item => item
        .setIcon("list-plus")
        .setTitle("Insert row below")
        .onClick(_ => sheet.insertRow(row)));

    menu.addSeparator();

    menu.addItem(item => item
        .setIcon("trash-2")
        .setTitle("Delete Row")
        .onClick(e => sheet.removeRow(row)));

    menu.showAtMouseEvent(e.nativeEvent);
}