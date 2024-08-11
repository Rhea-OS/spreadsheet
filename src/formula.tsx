import * as React from "react";
import * as chrono from 'chrono-node';
import * as luxon from 'luxon';

import {Value} from "./spreadsheet.js";

export default function FormulaBar(props: { activeCell: Value }) {
    return <div className={"formula"}>
        {props.activeCell.renderer().formula(props.activeCell)}
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

            return <span>{props.getRaw()}</span>
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            React.useSyncExternalStore(props.onChange, () => props.getRaw());

            return <textarea
                // className={"formula"}
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
                return <div className={"horizontal"}>
                    {"Invalid Date"}
                </div>

            const date = luxon.DateTime.fromJSDate(parsed);

            return <div className={"horizontal"}>
                {date.toLocaleString(luxon.DateTime.DATETIME_FULL)}
            </div>;
        },
        formula<Props extends Value>(props: Props): React.ReactNode {
            return <></>;
        },
        friendlyName: {
            label: "Date & Time",
            icon: "calendar-clock"
        }
    }
}