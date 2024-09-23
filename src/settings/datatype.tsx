import ListBox from "../components/listbox.js";
import * as icons from "lucide-react";
import * as React from "react";
import { Datatype, List, Numeric, Settings, Text } from "./settingsTab.js";
import Setting from "../components/setting.js";
import * as obs from "obsidian";
import SpreadsheetPlugin from "../main.js";

export default function DatatypeSettings(props: { plugin: SpreadsheetPlugin }) {
    const [settings, setSettings] = React.useState(props.plugin.settings);
    const [highlighted, setHighlighted] = React.useState(0);

    React.useEffect(() => void props.plugin.saveData(Object.assign(props.plugin.settings, settings)), [settings]);

    return <section className={"datatypes settings-group"}>
        <div className="description dt-desc">
            <h1>{"Configure Datatypes"}</h1>
            <p>{"Datatypes allow the spreadsheet editor to select the correct display and edit modes for cells of that value. You can define custom types to better fit your use-case. Datatypes exist vault-wide and so can be used from all spreadsheets."}</p>
        </div>

        <ListBox controls={{
            onSelect: i => setHighlighted(i),
            onAdd: e => onAddMenu(setSettings, setHighlighted).showAtMouseEvent(e.nativeEvent),
            onDelete: item => setSettings(prev => ({
                ...prev,
                dataTypes: [...prev.dataTypes.slice(0, item), ...prev.dataTypes.slice(item + 1)]
            })),
        }}>
            {settings.dataTypes.map(i => ({
                'text': () => <>
                    <icons.TextCursorInput size={14}/>
                    <label>{i.name}</label>
                </>,
                'numeric': () => <>
                    <icons.Ruler size={14}/>
                    <label>{i.name}</label>
                </>,
                'list': () => <>
                    <icons.List size={14}/>
                    <label>{i.name}</label>
                </>,
            } as const)[getDatatype(i)]())}
        </ListBox>

        <section className='editor'>
            {settings.dataTypes[highlighted] ?
                ({
                    'text': (text: Text & { name: string }) => <TextFormatEditor text={text}
                                                                                 key={`text-editor-${highlighted}`}/>,
                    'numeric': (numeric: Numeric & { name: string }) => <NumericFormatEditor numeric={numeric}
                                                                                             key={`numeric-editor-${highlighted}`}/>,
                    'list': (list: List & { name: string }) => <ListEditor list={list}
                                                                           key={`list-editor-${highlighted}`}/>,
                } as const)[getDatatype(settings.dataTypes[highlighted])]?.(settings.dataTypes[highlighted] as any) ?? null
                : null}
        </section>
    </section>
}

export function TextFormatEditor(props: { text: Text & { name: string } }) {
    const [text, setText] = React.useState(props.text);

    React.useEffect(() => void Object.assign(props.text, text), [text]);

    return <>
        <div className="datatype-name flex">
            <input type="text" value={text.name} onChange={e => setText(prev => ({...prev, name: e.target.value}))}
                   className="fill"/>
        </div>

        <section className="editor-content">
            <Setting title="format"
                     description="Your textual datatype should have a format associated with it validate it against user input, and to extract necessary information from it. Any regular expression is valid here."
                     lineFormat={/^.*$/}
                     value={text.format}
                     onChange={(format: string) => setText(prev => ({...prev, format: format}))}/>
        </section>
    </>;
}

export function NumericFormatEditor(props: { numeric: Numeric & { name: string } }) {
    const [numeric, setNumeric] = React.useState(props.numeric);

    React.useEffect(() => void Object.assign(props.numeric, numeric), [numeric]);

    return <>
        <div className="datatype-name flex">
            <input type="text" value={numeric.name}
                   onChange={e => setNumeric(prev => ({...prev, name: e.target.value}))} className="fill"/>
        </div>

        <section className="editor-content">
            <Setting title="Format"
                     description='How values of this unit are parsed/printed. The numeric value of your unit is substituted for {}.'
                     lineFormat={/^[^{]*\{}[^{]*$/}
                     value={numeric.format}
                     onChange={(format: string) => setNumeric(prev => ({
                         ...prev,
                         format: format
                     }))}/>
            <Setting title='Associated Unit'
                     description='Which unit is associated with this datatype. This value helps in automatic unit conversion.'
                     options={{}}
                     value=''
                     onChange={(_unit: string) => setNumeric(prev => ({
                         ...prev,
                         unit: null as any
                     }))}/>
            <Setting title='Is metric unit'
                     description='If this unit is a metric unit, such as metre or gram, then the necessary unit convertions and prefixing will be done automatically.'
                     checked={true}
                     value=''
                     onChange={(metric: boolean) => setNumeric(prev => ({
                         ...prev,
                         metric
                     }))}/>
        </section>
    </>;
}

export function ListEditor(props: { list: List & { name: string } }) {
    const [list, setList] = React.useState(props.list);
    const [state, setState] = React.useState({
        highlightedOption: 0,
        isEditing: false
    });

    const ref = React.createRef<HTMLInputElement>();

    React.useEffect(() => void Object.assign(props.list, list), [list]);
    React.useEffect(() => {
        ref.current?.focus();
    }, [state, list, ref]);

    return <>
        <div className="datatype-name flex">
            <input type="text" value={list.name} onChange={e => setList(prev => ({...prev, name: e.target.value}))}
                   className="fill"/>
        </div>

        <section className="editor-content">
            <ListBox controls={{
                onSelect: index => setState(prev => ({...prev, highlightedOption: index})),
                onAdd: _ => setList(prev => ({...prev, options: [...prev.options, ""]})),
                onDelete: i => setList(prev => ({
                    ...prev,
                    options: [...prev.options.slice(0, i), ...prev.options.slice(i + 1)]
                })),
                onSwap: (i, j) => setList(prev => ({
                    ...prev,
                    options: prev.options.with(i, prev.options[j]).with(j, prev.options[i])
                })),
                onCustom: () => [<div className="icon-button"
                                      tabIndex={0}
                                      onClick={e => setState(prev => ({...prev, isEditing: true}))}>
                    <icons.PencilLine size={14}/>
                </div>]
            }}>
                {list.options.map((i, a) => <div onDoubleClick={_ => setState(prev => ({...prev, isEditing: true}))}
                                                 key={`list-item-option-${a}`}
                                                 className="option fill flex">
                    {a == state.highlightedOption && state.isEditing ?
                        <input type="text"
                               value={i}
                               ref={ref}
                               onChange={e => setList(prev => ({
                                   ...prev,
                                   options: prev.options.with(a, e.target.value)
                               }))}
                               key={`edit-option-${a}`}
                               onKeyUp={e => e.key == "Enter" && (e.target as HTMLInputElement).blur()}
                               className="fill"
                               onBlur={_ => setState(prev => ({...prev, isEditing: false}))}/> :
                        <label>{i}</label>
                    }
                </div>)}
            </ListBox>
        </section>
    </>;
}

export function onAddMenu(
    setSettings: React.Dispatch<React.SetStateAction<Settings>>,
    setHighlighted: React.Dispatch<React.SetStateAction<number>>,
): obs.Menu {
    const menu = new obs.Menu();

    const onAdd = (def: Datatype) => (): void => void setSettings(prev => {
        setHighlighted(prev.dataTypes.length + 1);

        return ({
            ...prev,
            dataTypes: [...prev.dataTypes, Object.assign(def, {name: ''})]
        });
    });

    menu.addItem(item => item
        .setTitle("Add Text Type")
        .setIcon('text-cursor-input')
        .onClick(onAdd({
            format: ''
        })));

    menu.addItem(item => item
        .setTitle("Add Numeric Type")
        .setIcon('ruler')
        .onClick(onAdd({
            format: '',
            unit: null as any,
            metric: false
        })));

    menu.addItem(item => item
        .setTitle("Add List Type")
        .setIcon('list')
        .onClick(onAdd({
            options: [],
            multiple: false
        })));

    return menu;
}

export const getDatatype = (i: Datatype): 'text' | 'numeric' | 'list' => 'options' in i ? 'list' : 'unit' in i ? 'numeric' : 'text';