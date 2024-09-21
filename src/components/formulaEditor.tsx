import React from 'react';
import { Value } from '../viewport.js';

export default function FormulaEditor(props: { value: Value }) {
    const [value, setValue] = React.useState(props.value.getRaw());

    React.useEffect(() => props.value.setRaw(value), [value]);

    return <textarea value={value} onChange={e => setValue(e.target.value)}/>
}