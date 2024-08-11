import React from 'react';
import * as lux from 'luxon';

import {Datum, typeDef, Valid} from "./data.js";

export default function DataVisualiser<T>(props: { data: Datum<T> }) {

    const visualisers: Record<string, (data: Datum<any>) => React.ReactNode> = ({
        raw: data => <span>{data.intoRaw()}</span>,
        date: (data: Datum<Date>) => <DateVisualiser data={data}/>
    });

    return (visualisers[props.data.typeName()] ?? visualisers.raw)(props.data);
}

export function DateVisualiser(props: { data: Datum<Date> }) {
    React.useSyncExternalStore(onChange => props.data.watch(onChange), () => props.data.intoRaw());

    const data = props.data.get();

    if (Valid.isValid(data))
        return <span>{data.ok.toLocaleDateString()}</span>;
    else
        return <>{`Invalid date format: ${data.err}`}</>
}