# Spreadsheet

A spreadsheet plugin for Obsidian. Create, edit and manage spreadsheets using a specialised CSV format.

## Features

- [x] Display / Edit CSV files
- [x] Bulk-edit Values
- [ ] Table operations
- [x] Front-matter support
- [x] Formulas
- [ ] Mathematical, financial and statistics functions
- [ ] Unit conversion
- [ ] Global Search integration

## Formula Language

The formula language allows you to calculate things like a traditional spreadsheet by interpreting
cell-values beginning with `=` as a formula.

The syntax is simple, yet extensible through [[#extensions|extensions]], featuring

* **arithmetic operators**: `+` `-` `*` `/` `%` `^`
* **logical operators**: `>` `<` `==` `!=` `&&` `||` `!`
* **functions**: `min(1,2,3)`
* **lists and maps**: `[1,2,3]` and `[a=1,b=2,c=3]`
* **objects**: `([a=1,b=2,c=3]).b==3`

> **Note on extensibility:** The formula language is designed to be extensible. You can define your own operators,
> constants, functions, and integrations with the host system.
>
> The formula language provides no functionality of its own. The list of standard operators is defined client-side.

## Extensions

### Implementing functions

You can add your own functions which you can use in a formula in the settings. 