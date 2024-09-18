import React from "react";
import * as lucide from "lucide-react";

export interface Controls {
    onAdd?: (e: React.MouseEvent) => void,
    onDelete?: (item: number) => void,
    onSwap?: (item: number, item2: number) => boolean,
    onSelect?: (index: number) => void,
}

export default function ListBox(props: {
    children: React.ReactNode[],
    controls: Controls
}) {
    const [state, setState] = React.useState({
        index: 0,
        refs: props.children?.map(_ => React.createRef<HTMLDivElement>()) ?? []
    });

    const setSelection = (move: { rel: number } | { abs: number }) => {
        const index = 'rel' in move ? (props.children.length + state.index + move.rel) % props.children.length : move.abs % props.children.length;

        setState(prev => ({
            ...prev,
            index
        }));

        props.controls.onSelect?.(index);
    };

    return <div
        className="list-box"
        tabIndex={0}
        onKeyUp={e => ({
            "uparrow": e => setSelection({rel: -1}),
            "downarrow": e => setSelection({rel: 1}),
        } as Record<string, (e: React.KeyboardEvent) => void>)[e.key.toLowerCase() as string]?.(e)}>

        <div className={"list-box-controls"}>
            <div className={"button-group"}>
                {props.controls.onAdd ? <div className="icon-button"
                                             tabIndex={0}
                                             onClick={e => {
                                                 props.controls?.onAdd!(e);
                                             }}>
                    <lucide.Plus size={14}/>
                </div> : null}

                {props.controls.onDelete ? <div className="icon-button"
                                                tabIndex={0}
                                                onClick={() => {
                                                    props.controls?.onDelete!(state.index);
                                                }}>
                    <lucide.Minus size={14}/>
                </div> : null}
                {props.controls.onSwap ? <>
                    <div className="icon-button"
                         tabIndex={0}
                         onClick={() => {
                             if (props.controls?.onSwap!(state.index, state.index - 1))
                                 setSelection({rel: -1})
                         }}>
                        <lucide.ChevronUp size={14}/>
                    </div>
                    <div className="icon-button"
                         tabIndex={0}
                         onClick={() => {
                             if (props.controls?.onSwap!(state.index, state.index + 1))
                                 setSelection({rel: 1})
                         }}>
                        <lucide.ChevronDown size={14}/>
                    </div>
                </> : null}
            </div>
        </div>

        {props.children.map((item, a) => <div
            key={`list-box-item-${a}`}
            className={`list-item${state.index == a ? " active" : ""}`}
            ref={state.refs[a]}
            onClick={_ => setSelection({abs: a})}>
            {item}
        </div>)}

    </div>
}
