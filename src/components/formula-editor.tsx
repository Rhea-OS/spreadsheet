import React from 'react';
import * as obs from 'obsidian';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import {autocompletion, closeBrackets} from "@codemirror/autocomplete";
import {defineLanguageFacet, Language} from '@codemirror/language';

import {Value} from "../csv.js";
import {StateHolder} from "../main.js";
import {Selection} from "../selection.js";
import {computedValue} from "../inline.js";

import * as grammar from '../../grammar/expr.grammar';

console.log(grammar);

const toIter = function* (walker: TreeWalker): Generator<Node> {
    for (let node = walker.nextNode(); node; node = walker.nextNode())
        yield node;
}

export function EditableTableCell(props: { cell: Value, edit?: boolean, sheet: StateHolder, addr: Selection.Cell }) {
    return <div className={"table-cell-inner"}
                onDoubleClick={_ => props.sheet.state.dispatch("selection-change", {
                    selection: [props.addr],
                    activeCell: props.addr
                })}>{props.edit ? <>
        <FormulaEditor cell={props.cell}/>
    </> : <>
        <span>
            {computedValue(props.cell, {addr: props.addr})}
        </span>
    </>}</div>
}

export const highlighter = new Language(defineLanguageFacet(), );

export function FormulaEditor(props: { cell: Value }) {
    const editor = React.createRef<HTMLDivElement>();

    React.useEffect(() => {
        if (!editor.current)
            return;

        const ed = new EditorView({
            parent: editor.current,
            state: EditorState.create({
                doc: props.cell.getRaw(),
                extensions: [
                    closeBrackets(),
                    highlighter.extension
                ],
            })
        })

        return () => {
            props.cell.setRaw(ed.state.doc.toString());
            ed.destroy();
        };
    }, []);

    return <div
        ref={editor}
        className={"formula-editor"} />;
}

// function updateEditor(editor: HTMLDivElement): string {
//     const spans = [];
//
//     const cursor = {
//         bcount: 0,
//         mark: 0
//     };
//
//     for (let i = 0; i < formula.length; i++)
//         if (formula[i] == '{' && ++cursor.bcount == 1)
//             parent.createEl("span", {
//                 text: formula.slice(parent.innerText.length, cursor.mark = i),
//             });
//
//         else if (formula[i] == '}' && --cursor.bcount == 0)
//             parent.createEl("span", {
//                 text: formula.slice(parent.innerText.length, cursor.mark = i + 1),
//                 cls: ['formula-address']
//             });
//
//     editor.replaceChildren(parent);
//
//     setCaret(selection, editor);
//
//     return formula;
// }