import React from 'react';

import {Datum, typeDef} from "./data.js";

export default function DataVisualiser<T>(props: { data: Datum<T> }) {

    const visualisers: Record<string, (data: Datum<any>) => React.ReactNode> = ({
        raw: data => <span>{data.intoRaw()}</span>,
        date: (data: Datum<Date>) => <DateVisualiser data={data}/>
    });

    return (visualisers[props.data.typeName()] ?? visualisers.raw)(props.data);
}

export function DateVisualiser(props: { data: Datum<Date> }) {
    const [date, setDate] = React.useState(props.data.get());
    // React.useEffect(() => props.data.set(date), [date]);

    return <>{typeDef['date'].intoRaw(date)}</>;
}