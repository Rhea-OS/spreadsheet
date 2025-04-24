import React from 'react';
import * as dom from 'react-dom/client';
import * as obs from 'obsidian';
import * as icons from 'lucide-react';

import {Value} from "../csv.js";
import {StateHolder} from "../main.js";
import {Selection} from "../selection.js";
import {computedValue} from "../inline.js";
import * as expr from 'expression';
import ListBox from './listbox.js';

const toIter = function* (walker: TreeWalker): Generator<Node> {
    for (let node = walker.nextNode(); node; node = walker.nextNode())
        yield node;
}

export function EditableTableCell(props: { cell: Value, edit?: boolean, sheet: StateHolder, addr: Selection.Cell }) {
    return <div className={"table-cell-inner"}
                onDoubleClick={_ => props.sheet.state.dispatch("selection-change", {
                    selection: [props.addr],
                    activeCell: props.addr
                })}>
        {props.edit ? <>
            <FormulaEditor cell={props.cell} blur={() => props.sheet.state.dispatch("selection-change", {
                selection: [props.addr],
                activeCell: null
            })}/>
        </> : <>
        <span>
            {computedValue(props.cell, props.addr)}
        </span>
        </>}

        <button className={"floating-action-button"} onClick={e => contextMenu(e, props.cell, props.addr)}>
            <icons.EllipsisVertical size={11}/>
        </button>
    </div>
}

export function contextMenu(e: React.MouseEvent<HTMLButtonElement>, cell: Value, addr: Selection.Cell) {
    e.preventDefault();

    const menu = new obs.Menu();

    menu.addItem(item => item
        .setIcon("pencil-line")
        .setTitle("Set label")
        .onClick(async () => {
            const cellAddr = Selection.stringify(addr).toLowerCase();
            const labels = Object.entries(cell.document().documentProperties.frontMatter.labelledCells ?? {})
                .filter(([a, i]) => i.contains(cellAddr))
                .map(i => i[0]);

            if (labels.length <= 0)
                labels.push('');

            await LabelEditor.editor(label => {
                // The label is taken if it's in the list but it's value is not `cellAddr`
                const labels = cell.document().documentProperties.frontMatter.labelledCells;

                return (!!label) && (!!labels) && (label in labels && labels[label]?.toLowerCase() !== cellAddr);
            }, labels)
                .then(labels => cell.document().updateDocumentProperties(doc => {
                    for (const label of labels)
                        (doc.frontMatter.labelledCells ??= {})[label] = cellAddr;

                    return doc
                }));
        }));

    const target = e.currentTarget.getBoundingClientRect();

    menu.showAtPosition({
        x: target.x + target.width,
        y: target.y
    });
}

export function FormulaEditor(props: { cell: Value, blur: () => void }) {
    const editor = React.createRef<HTMLDivElement>();

    React.useEffect(() => {
        if (!editor.current)
            return;

        const ed = new Editor(editor.current, props.cell.document().cx);

        ed.addEventListener('commit', text => props.cell.setRaw((text as CustomEvent<string>).detail));
        ed.setText(props.cell.getRaw());

        ed.el.focus();

    }, []);

    return <div
        ref={editor}
        onBlur={() => props.blur()}
        className={"formula-editor"}/>;
}

interface EventTypes {
    'commit': string
}

export class Editor extends EventTarget {
    static DEBOUNCE_TIME: number = 200; // .2 sec

    constructor(readonly el: HTMLDivElement, private readonly cx: expr.Context, input: string = '') {
        super();

        this.el.tabIndex = 0;
        this.el.contentEditable = 'true';

        this.el.addEventListener('input', e => this.update(e));

        this.el.classList.add("formula-editor");

        this.el.innerText = input;

        let commit: NodeJS.Timeout;

        this.el.addEventListener('blur', () => this.commit());
        this.el.addEventListener('keydown', e => e.key == 'Enter' && this.commit());
        this.el.addEventListener('input', () => {
            clearTimeout(commit);
            commit = setTimeout(() => this.commit(), Editor.DEBOUNCE_TIME);
        });

        this.el.addEventListener('focus', () => {
            const selection = window.getSelection();

            if (selection) {
                const range = document.createRange();
                range.selectNodeContents(this.el);

                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    }

    public setText(input: string) {
        try {
            const sel = this.getSelectionOffsets(this.el);

            const tokens: Array<string | HTMLSpanElement> = [];

            if (input.startsWith('=')) {
                let offset = 0;
                tokens.push('=');

                const formula = input.slice(1);

                for (const token of this.cx.parseStr(formula)) {
                    const lexeme = {
                        token: token.token(),
                        type: expr.TokenType[token.type].toLowerCase(),
                        offset: formula.indexOf(token.token(), offset)
                    };

                    const colour = document.createElement('span');
                    colour.setText(lexeme.token);
                    colour.classList.add('token', lexeme.type);
                    tokens.push(formula.slice(offset, lexeme.offset), colour);

                    offset = lexeme.offset + lexeme.token.length;
                }

                tokens.push(formula.slice(offset));
            } else
                tokens.push(input);

            this.el.innerText = '';
            this.el.append(...tokens);

            this.restoreSelectionFromOffsets(this.el, sel);

        } catch (e) {
        }
    }

    /**
     * Computes the character offset of (node, nodeOffset)
     * within the root by walking all text‐nodes.
     */
    private getNodeCharacterOffset(root: HTMLElement, targetNode: Node, targetOffset: number): number {
        let chars = 0, node: Node | null;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

        while ((node = walker.nextNode())) {
            if (node === targetNode) return chars + targetOffset;

            chars += (node.textContent || "").length;
        }

        return chars;
    }

    /**
     * Returns an array of { start, end } character‑offset pairs
     * for each Range in the current Selection inside `root`.
     */
    private getSelectionOffsets(root: HTMLElement): ({ start: number; end: number })[] {
        const sel = window.getSelection();

        if (!sel) return [];

        const ranges: ({ start: number; end: number })[] = [];
        for (let i = 0; i < sel.rangeCount; i++) {
            const range = sel.getRangeAt(i);
            const start = this.getNodeCharacterOffset(root, range.startContainer, range.startOffset);
            const end = this.getNodeCharacterOffset(root, range.endContainer, range.endOffset);
            ranges.push({start, end});
        }

        return ranges;
    }

    private findPosition(root: HTMLElement, chars: number): { node: Node; offset: number } {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let accumulated = 0, node: Node | null = null;

        while ((node = walker.nextNode())) {
            const len = (node.textContent || "").length;
            if (accumulated + len >= chars) {
                // this is the right text node
                return {
                    node,
                    offset: chars - accumulated
                };
            }
            accumulated += len;
        }

        // fallback: at end of last node
        return {
            node: root,
            offset: root.childNodes.length
        };
    }

    private restoreSelectionFromOffsets(
        root: HTMLElement,
        ranges: Array<{ start: number; end: number }>
    ) {
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();

        for (const {start, end} of ranges) {
            const {node: startNode, offset: startOff} = this.findPosition(root, start);
            const {node: endNode, offset: endOff} = this.findPosition(root, end);

            const range = document.createRange();
            range.setStart(startNode, startOff);
            range.setEnd(endNode, endOff);
            sel.addRange(range);
        }
    }

    private update(e: Event) {
        this.setText(this.el.innerText);
    }

    private commit() {
        this.emit("commit", this.el.innerText);
    }

    emit<K extends keyof EventTypes>(type: K, detail: EventTypes[K]): boolean {
        const event = new CustomEvent(type, {detail});
        return this.dispatchEvent(event);
    }
}

export class LabelEditor extends obs.Modal {
    private root: dom.Root;

    constructor(private isInUse: (label: string) => boolean, private labels: string[] = [''], private onSubmit: (labels: string[]) => void) {
        super((window as any as { app: obs.App }).app);

        this.root = dom.createRoot(this.contentEl);
    }

    onOpen() {
        const Root = this.content.bind(this);
        this.root.render(<Root/>);
    }

    content() {
        const [labels, setLabels] = React.useState<string[]>(this.labels);

        return <form onSubmit={e => {
            e.preventDefault();

            this.onSubmit(new FormData(e.currentTarget).getAll('label') as string[]);

            this.close();
        }}>
            <ListBox controls={{
                onAdd() {
                    setLabels(prev => [...prev, '']);
                },

                onDelete(item) {
                    setLabels(prev => [...prev.slice(0, item), ...prev.slice(item + 1)])
                }
            }}>
                {labels.map((label, a) => <div className={"flex fill centre"} key={`label-${a}`}>
                    <input className="flat fill"
                           key={`cell-label-${a}`} name="label" type={"text"} value={label}
                           onChange={e => setLabels(prev => [
                               ...prev.slice(0, a),
                               e.target.value,
                               ...prev.slice(a + 1)
                           ])}/>

                    <span title={`This label is already in use. By proceeding, the cell originally called '${label}' will have the label removed.`}>
                        {this.isInUse(label) ? <icons.TriangleAlert size={12} color={'var(--text-warning)'} />: null}
                    </span>
                </div>)}
            </ListBox>

            <button type={"submit"}>{"Save"}</button>
        </form>
    }

    onClose() {
        this.root.unmount();
        super.onClose();
    }

    static editor(isInUse: (label: string) => boolean, labels: string[] = ['']): Promise<string[]> {
        return new Promise(ok => new LabelEditor(isInUse, labels, labels => ok(labels)).open());
    }
}