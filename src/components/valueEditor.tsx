import React from 'react';

import {Value} from '../viewport.js';
import FormulaEditor from './formulaEditor.js';

export function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, value: Value) {
    if (e.key == "Enter" || e.key == "Tab")
        if (!e.shiftKey) {
            e.stopPropagation();
            e.preventDefault();

            if (e.key == 'Enter' && e.ctrlKey)
                value.spreadsheet()
                    .moveActive(0, -1);
            else if (e.key == "Tab" && e.ctrlKey)
                value.spreadsheet()
                    .moveActive(-1, 0);
            else if (e.key == "Enter" && !e.ctrlKey)
                value.spreadsheet()
                    .moveActive(0, 1);
            else if (e.key == "Tab" && !e.ctrlKey)
                value.spreadsheet()
                    .moveActive(1, 0);
        }
}

export default function ValueEditor(props: { edit: boolean, setEdit: (edit: boolean) => void, value: Value }) {
    const [value, setValue] = React.useState(props.value.getRaw());

    React.useEffect(() => props.value.setRaw(value), [value]);
    React.useEffect(() => setValue(props.value.getRaw()), [props]);

    return <div className="table-cell-inner"
                onDoubleClick={e => e.button == 0 && props.setEdit(true)}>
        {props.edit ? <> {props.value.isComputedValue ?
            <>
                <textarea
                    autoFocus={true}
                    rows={1}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    onMouseMove={e => e.stopPropagation()}
                    onMouseUp={e => e.stopPropagation()}
                    onKeyDown={e => handleKeyDown(e, props.value)}
                    onBlur={() => props.setEdit(false)}/>
            </> : <>
                <FormulaEditor value={props.value}/>
            </>
        }</> : <>
            {value}
        </>}
    </div>;
}