import * as expr from 'expression';
import * as obs from "obsidian";
import {DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT} from "./components/table.js";
import {Selection} from "./selection.js";
import globals, * as all from './globals.js';

export const MAX_UNDO_HISTORY = 128; // 128 diff frames
export const UNDO_DEBOUNCE_TIMEOUT = 2000; // 2000ms

export interface FrontMatter extends Record<string, any> {
	columnTypes?: string[],
	explicitTypes?: { [cell in string]: string },
	constrainToDefinedColumns?: boolean,

	columnWidths?: number[],
	rowHeights?: number[],

	labelledCells?: Record<string, StringifiedCell>,

	columnTitles?: string[],
	allowedTypes?: string[],
	columnSeparator?: string,
	urlEscaped?: boolean
}

type StringifiedCell = string;

export type Change = {
	value: Value,
	old: string, // Technically, we could omit this value, but doing so would result in undo/redoing being O(n) rather than O(1)
	new: string
};
export type Snapshot = {
	timestamp: Date,
	diff: Change[]
};

export type CellDependencyContext = {
	dependent_address: Selection.Cell,
	dependent: Value,
	dependencies: Value[]
};

export class Value {
	private watches: ((raw: string) => void)[] = [];
	private onChangeOnceHandlers: ((raw: string) => void)[] = [];
	private prev: { raw: string, value: string };

	constructor(private raw: string, private sheet: CSVDocument) {
		this.prev = {
			raw, value: null as any
		};
	}

	document(): CSVDocument {
		return this.sheet;
	}

	isComputedValue(): boolean {
		return this.raw.startsWith("=");
	}

	onChange(callback: (raw: string) => void): () => void {
		this.watches.push(callback);
		return () => this.watches.includes(callback) ? void this.watches.splice(this.watches.indexOf(callback), 1) : void 0
	}

	onChangeOnce(callback: (raw: string) => void): Value {
		this.onChangeOnceHandlers.push(callback);
		return this;
	}

	getComputedValue(addr: Selection.Cell): string | { err: string } {
		if (!this.prev.value || this.prev.raw != this.raw)
			try {
				return Object.assign(this.prev, {
					raw: this.raw,
					value: this.isComputedValue() ? `${this.sheet.cx.evaluateStr(this.raw.slice(1), Selection.stringify(addr))}` : this.raw
				}).value;
			} catch (err) {
				console.error(err);
				return { err: err ? err.toString() : 'Unknown Error' };
			}

		return this.prev.value;
	}

	getRaw(): string {
		return this.raw;
	}

	recompute(addr: Selection.Cell): void {
		this.prev.value = this.isComputedValue() ? `${this.sheet.cx.evaluateStr(this.raw.slice(1), Selection.stringify(addr))}` : this.raw;
	}

	setRaw(data: string, noUpdateHistory: boolean = false): void {
		if (data !== this.raw) {
			const change: Change = {
				value: this,
				new: data,
				old: this.raw
			};

			if (!noUpdateHistory)
				this.sheet.pushChange(change);

			for (const watch of this.watches)
				watch(this.raw);
		}

		this.raw = data;

		this.onChangeOnceHandlers.splice(0, this.onChangeOnceHandlers.length)
			.forEach(i => i(this.raw));
	}
}

// export function value(raw: string, sheet: CSVDocument): Value {
// 	return new Value(raw, sheet);
// }

export interface DocumentProperties {
	frontMatter: FrontMatter;

	separator: string;
	uriEncoding: boolean;

	columnTitles: string[];

	columnTypes: string[];

	columnWidths: number[];
	rowHeights: number[];
}

export default class CSVDocument {
	raw: Value[][] = [[]];

	cx: expr.Context & { dependencyContext: { [cx in StringifiedCell]: CellDependencyContext } };
	undoStack: Snapshot[] = [];
	redoStack: Snapshot[] = [];

	#props: DocumentProperties = {
		frontMatter: {},

		columnTitles: [],

		columnTypes: [],

		columnWidths: [],
		rowHeights: [],

		separator: ";",
		uriEncoding: false
	};

	change: Date = new Date();

	public readonly onExternalChange: (watcher: () => void) => (() => void);
	private readonly notifyChange: (() => void);

	constructor() {
		this.cx = Object.assign(new expr.Context(new expr.DataSource({
			query: (cx: StringifiedCell, query: string) => {
				const dependent = Selection.parse(cx) ?? { row: 0, col: 0 };
				return this.query(query, this.cx.dependencyContext[cx] ??= {
					dependent_address: dependent,
					dependent: this.getValueAt(dependent, true)!,
					dependencies: []
				} satisfies CellDependencyContext);
			},
		})), {
			dependencyContext: {}
		});

		this.cx.pushGlobal("num", (input: string) => Number(input));

		for (const [a, i] of [...Object.entries(globals), ...Object.entries(all)])
			this.cx.pushGlobal(a, typeof i == 'function' ? i.bind(this) : i);

		const watchers: (() => void)[] = [];

		const onExternalChange = (watcher: () => void) => {
			watchers.push(watcher);
			return () => watchers.remove(watcher);
		};

		this.onExternalChange = watcher => onExternalChange(watcher);
		this.notifyChange = () => watchers.forEach(i => i());
	}

	/// Inform the CSV Engine of a data change. Used for undo/redo chains
	public pushChange(change: Change) {
		this.redoStack.length = 0;

		const last = this.undoStack.at(-1);

		if (last && (new Date().getTime() - (last?.timestamp?.getTime() ?? 0) < UNDO_DEBOUNCE_TIMEOUT)) {
			if (this.undoStack.length > MAX_UNDO_HISTORY)
				this.undoStack.shift();

			const latestChange = last.diff.find(i => i.value == change.value);
			if (latestChange)
				latestChange.new = change.new;
			else
				last?.diff.push(change);
		} else
			this.undoStack.push({
				timestamp: new Date(),
				diff: [change]
			});
	}

	public undo() {
		const changes = this.undoStack.pop();

		if (!changes) return;

		for (const value of changes.diff)
			(value.value.setRaw as (data: string, noUpdateHistory?: boolean) => void)(value.old, true);

		this.redoStack.push(changes);
	}

	public redo() {
		const changes = this.redoStack.pop();

		if (!changes) return;

		for (const value of changes.diff)
			(value.value.setRaw as (data: string, noUpdateHistory?: boolean) => void)(value.new, true);

		this.undoStack.push(changes);
	}

	public get documentProperties(): DocumentProperties {
		return this.#props;
	}

	public columnType(col: number): string {
		// if (this.#props.columnTypes[col] in renderers)
		//     return this.#props.columnTypes[col] as any;

		return 'raw';
	}

	public updateDocumentProperties(update: (prev: DocumentProperties) => Partial<DocumentProperties>) {
		this.#props = Object.freeze({
			...this.#props,
			...update(this.#props)
		});

		this.change = new Date();

		this.notifyChange();
	}

	private parseFrontMatter(frontMatter: string): number {
		this.updateDocumentProperties(prev => ({
			frontMatter: obs.parseYaml(frontMatter)
		}));

		return frontMatter.length;
	}

	getRaw(): string {
		const rows = [];

		if (!this.documentProperties.frontMatter.columnTitles)
			rows.push(this.documentProperties.columnTitles.map(i => this.documentProperties.uriEncoding ? encodeURIComponent(i) : i));

		for (const row of this.raw)
			rows.push(row
				.map(i => i.getRaw())
				.map(value => this.documentProperties.uriEncoding ? encodeURIComponent(value) : value));

		return rows
			.map(i => i.join(this.documentProperties.separator))
			.join("\n");
	}

	setRaw(data: string, clear: boolean): void {
		if (clear)
			this.clear();

		const frontMatterMarker = data.indexOf("---\n");

		if (frontMatterMarker > -1) {
			const end = data.indexOf("---\n", frontMatterMarker + 3);
			this.parseFrontMatter(data.slice(frontMatterMarker + 3, end).trim());
			data = data.slice(end + 3).trim();
		}

		const separator = this.documentProperties.separator ?? /[,;\t]/g;
		const rows = data.trim().split(/\r?\n/);

		if (!this.documentProperties.frontMatter?.columnTitles)
			this.updateDocumentProperties(prev => ({
				columnTitles: rows.shift()?.split(separator).map(i => this.documentProperties.uriEncoding ? decodeURIComponent(i) : i) ?? []
			}));

		const prevRaw = [...this.raw];
		const prevProps = {...this.documentProperties};
		this.raw = [];

		for (const [cells, row] of rows.map((i, row) => [i.split(separator), row] as const)) {
			this.raw.push(new Array(this.documentProperties.columnTitles.length).fill("").map(cell => new Value(cell, this)));

			for (const [raw, col] of cells.map((i, col) => [i, col] as const)) {
				const prev = prevRaw[row]?.[col];

				if (prev) {
					this.raw[row][col] = prev;
					if (prev.getRaw() != raw)
						prev.setRaw(raw);
				} else
					this.raw[row][col] = new Value(raw, this);
			}
		}

		this.updateDocumentProperties(prev => ({
			...prevProps,

			columnTypes: new Array(this.documentProperties.columnTitles.length).fill("raw"),
			columnWidths: new Array(this.documentProperties.columnTitles.length).fill(DEFAULT_COLUMN_WIDTH),
			rowHeights: new Array(this.raw.length).fill(DEFAULT_ROW_HEIGHT)
		}));
	}

	getValueAt(cell: Selection.Cell, create = false): Value | null {
		if (create) {
			for (let col = this.documentProperties.columnTitles.length; col <= cell.col; col++)
				this.insertCol();

			for (let row = this.raw.length; row <= cell.row; row++)
				this.insertRow();
		}

		return this.raw?.[cell.row]?.[cell.col] ?? null;

	}

	editFormat(col: number, format: string) {
		this.updateDocumentProperties(prev => ({
			columnTypes: prev.columnTypes.with(col, format)
		}));
	}

	insertCol(col?: number) {
		if (col) {
			// Warning: I see a potential for bugs here.
			for (const row of this.raw)
				row.splice(col + 1, 0, new Value("", this));

			this.change = new Date();

			this.updateDocumentProperties(prev => ({
				columnTitles: [...prev.columnTitles.slice(0, col + 1), `Column ${col + 2}`, ...prev.columnTitles.slice(col + 1)],
				columnTypes: [...prev.columnTypes.slice(0, col + 1), 'raw', ...prev.columnTypes.slice(col + 1)],
				columnWidths: [...prev.columnWidths.slice(0, col + 1), DEFAULT_COLUMN_WIDTH, ...prev.columnWidths.slice(col + 1)],
			}));
		} else {
			for (const row of this.raw)
				row.push(new Value("", this));

			this.change = new Date();

			this.updateDocumentProperties(prev => ({
				columnTitles: [...prev.columnTitles, `Column ${prev.columnTitles.length + 2}`],
				columnTypes: [...prev.columnTypes, 'raw'],
				columnWidths: [...prev.columnWidths, DEFAULT_COLUMN_WIDTH],
			}));
		}
	}

	insertRow(row?: number) {
		if (row) {
			// Warning: I see a potential for bugs here.
			this.raw.splice(row + 1, 0, new Array(this.#props.columnTypes.length).fill("").map(cell => new Value(cell, this)));
			this.change = new Date();

			this.updateDocumentProperties(prev => ({
				rowHeights: [...prev.rowHeights.slice(0, row + 1), DEFAULT_ROW_HEIGHT, ...prev.rowHeights.slice(row + 1)],
			}));
		} else {
			this.raw.push(new Array(this.#props.columnTypes.length).fill("").map(cell => new Value(cell, this)));
			this.change = new Date();

			this.updateDocumentProperties(prev => ({
				rowHeights: [...prev.rowHeights, DEFAULT_ROW_HEIGHT],
			}));
		}
	}

	removeCol(col: number) {
		for (const row of this.raw)
			row.splice(col, 1);

		this.change = new Date();
		this.updateDocumentProperties(prev => ({
			columnWidths: [...prev.columnWidths.slice(0, col), ...prev.columnWidths.slice(col + 1)],
			columnTitles: [...prev.columnTitles.slice(0, col), ...prev.columnTitles.slice(col + 1)],
			columnTypes: [...prev.columnTypes.slice(0, col), ...prev.columnTypes.slice(col + 1)]
		}));
	}

	removeRow(row: number) {
		this.raw.splice(row, 1);
		this.change = new Date();
		this.updateDocumentProperties(prev => ({
			rowHeights: [...prev.rowHeights.slice(0, row), ...prev.rowHeights.slice(row + 1)]
		}));
	}

	clear(): void {
		this.raw = [[]];
	}

	/**
	 * Parses an address into a Cell reference.
	 *
	 * ## Valid formats
	 * 1. Column reference: `:Column`
	 * 2. Cell reference: `ColLetter+RowNumber` e.g `A5`
	 * 3. Cell reference with file `file:Cell` e.g `file.csv:A5` !not implemented
	 *
	 * @param query
	 * @param cx Stored Expression data
	 */
	query(query: string, cx: CellDependencyContext): any {
		if (query.includes(":")) {
			if (!query.startsWith(":"))
				throw "Not Implemented";

			return this.getValueAt({
				row: cx.dependent_address.row,
				col: this.documentProperties.columnTitles.indexOf(query.slice(1))
			}, false)
				?.onChangeOnce(raw => typeof cx.dependent.recompute == 'function' && cx.dependent.recompute?.(cx.dependent_address))
				?.getComputedValue(cx.dependent_address);
		} else {
			const cell = Selection.parse((this.documentProperties.frontMatter.labelledCells ?? {})[query] ?? query);

			if (!cell) return null;

			return this.getValueAt(cell, false)
				?.onChangeOnce(raw => typeof cx.dependent.recompute == 'function' && cx.dependent.recompute?.(cx.dependent_address))
				?.getComputedValue(cx.dependent_address);
		}
	}
}