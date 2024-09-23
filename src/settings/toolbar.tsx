import ListBox from "../components/listbox.js";
import Tools, {Tool} from "../actions.js";
import * as React from "react";

import SpreadsheetPlugin from "../main.js";

export default function ToolbarSettings(props: { plugin: SpreadsheetPlugin }) {
    const [settings, setSettings] = React.useState(props.plugin.settings);

    React.useEffect(() => void props.plugin.saveData(Object.assign(props.plugin.settings, settings)), [settings]);

    const insertTool = (tool: keyof typeof Tools | null) => setSettings(prev => ({
        ...prev,
        toolbar: typeof tool == 'string' ?
            (!prev.toolbar.includes(tool) ? [...prev.toolbar, tool] : prev.toolbar) :
            (prev.toolbar.at(-1) != null ? [...prev.toolbar, null] : prev.toolbar)
    }));
    const deleteTool = (index: number) => setSettings(prev => ({
        ...prev,
        toolbar: [...prev.toolbar.slice(0, index), ...prev.toolbar.slice(index + 1)]
    }));
    const swapTool = (a: number, b: number) => setSettings(prev => ({
        ...prev,
        toolbar: prev.toolbar.with(a, prev.toolbar[b]).with(b, prev.toolbar[a])
    }));

    return <section className={"toolbar-settings settings-group"}>
        <div className="description dt-desc">
            <h1>{"Configure Toolbar"}</h1>
            <p>{"Customise the tools you interact with the most to optimise your workflow"}</p>
        </div>

        <ListBox controls={{}}>
            {(Object.entries(Tools) as [keyof typeof Tools, Tool][])
                .filter(([key]) => !settings.toolbar.includes(key))
                .map(([key, tool]) => <div onDoubleClick={e => insertTool(key)} className={"fill"}>
                    {tool.label}
                </div>)}
        </ListBox>

        <section className='editor'>
            <ListBox controls={{
                onAdd: _ => insertTool(null),
                onDelete: i => deleteTool(i),
                onSwap: (a, b) => swapTool(a, b)
            }}>
                {settings.toolbar.map((i, a) => <div key={i ? `tool-${i}` : `toolbar-spacer-${a}`}
                                                     className={"fill"}
                                                     onDoubleClick={e => deleteTool(a)}>
                    {typeof i == 'string' ? <label>{Tools[i].label}</label> : <hr className={"spacer"}/>}
                </div>)}
            </ListBox>
        </section>
    </section>
}