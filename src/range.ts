export default class Range {
    public constructor(public from: Cell, public to: Cell) {
    }

    // static fromVector(vector: Vector, end: Cell): Range {
    //     // TODO: Implement
    // }

    public eq(b: Range): boolean {
        return this.from.eq(b.from) && this.to.eq(b.to);
    }

    public get width(): number {
        return Math.max(this.from.col, this.to.col) - Math.min(this.from.col, this.to.col) + 1;
    }

    public get height(): number {
        return Math.max(this.from.row, this.to.row) - Math.min(this.from.row, this.to.row) + 1;
    }

    public get area(): number {
        return this.width * this.height;
    }

    public get topLeft(): Cell {
        return new Cell(Math.min(this.from.row, this.to.row), Math.min(this.from.col, this.to.col));
    }

    public get topRight(): Cell {
        return new Cell(Math.max(this.from.row, this.to.row), Math.min(this.from.col, this.to.col));
    }

    public get bottomLeft(): Cell {
        return new Cell(Math.min(this.from.row, this.to.row), Math.max(this.from.col, this.to.col));
    }

    public get bottomRight(): Cell {
        return new Cell(Math.max(this.from.row, this.to.row), Math.max(this.from.col, this.to.col));
    }

    public union(range: Range): Range {
        const topLeft1 = this.topLeft;
        const topLeft2 = range.topLeft;

        const bottomRight1 = this.bottomRight;
        const bottomRight2 = range.bottomRight;

        return new Range(
            new Cell(Math.min(topLeft1.row, topLeft2.row), Math.min(topLeft1.col, topLeft2.col)),
            new Cell(Math.max(bottomRight1.row, bottomRight2.row), Math.max(bottomRight1.col, bottomRight2.col)),
        );
    }

    public toString(): string {
        if (this.area == 1)
            return this.topLeft.toString();
        else
            return `${this.topLeft.toString()}:${this.bottomRight.toString()}`;
    }

    public normalise(maxRows: number, maxCols: number): Range {
        this.from = new Cell(this.from.row >= 0 ? this.from.row : (maxRows - 2) - this.from.row, this.from.col >= 0 ? this.from.col : (maxCols - 2) - this.from.col);
        this.to = new Cell(this.to.row >= 0 ? this.to.row : (maxRows - 2) - this.to.row, this.to.col >= 0 ? this.to.col : (maxCols - 2) - this.to.col);

        return this;
    }
}

export class Cell {
    public constructor(public row: number, public col: number) {
    }

    public eq(b: Cell): boolean {
        return this.col == b.col && this.row == b.row;
    }

    public toString(): string {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const alphabet2 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        return `${[...this.col.toString(26).toUpperCase()].map(i => alphabet[alphabet2.indexOf(i)])}${this.row + 1}`;
    }

    public moveVertically(amount: number = 1): Cell {
        this.row = this.row + amount;
        return this;
    }

    public moveHorizontally(amount: number = 1): Cell {
        this.col = this.col + amount;
        return this;
    }
}