import * as React from "react";
import * as chrono from 'chrono-node';
import * as luxon from 'luxon';
import * as obs from 'obsidian';

import {Value, Selection} from "./viewport.js";
import {DEFAULT_ROW_HEIGHT} from "./components/table.js";

export type ResizeState = {
    isResizing: false,
    height: number,
} | {
    isResizing: true,
    height: number,
    prevMouseY: number,
};

export default function FormulaBar(props: { selection: Selection.CellGroup[] }) {
    const [resize, setResize] = React.useState<ResizeState>({
        isResizing: false,
        height: DEFAULT_ROW_HEIGHT
    });

    React.useEffect(() => {
        const mouseUp = (e: MouseEvent) => setResize(prev => ({
            height: prev.height,
            isResizing: false
        }));
        const mouseMove = (e: MouseEvent) => setResize(prev => {
            if (prev.isResizing)
                return {
                    isResizing: true,
                    prevMouseY: e.clientY,
                    height: prev.height + (e.clientY - prev.prevMouseY)
                };

            return prev;
        });

        if (resize.isResizing) {
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        } else {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
        }
    }, [resize]);

    return <div className={"formula"}
                style={{height: `${resize.height}px`}}>
        <div className={"custom-input"}>
        </div>
        <span
            className={"resize-handle horizontal"}
            onMouseDown={e => setResize(prev => ({
                isResizing: true,
                prevMouseY: e.clientY,
                height: prev.height
            }))}/>
    </div>
}

export interface CellRenderer {
    cell<Props extends Value>(props: Props): React.ReactNode,

    formula<Props extends Value>(props: Props): React.ReactNode,

    friendlyName: { label: string, icon?: string }
}

export namespace renderers {
    export const raw: CellRenderer = {
        cell<Props extends Value>(props: Props): React.ReactNode {
            React.useSyncExternalStore(props.onChange, () => props.getRaw());

            return <span className={"raw"}>{props.getRaw()}</span>
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            React.useSyncExternalStore(props.onChange, () => props.getRaw());
            const ref = React.createRef<HTMLTextAreaElement>();
            
            React.useEffect(() => {
                ref.current?.focus();
                ref.current?.select();
            }, [props]);

            return <textarea
                ref={ref}
                autoFocus={true}
                value={props.getRaw()}
                onChange={e => props.setRaw(e.target.value)}/>
        },
        friendlyName: {
            label: "Plain Text",
            icon: "type"
        }
    }

    export const date: CellRenderer = {
        cell<Props extends Value>(props: Props): React.ReactNode {
            let parsed = chrono.casual.parseDate(React.useSyncExternalStore(props.onChange, () => props.getRaw()));

            if (!parsed)
                return <span className={"raw"}>
                    {"Invalid Date"}
                </span>

            React.useEffect(() => {
                // ref.current?.focus();
                // ref.current?.select();
            }, [props]);

            const date = luxon.DateTime.fromJSDate(parsed);

            return <span className={"raw"}>
                {date.toFormat("dd/MM/yyyy hh:mm:ss")}
            </span>;
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            let parsed = luxon.DateTime.fromJSDate(chrono.casual.parseDate(React.useSyncExternalStore(props.onChange, () => props.getRaw())) ?? new Date());
            // const ref = React.createRef<HTMLInputElement>();
            // setTimeout(() => ref.current?.focus());

            return <input
                // ref={ref}
                autoFocus={true}
                type={"datetime-local"}
                value={parsed.toISO({includeOffset: false})!} onChange={e => props.setRaw(e.target.value)}/>;
        },
        friendlyName: {
            label: "Date & Time",
            icon: "calendar-clock"
        }
    }

    export const formula: CellRenderer = {
        cell<Props extends Value>(props: Props): React.ReactNode {
            return null;
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            return null;
        },
        friendlyName: {
            label: "Formula",
            icon: "sigma"
        }
    }

    export const markdown: CellRenderer = {
        cell<Props extends Value>(props: Props): React.ReactNode {
            React.useSyncExternalStore(props.onChange, () => props.getRaw());

            return <span className={"raw"}>{props.getRaw()}</span>
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            React.useSyncExternalStore(props.onChange, () => props.getRaw());

            return <span className={"raw"}>{props.getRaw()}</span>
        },
        friendlyName: {
            label: "Rich Text",
            icon: "ligature"
        }
    }

    export const sex: CellRenderer = oneOf("Sex", ["Male", "Female", "Other", "Unknown"], "user");
}

export function oneOf(friendlyName: string, values: string[], icon?: string): CellRenderer {

    const openMenu = function (e: Element, onValue: (value: string) => void) {
        const menu = new obs.Menu();

        for (const option of values)
            menu.addItem(item => item
                .setTitle(option)
                .onClick(_ => onValue(option)));

        const bound = e.getBoundingClientRect();

        menu.showAtPosition({
            x: bound.left,
            y: bound.bottom,
        });
    }

    return {
        friendlyName: {
            label: friendlyName,
            icon
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            const selected = React.useSyncExternalStore(props.onChange, () => props.getRaw());

            return <div tabIndex={0}
                        className={"dropdown"}
                        onClick={e => openMenu(e.currentTarget, value => props.setRaw(value))}
                        onKeyUp={e => ["Enter", "Space"].includes(e.key) && openMenu(e.currentTarget, value => props.setRaw(value))}>
                <span className={"fill"}>{selected}</span>
            </div>
        },
        cell<Props extends Value>(props: Props): React.ReactNode {
            const selected = React.useSyncExternalStore(props.onChange, () => props.getRaw());

            return <div
                tabIndex={0}
                className={"dropdown horizontal"}
                onClick={e => openMenu(e.currentTarget, value => props.setRaw(value))}
                onKeyUp={e => ["Enter", "Space"].includes(e.key) && openMenu(e.currentTarget, value => props.setRaw(value))}>
                <span className={"fill"}>{selected}</span>
                {/*<icons.ChevronsUpDown size={14}/>*/}
            </div>
        }
    }
}