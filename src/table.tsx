import React, {useEffect} from 'react';

import DataSource from "./data.js";
import Range, {Cell} from "./range.js";

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
};
export type DimensionState = { columns: number[], rows: number[] };

export default function Table({data}: TableProps) {

    const [selected, setSelected] = React.useState<SelectionState>({
        selected: [],
        dragStart: null,
        cell: null,
    });
    const [dimensions, setDimensions] = React.useState<DimensionState>({
        columns: [],
        rows: []
    });

    const [references, setReferences] = React.useState({
        tbody: React.createRef<HTMLTableSectionElement>(),
        thead: React.createRef<HTMLTableSectionElement>(),
        formula: React.createRef<HTMLTextAreaElement>(),

        cells: []
    });

    const getCell = (cell: Cell) => {
        const addr = cell.row * data.columnNames.length + cell.col;

        if (!references.cells[addr]) {
            const ref = React.createRef<HTMLTableCellElement>();
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

    useEffect(() => {
        references.formula.current?.focus();
        references.formula.current?.select();
    }, [selected.cell]);

    data.onExternalChange(() => setSelected(prev => ({
        ...prev,
        dragStart: null,
        // selected: [],
        // cell: null
    })));

    return <div className={"table-widget"}>
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
                        data.setValueAt(selected.cell!, e.target.value);
                }}
                value={selected.cell ? data.valueAt(selected.cell!) : ''}
                disabled={!selected.cell}
                autoFocus={true}
                className={"formula"}/>
        </div>
        <table id={"table-widget"}>
            <thead ref={references.thead}>
            <tr>{data.columnNames.map((column, col) => <td
                key={`table-header-${col}`}
                style={{width: dimensions.columns[col] ?? 'auto'}}>{column}</td>)}</tr>
            </thead>
            <tbody ref={references.tbody}>
            {data.data.map((cells, row) => <tr
                data-row-number={row}
                key={`table-row-${row}`}>
                {cells.map((cell, col) => <td
                    className={selected.cell?.eq(new Cell(row, col)) ? "editing" : ""}
                    key={`table-cell-${new Cell(row, col).toString()}`}
                    ref={getCell(new Cell(row, col))}

                    onMouseDown={_ => setSelected(prev => ({
                        selected: prev.selected,
                        dragStart: new Cell(row, col),
                        cell: null
                    }))}
                    onMouseUp={e => finishSelection(e, new Cell(row, col), {
                        state: selected,
                        setState: setSelected
                    })}
                    data-address={new Cell(row, col).toString()}
                >{data.valueAt(cell)}</td>)}
            </tr>)}
            <Selection
                ranges={selected.selected}
                tableBodyRef={references.tbody}
                getRef={cell => getCell(cell)?.current?.getBoundingClientRect()!}/>
            </tbody>
        </table>
    </div>
}

export function Selection(props: {
    ranges: Range[],
    tableBodyRef: React.RefObject<HTMLTableSectionElement>,
    getRef: (cell: Cell) => DOMRect
}) {
    return <div className={"selection"}>
        {props.ranges.map((range, a) => {
            const tbody = props.tableBodyRef.current?.getBoundingClientRect()!;

            const min = props.getRef(range.topLeft);
            const max = props.getRef(range.bottomRight);

            return <div
                key={`selection-${a}`}
                className={"selection-range"}
                style={{
                    top: min.top - tbody.top,
                    left: min.left - tbody.left,
                    width: max.right - min.left,
                    height: max.bottom - min.top,
                }}/>;
        })}
    </div>
}

export function finishSelection(e: React.MouseEvent, cell: Cell, selection: State<SelectionState>) {
    const range = new Range(selection.state.dragStart ?? cell, cell);

    let newSelection: Range[] = [];

    if (e.shiftKey)
        if (range.area == 1)
            selection.setState(prev => ({
                dragStart: null,
                selected: newSelection = [...prev.selected.slice(0, -1), prev.selected[prev.selected.length - 1].union(range)],
                cell: getActiveCell(newSelection)
            }))
        else
            selection.setState(prev => ({
                dragStart: null,
                selected: newSelection = prev.selected.find(i => i.eq(range)) ? prev.selected.filter(i => !i.eq(range)) : [...prev.selected, range],
                cell: getActiveCell(newSelection)
            }));
    else if (e.ctrlKey)
        selection.setState(prev => ({
            dragStart: null,
            selected: newSelection = prev.selected.find(i => i.eq(range)) ? prev.selected.filter(i => !i.eq(range)) : [...prev.selected, range],
            cell: getActiveCell(newSelection)
        }));
    else
        selection.setState({
            dragStart: null,
            selected: newSelection = [range],
            cell: getActiveCell(newSelection)
        });

    // TODO: Simplify Selection by merging adjacent selections
}

export function getActiveCell(selected: Range[]): Cell | null {
    if (selected.reduce((a, j) => a + j.area, 0) > 0)
        return selected[0].topLeft;
    else return null
}
