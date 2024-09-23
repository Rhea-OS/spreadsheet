import React from 'react';
import * as icons from 'lucide-react';

import Spreadsheet from "../viewport.js";
import {Settings} from "../settings/settingsTab.js";
import Tools, {Tool} from '../actions.js';

export default function Toolbar(props: { settings: Settings, sheet: Spreadsheet }) {
    return <div className={"flex toolbar"}>
        {props.settings.toolbar
            .map(item => typeof item == 'string' ? toolRenderers[Tools[item].type](Tools[item]) : <span className={"gap"}/> )}
    </div>
}

const Icon = (props: { icon: keyof typeof icons.icons, size?: number }) => {
    const Icon = icons.icons[props.icon];
    return <Icon size={props.size ?? 12}/>
}

export const toolRenderers = {
    button: tool => <button className={"toolbar-button"}>
        <Icon icon={tool.icon} />
    </button>,
    viewport: tool => null
} satisfies Record<(typeof Tools[keyof typeof Tools])['type'], (tool: Tool) => React.ReactNode>;