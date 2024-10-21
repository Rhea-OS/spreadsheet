import React from 'react';

import Spreadsheet, {Value} from '../viewport.js';
import FormulaEditor from './formulaEditor.js';

export function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, spreadsheet: Spreadsheet) {
    if (e.key == "Enter" || e.key == "Tab")
        if (!e.shiftKey) {
            e.stopPropagation();
            e.preventDefault();

            if (e.key == 'Enter' && e.ctrlKey)
                spreadsheet.moveActive(0, -1);
            else if (e.key == "Tab" && e.ctrlKey)
                spreadsheet.moveActive(-1, 0);
            else if (e.key == "Enter" && !e.ctrlKey)
                spreadsheet.moveActive(0, 1);
            else if (e.key == "Tab" && !e.ctrlKey)
                spreadsheet.moveActive(1, 0);
        }
}

export default function ValueEditor(props: { edit: boolean, setEdit: (edit: boolean) => void, value: Value }) {
    const [value, setValue] = React.useState(props.value.getRaw());

    React.useEffect(() => props.value.setRaw(value), [value]);
    React.useEffect(() => setValue(props.value.getRaw()), [props]);

    return <div className="table-cell-inner"
                onDoubleClick={e => e.button == 0 && props.setEdit(true)}>
        {props.edit ? <>
            <textarea
                autoFocus={true}
                rows={1}
                value={value}
                onChange={e => setValue(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                onMouseMove={e => e.stopPropagation()}
                onMouseUp={e => e.stopPropagation()}
                onKeyDown={e => handleKeyDown(e, props.value.spreadsheet())}
                onBlur={() => props.setEdit(false)}/>
        </> : <>
            <ComputedValue value={props.value}/>
        </>}
    </div>;
}

export const ComputedValue = (props: { value: Value }) => {
    const value = props.value.getComputedValue();

    if (typeof value == 'string')
        if (props.value.isComputedValue())
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
};