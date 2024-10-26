import React from 'react';
import {handleKeyDown} from "./valueEditor.js";
import {Value} from "../csv.js";
import Spreadsheet from "../viewport.js";

export default function FormulaEditor(props: { value: Value, onBlur: () => void, spreadsheet: Spreadsheet }) {
    const [value, setValue] = React.useState(props.value.getRaw());

    React.useEffect(() => props.value.setRaw(value), [value]);

    return <textarea autoFocus={true}
                     value={value}
                     onChange={e => setValue(e.target.value)}
                     onMouseDown={e => e.stopPropagation()}
                     onMouseMove={e => e.stopPropagation()}
                     onMouseUp={e => e.stopPropagation()}
                     onKeyDown={e => handleKeyDown(e, props.spreadsheet)}
                     onBlur={() => props.onBlur()}/>
}