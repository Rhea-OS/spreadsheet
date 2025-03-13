import * as expr from 'expression';
import * as obs from "obsidian";
import {DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT} from "./components/table.js";
import {Selection} from "./selection.js";

export const MAX_UNDO_HISTORY = 128; // 128 diff frames
export const UNDO_DEBOUNCE_TIMEOUT = 2000; // 2000ms

export interface FrontMatter extends Record<string, any> {
	columnTypes?: string[],
	explicitTypes?: { [cell in string]: string },
	constrainToDefinedColumns?: boolean,

	columnWidths?: number[],
	rowHeights?: number[],

	columnTitles?: string[],
	allowedTypes?: string[],
	columnSeparator?: string,
	urlEscaped?: boolean
}

export interface Value {
	isComputedValue: () => boolean,

	setRaw(raw: string): void,

	getRaw(): string,

	onChange: (callback: (raw: string) => void) => () => void,

	document: () => CSVDocument,

	getComputedValue(context: any): string | { err: string };
}

export type Change = {
	value: Value,
	old: string, // Technically, we could omit this value, but doing so would result in undo/redoing being O(n) rather than O(1)
	new: string
};
export type Snapshot = {
	timestamp: Date,
	diff: Change[]
};

export function value(raw: string, sheet: CSVDocument): Value {
	const watches: ((raw: string) => void)[] = [];

	const isComputedValue = () => raw.startsWith("=")

	let value: Value;
	return value = {
		document: () => sheet,

		isComputedValue: () => isComputedValue(),
		setRaw: (data, noUpdateHistory = false) => {
			if (data == raw)
				return;

			const change: Change = {
				value,
				new: data,
				old: raw
			};

			raw = data;

			if (!noUpdateHistory)
				sheet.pushChange(change);

			for (const watch of watches)
				watch(raw);
		},
		getRaw: () => raw,
		onChange: callback => {
			watches.push(callback);
			return () => watches.includes(callback) ? void watches.splice(watches.indexOf(callback), 1) : void 0
		},

		getComputedValue(context: any): string | { err: string } {
			if (isComputedValue())
				try {
					return `${sheet.cx.evaluate(raw.slice(1), context)}`;
				} catch (err) {
					console.error(err)
					if (err)
						return {err: err.toString()};
					else
						return {err: 'Unknown Error'};
				}
			else
				return raw;
		}
	};
}

const andThen = <T, R>(cb: (x: T) => R, x?: T): R | null => x ? cb(x) : null;

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

	cx: expr.Context;
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
		this.cx = new expr.Context(new expr.DataSource({
			query: (cx: { addr: Selection.Cell }, query: string) => this.query(query, cx)
		}));

		this.cx.pushGlobal("num", (input: string) => Number(input));

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
			this.raw.push(new Array(this.documentProperties.columnTitles.length).fill("").map(cell => value(cell, this)));

			for (const [raw, col] of cells.map((i, col) => [i, col] as const)) {
				const prev = prevRaw[row]?.[col];

				if (prev) {
					this.raw[row][col] = prev;
					if (prev.getRaw() != raw)
						prev.setRaw(raw);
				} else
					this.raw[row][col] = value(raw, this);
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
				row.splice(col + 1, 0, value("", this));

			this.change = new Date();

			this.updateDocumentProperties(prev => ({
				columnTitles: [...prev.columnTitles.slice(0, col + 1), `Column ${col + 2}`, ...prev.columnTitles.slice(col + 1)],
				columnTypes: [...prev.columnTypes.slice(0, col + 1), 'raw', ...prev.columnTypes.slice(col + 1)],
				columnWidths: [...prev.columnWidths.slice(0, col + 1), DEFAULT_COLUMN_WIDTH, ...prev.columnWidths.slice(col + 1)],
			}));
		} else {
			for (const row of this.raw)
				row.push(value("", this));

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
			this.raw.splice(row + 1, 0, new Array(this.#props.columnTypes.length).fill("").map(cell => value(cell, this)));
			this.change = new Date();

			this.updateDocumentProperties(prev => ({
				rowHeights: [...prev.rowHeights.slice(0, row + 1), DEFAULT_ROW_HEIGHT, ...prev.rowHeights.slice(row + 1)],
			}));
		} else {
			this.raw.push(new Array(this.#props.columnTypes.length).fill("").map(cell => value(cell, this)));
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
	 * 3. Cell reference with file `file:Cell` e.g `file.csv:A5`
	 *
	 * @param query
	 * @param cx Stored Expression data
	 */
	query(query: string, cx: { addr: Selection.Cell }): any {
		console.log(`Query: ${query}`);

		if (query.includes(":"))
			if (query.startsWith(":"))
				if (!this.documentProperties.columnTitles.includes(query.slice(1)))
					return null;
				else
					return this.getValueAt({
						row: cx.addr.row,
						col: this.documentProperties.columnTitles.indexOf(query.slice(1))
					}, false)
						?.getComputedValue(cx);

			else
				throw "Not Implemented";

		else {
			const match = query.match(/^[a-zA-Z]+\d+$/);

			if (!match)
				return null;

			const column = [...match[1].toLowerCase()]
				.map(i => i.charCodeAt(0) - "a".charCodeAt(0))
				.reduce((a, i) => a * 26 + i, 0);

			return this.getValueAt({ row: Number(match[2]), col: column }, false)
				?.getComputedValue(cx);
		}
	}
}