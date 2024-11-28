import React from 'react';
import * as icons from 'lucide-react';

import {Settings} from "../settings/settingsTab.js";
import Tools, {Button, Tool, tools, ViewportOptions} from '../actions.js';
import {StateHolder} from "../main.js";

export default function Toolbar(props: { settings: Settings, sheet: StateHolder }) {
    return <div className={"flex toolbar"}>
        {props.settings.toolbar
            .map((item, a) => typeof item == 'string' ?
                toolRenderers[Tools[item].type](Tools[item] as any, props.sheet) :
                <span className={"gap"} key={`toolbar-spacer-${arguments}`}/> )}
    </div>
}

const Icon = (props: { icon: keyof typeof icons.icons, size?: number }) => {
    const Icon = icons.icons[props.icon];
    return <Icon size={props.size ?? 12}/>
}

export const toolRenderers = {
    button: (tool, sheet) => <button
        className={"toolbar-button"}
        key={`toolbar-item-${tool.label}`}
        onClick={e => tool.onClick(sheet)}>
        <Icon icon={tool.icon} />
    </button>,
    viewport: tool => null
} satisfies {
    [ToolType in (typeof Tools[keyof typeof Tools])['type']]: (tool: Tool & { type: ToolType }, sheet: StateHolder) => React.ReactNode
};

// Record<(typeof Tools[keyof typeof Tools])['type'], (tool: Tool) => React.ReactNode>