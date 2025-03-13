import React from 'react';
import { EditorView } from '@codemirror/view';
import {EditorSelection, EditorState} from '@codemirror/state';
import * as state from '@codemirror/state';
import {closeBrackets} from "@codemirror/autocomplete";
import {HighlightStyle, LRLanguage, syntaxHighlighting} from '@codemirror/language';
import {foldNodeProp, foldInside, indentNodeProp} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

import {Value} from "../csv.js";
import {StateHolder} from "../main.js";
import {Selection} from "../selection.js";
import {computedValue} from "../inline.js";

import {parser} from '../../grammar/expr.grammar';

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
        <FormulaEditor cell={props.cell} blur={() => props.sheet.state.dispatch("selection-change", {
            selection: [props.addr],
            activeCell: null
        })}/>
    </> : <>
        <span>
            {computedValue(props.cell, props.addr)}
        </span>
    </>}</div>
}

export const highlighter = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                Name: t.variableName,
                Boolean: t.bool,
                String: t.string,
                Address: t.labelName,
                NamedColumn: t.labelName,
            }),
            indentNodeProp.add({
                Application: context => context.column(context.node.from) + context.unit
            }),
            foldNodeProp.add({
                Application: foldInside
            })
        ]
    }),
    languageData: {}
});

export const highlight = HighlightStyle.define([
    { tag: t.labelName, fontStyle: "italic", class: "addr" },
    { tag: t.string, fontStyle: "italic", class: "text" }
])

export function FormulaEditor(props: { cell: Value, blur: () => void }) {
    const editor = React.createRef<HTMLDivElement>();

    React.useEffect(() => {
        if (!editor.current)
            return;

        const ed = new EditorView({
            parent: editor.current,
            state: EditorState.create({
                doc: props.cell.getRaw(),
                selection: EditorSelection.single(0, props.cell.getRaw().length),
                extensions: [
                    closeBrackets(),
                    highlighter.extension,
                    syntaxHighlighting(highlight),
                    EditorView.updateListener.of(update => props.cell.setRaw(update.state.doc.toString()))
                ],
            }),
        });

        setTimeout(() => {
            ed.focus();
        });

        return () => {
            props.cell.setRaw(ed.state.doc.toString());
            ed.destroy();
        };
    }, []);

    return <div
        ref={editor}
        onBlur={() => props.blur()}
        className={"formula-editor"} />;
}