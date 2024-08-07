import React from 'react';

import DataSource, {DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT} from "./data.js";
import Range, {Cell} from "./range.js";
import DataVisualiser from "./visualiser.js";

interface TableProps {
    data: DataSource<any>,
}

type State<T> = {
    state: T,
    setState: React.Dispatch<React.SetStateAction<T>>
};

export type SelectionState = {
    selected: Range[],
    dragStart: Cell | null,
    cell: Cell | null,
    hoverCell: Cell | null
};
export type ResizeState = {
    isResizing: false,
} | {
    isResizing: true,
    prevMouse: { x: number, y: number },
    prevSize: { width: number, height: number },
    onResize: (size: { width: number, height: number }) => void
};

export default function Table({data}: TableProps) {

    const [selected, setSelected] = React.useState<SelectionState>({
        selected: [],
        dragStart: null,
        cell: null,
        hoverCell: null
    });
    const [resize, setResize] = React.useState<ResizeState>({
        isResizing: false,
    });

    const [references, setReferences] = React.useState({
        tbody: React.createRef<HTMLDivElement>(),
        // thead: React.createRef<HTMLTableSectionElement>(),
        formula: React.createRef<HTMLTextAreaElement>(),

        cells: []
    });

    const getCell = (cell: Cell) => {
        const addr = cell.row * data.columnNames.length + cell.col;

        if (!references.cells[addr]) {
            const ref = React.createRef<HTMLDivElement>();
            setReferences(function (prev) {
                const cells = [...prev.cells];

                (cells[addr] as any) = ref;

                return {
                    ...prev,
                    cells
                };
            });

            return ref;
        } else return references.cells[addr];
    }

    React.useEffect(() => {
        references.formula.current?.focus();
        references.formula.current?.select();
    }, [selected.cell]);

    data.onExternalChange(() => setSelected(prev => ({
        ...prev,
        dragStart: null,
    })));

    return <div className={"table-widget"} onMouseMove={e => setResize(prev => {
        if (!prev.isResizing)
            return prev;

        const size = {
            width: prev.prevSize.width + (e.clientX - prev.prevMouse.x),
            height: prev.prevSize.height + (e.clientY - prev.prevMouse.y),
        };

        prev.onResize(size);

        return {
            isResizing: true,
            prevMouse: {
                x: e.clientX,
                y: e.clientY,
            },
            prevSize: size,
            onResize: prev.onResize
        };
    })} onMouseUp={e => setResize({
        isResizing: false
    })}>
        <div className={"formula-bar"}>
            <input
                type={"text"}
                className={"selection-indicator"}
                value={selected.selected.toSorted((i, j) => i.area > j.area ? -1 : 1).map(i => i.toString()).join(", ")}
                disabled={true}
                // onChange={e => setState(prev => Object.assign(prev, {manualSelection: e.target.value}))}
            />

            <textarea
                ref={references.formula}
                onChange={function (e) {
                    if (selected.cell)
                        data.setRawValueAt(selected.cell!, e.target.value);
                }}
                value={selected.cell ? data.rawValueAt(selected.cell!) : ''}
                disabled={!selected.cell}
                autoFocus={true}
                className={"formula"}/>
        </div>
        <div
            ref={references.tbody}
            className={"table-container"}
            style={{
                gridAutoColumns: `min-content ${data.columnWidths.map(i => `${i ?? DEFAULT_COLUMN_WIDTH}px`).join(' ')} min-content`,
                gridAutoRows: `min-content ${data.rowHeights.map(i => `${i ?? DEFAULT_ROW_HEIGHT}px`).join(' ')}`,
            }}>

            <div className={"top-left-corner"}/>

            {data.columnNames.map((column, col) =>
                <div className={"table-header-cell"}
                     key={`table-header-${col}`}
                     style={{
                         gridColumn: col + 2,
                         gridRow: 1
                     }}>
                    <div className={"column-title"}>
                        {column} {data.frontMatter?.columnTypes?.[col] ?
                        <div className={"nav-file-tag"}>{data.frontMatter?.columnTypes?.[col]}</div> : null}
                    </div>
                    <span className={"resize-handle"} onMouseDown={e => setResize({
                        isResizing: true,
                        prevMouse: {
                            x: e.clientX,
                            y: e.clientY
                        },
                        prevSize: {width: data.columnWidths[col] ?? DEFAULT_COLUMN_WIDTH, height: e.currentTarget.innerHeight},
                        onResize: size => data.columnWidths[col] = Math.max(size.width, MIN_COLUMN_WIDTH)
                    })}/>
                </div>)}

            {data.data.map((_, row) => <div
                key={`row-title-${row}`}
                className={"row"}
                style={{
                    gridColumn: 1,
                    gridRow: row + 2
                }}>
                <div className={"row-title"}>{row}</div>
                <span
                    className={"resize-handle horizontal"}
                    onMouseDown={e => setResize({
                        isResizing: true,
                        prevMouse: {
                            x: e.clientX,
                            y: e.clientY
                        },
                        prevSize: {height: data.rowHeights[row] ?? DEFAULT_COLUMN_WIDTH, width: e.currentTarget.innerWidth},
                        onResize: size => data.rowHeights[row] = Math.max(size.height, MIN_ROW_HEIGHT)
                    })}/>
            </div>)}

            {data.data.map((cells, row) => cells.map((_, col) => <div
                key={`table-cell-${new Cell(row, col).toString()}`}
                className={["table-cell", selected.cell?.eq(new Cell(row, col)) ? "editing" : ""].join(' ')}
                style={{
                    gridRow: row + 2,
                    gridColumn: col + 2
                }}
                ref={getCell(new Cell(row, col))}
                onMouseDown={_ => setSelected(prev => ({
                    selected: prev.selected,
                    dragStart: new Cell(row, col),
                    hoverCell: new Cell(row, col),
                    cell: null
                }))}
                onMouseMove={_ => setSelected(prev => ({
                    ...prev,
                    hoverCell: new Cell(row, col)
                }))}
                onMouseUp={e => finishSelection(e, new Cell(row, col), {
                    state: selected,
                    setState: setSelected
                })}>
                <DataVisualiser data={data.valueAt(new Cell(row, col))}/>
            </div>))}

            <Selection
                ranges={selected.selected}
                current={selected.dragStart && selected.hoverCell ? new Range(selected.dragStart, selected.hoverCell) : null}
                tableBodyRef={references.tbody}
                getRef={cell => getCell(cell)?.current?.getBoundingClientRect()!}/>
        </div>
    </div>
}

export function Selection(props: {
    ranges: Range[],
    tableBodyRef: React.RefObject<HTMLDivElement>,
    getRef: (cell: Cell) => DOMRect,
    current: Range | null
}) {
    return <>
        {props.ranges.map((range, a) => {
            return <div
                key={`selection-${a}`}
                className={"selection-range"}
                style={{
                    gridRow: `${range.topLeft.row + 2} / ${range.bottomRight.row + 3}`,
                    gridColumn: `${range.topLeft.col + 2} / ${range.bottomRight.col + 3}`,
                }}/>;
        })}

        {props.current && <div
            key={`selection-in-progress`}
            className={"selection-range in-progress"}
            style={{
                gridRow: `${props.current.topLeft.row + 2} / ${props.current.bottomRight.row + 3}`,
                gridColumn: `${props.current.topLeft.col + 2} / ${props.current.bottomRight.col + 3}`,
            }}/>}
    </>;
}

export function finishSelection(e: React.MouseEvent, cell: Cell, selection: State<SelectionState>) {
    const range = new Range(selection.state.dragStart ?? cell, cell);

    let newSelection: Range[] = [];

    if (e.shiftKey)
        if (range.area == 1)
            selection.setState(prev => ({
                ...prev,
                dragStart: null,
                selected: newSelection = [...prev.selected.slice(0, -1), prev.selected[prev.selected.length - 1].union(range)],
                cell: getActiveCell(newSelection)
            }))
        else
            selection.setState(prev => ({
                ...prev,
                dragStart: null,
                selected: newSelection = prev.selected.find(i => i.eq(range)) ? prev.selected.filter(i => !i.eq(range)) : [...prev.selected, range],
                cell: getActiveCell(newSelection)
            }));
    else if (e.ctrlKey)
        selection.setState(prev => ({
            ...prev,
            dragStart: null,
            selected: newSelection = prev.selected.find(i => i.eq(range)) ? prev.selected.filter(i => !i.eq(range)) : [...prev.selected, range],
            cell: getActiveCell(newSelection)
        }));
    else
        selection.setState(prev => ({
            ...prev,
            dragStart: null,
            selected: newSelection = [range],
            cell: getActiveCell(newSelection)
        }));

    // TODO: Simplify Selection by merging adjacent selections
}

export function getActiveCell(selected: Range[]): Cell | null {
    if (selected.reduce((a, j) => a + j.area, 0) > 0)
        return selected[0].topLeft;
    else return null
}
