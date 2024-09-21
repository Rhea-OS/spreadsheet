import React from 'react';

import { Value } from '../viewport.js';
import FormulaEditor from './formulaEditor.js';

export default function ValueEditor(props: { edit?: boolean, value: Value }) {
    const [editMode, setEditMode] = React.useState(props.edit ?? false);
    const [value, setValue] = React.useState(props.value.getRaw());

    React.useEffect(() => props.value.setRaw(value), [value]);
    React.useEffect(() => setValue(props.value.getRaw()), [props]);

    const ref = React.createRef<HTMLTextAreaElement>();

    React.useEffect(() => ref.current?.focus(), [ref]);

    function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key == "Enter" || e.key == "Tab")
            e.stopPropagation();    
    }

    return <div className="table-cell-inner"
        onDoubleClick={e => e.button == 0 && setEditMode(true)}>
        {editMode ? <> { props.value.isComputedValue ?
            <>
                <textarea ref={ref}
                    rows={1}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    onMouseMove={e => e.stopPropagation()}
                    onMouseUp={e => e.stopPropagation()}
                    onKeyUp={e => handleKeyUp(e)}
                    onBlur={() => setEditMode(false)} />
            </> : <>
                <FormulaEditor value={props.value} />
            </>
        }</> : <>
                {value}
            </>}
    </div>;
}