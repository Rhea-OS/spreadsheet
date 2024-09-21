import React from 'react';
import {Value} from '../viewport.js';
import {handleKeyDown} from "./valueEditor.js";

export default function FormulaEditor(props: { value: Value, onBlur: () => void }) {
    const [value, setValue] = React.useState(props.value.getRaw());

    React.useEffect(() => props.value.setRaw(value), [value]);

    return <textarea autoFocus={true}
                     value={value}
                     onChange={e => setValue(e.target.value)}
                     onMouseDown={e => e.stopPropagation()}
                     onMouseMove={e => e.stopPropagation()}
                     onMouseUp={e => e.stopPropagation()}
                     onKeyDown={e => handleKeyDown(e, props.value)}
                     onBlur={() => props.onBlur()}/>
}