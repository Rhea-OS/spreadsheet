import * as React from 'react';
import * as rdom from 'react-dom/client';
import * as obs from 'obsidian';
import * as icons from 'lucide-react';

import units, { Unit } from "./units.js";
import SpreadsheetPlugin from "./main.js";
import ListBox from './components/listbox.js';
import Setting from './components/setting.js';

export interface Settings {
    units: Unit[],
    dataTypes: ({ name: string } & Datatype)[]
}
export const default_settings: Settings = {
    units,
    dataTypes: [{
        name: 'Date',
        // This pattern will incorrectly pass things like the 14th month.
        format: '(\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d:[0-5]\\d\\.\\d+)|(\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d:[0-5]\\d)|(\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d)'
    }]
};

export type Datatype = Text | Numeric | List;
export type Text = {
    format: string
};
export type List = {
    options: string[],
    multiple: boolean
};
export type Numeric = {
    unit: Unit,
    format: string,
    metric: boolean
}

export default class SettingsTab extends obs.PluginSettingTab {
    private root: rdom.Root | null = null;

    constructor(readonly app: obs.App, readonly plugin: SpreadsheetPlugin) {
        super(app, plugin);
    }

    display() {
        (this.root = rdom.createRoot(this.containerEl))
            .render(<SpreadsheetSettings tab={this} />);
    }

    hide() {
        this.root?.unmount();
    }
}

export function SpreadsheetSettings(props: { tab: SettingsTab }) {
    const [settings, setSettings] = React.useState(props.tab.plugin.settings);
    const [state, setState] = React.useState({ highlightedDatatype: 0 });

    React.useEffect(() => void props.tab.plugin.saveData(Object.assign(props.tab.plugin.settings, settings)), [settings]);

    return <div className="spreadsheet-settings">
        <ListBox controls={{
            onSelect: i => setState(prev => ({ ...prev, highlightedDatatype: i })),
            onAdd: e => onAddMenu(setSettings, setState).showAtMouseEvent(e.nativeEvent),
            onDelete: item => setSettings(prev => ({
                ...prev,
                dataTypes: [...prev.dataTypes.slice(0, item), ...prev.dataTypes.slice(item + 1)]
            })),
        }}>
            {settings.dataTypes.map(i => ({
                'text': () => <>
                    <icons.TextCursorInput size={14} />
                    <label>{i.name}</label>
                </>,
                'numeric': () => <>
                    <icons.Ruler size={14} />
                    <label>{i.name}</label>
                </>,
                'list': () => <>
                    <icons.List size={14} />
                    <label>{i.name}</label>
                </>,
            } as const)[getDatatype(i)]())}
        </ListBox>

        <section className='editor'>
            {settings.dataTypes[state.highlightedDatatype] ? 
                ({
                    'text': (text: Text & { name: string }) => <TextFormatEditor text={text} key={`text-editor-${state.highlightedDatatype}`}/>,
                    'numeric': (numeric: Numeric & { name: string }) => <NumericFormatEditor numeric={numeric} key={`numeric-editor-${state.highlightedDatatype}`}/>,
                    'list': (list: List & { name: string }) => <ListEditor list={list} key={`list-editor-${state.highlightedDatatype}`}/>,
                } as const)[getDatatype(settings.dataTypes[state.highlightedDatatype])]?.(settings.dataTypes[state.highlightedDatatype] as any) ?? null
            : null}
        </section>
    </div>
}

export function TextFormatEditor(props: { text: Text & { name: string } }) {
    const [text, setText] = React.useState(props.text);

    React.useEffect(() => void Object.assign(props.text, text), [text]);

    return <>
        <div className="flex">
            <input type="text" value={text.name} onChange={e => setText(prev => ({ ...prev, name: e.target.value }))} className="fill" />
        </div>

        <Setting title="format"
                 description="Your textual datatype should have a format associated with it validate it against user input, and to extract necessary information from it. Any regular expression is valid here."
                 lineFormat={/^.*$/}
                 value={text.format}
                 onChange={format => setText(prev => ({ ...prev, format: format }))} />
    </>;
}

export function NumericFormatEditor(props: { numeric: Numeric & { name: string } }) {
    const [numeric, setNumeric] = React.useState(props.numeric);

    React.useEffect(() => void Object.assign(props.numeric, numeric), [numeric]);

    return <>
        <div className="flex">
            <input type="text" value={numeric.name} onChange={e => setNumeric(prev => ({ ...prev, name: e.target.value }))} className="fill" />
        </div>
        
        <Setting title="Format"
                 description='How values of this unit are parsed/printed. The numeric value of your unit is substituted for {}.'
                 lineFormat={/^[^\{]*\{\}[^\{]*$/}
                 value={numeric.format}
                 onChange={value => setNumeric(prev => ({
                    ...prev,
                    format: value
                 }))}/>
        <Setting title='Associated Unit' 
                 description='Which unit is associated with this datatype. This value helps in automatic unit conversion.'
                 options={{}}
                 value=''
                 onChange={unit => setNumeric(prev => ({
                    ...prev,
                    unit: null
                 }))} />
        <Setting title='Is metric unit' 
                 description='If this unit is a metric unit, such as metre or gram, then the necessary unit convertions and prefixing will be done automatically.'
                 checked={true}
                 value=''
                 onChange={metric => setNumeric(prev => ({
                    ...prev,
                    metric
                 }))} />
                 
    </>;
}

export function ListEditor(props: { numeric: List & { name: string } }) {
    const [numeric, setNumeric] = React.useState(props.numeric);

    React.useEffect(() => void Object.assign(props.numeric, numeric), [numeric]);

    return <>
        <div className="flex">
            <input type="text" value={numeric.name} onChange={e => setNumeric(prev => ({ ...prev, name: e.target.value }))} className="fill" />
        </div>

    </>;
}

export function onAddMenu(
    setSettings: React.Dispatch<React.SetStateAction<Settings>>,
    setState: React.Dispatch<React.SetStateAction<{ highlightedDatatype: number }>>,
): obs.Menu {
    const menu = new obs.Menu();

    menu.addItem(item => item
        .setTitle("Add Text Type")
        .setIcon('text-cursor-input')
        .onClick(e => setSettings(prev => ({
            ...prev,
            dataTypes: [...prev.dataTypes, {
                name: '',
                format: ''
            }]
        }))));

    menu.addItem(item => item
        .setTitle("Add Numeric Type")
        .setIcon('ruler')
        .onClick(e => setSettings(prev => ({
            ...prev,
            dataTypes: [...prev.dataTypes, {
                name: '',
                format: '',
                unit: null,
                metric: false
            }]
        }))));

    menu.addItem(item => item
        .setTitle("Add List Type")
        .setIcon('list')
        .onClick(e => setSettings(prev => ({
            ...prev,
            dataTypes: [...prev.dataTypes, {
                name: '',
                options: [],
                multiple: false
            }]
        }))));

    return menu;
}

export const getDatatype = (i: Datatype): 'text' | 'numeric' | 'list' => 'options' in i ? 'list' : 'unit' in i ? 'numeric' : 'text';