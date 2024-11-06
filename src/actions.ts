import SpreadsheetView from "./spreadsheet.js";
import { icons } from 'lucide-react';

export type Tool = {
    description: string;
    label: string;
    icon: keyof typeof icons
} & (Button | ViewportOptions);
export type Button = {
    type: 'button',
    onClick: (sheet: SpreadsheetView) => void,
};
export type ViewportOptions = {
    type: 'viewport',
}

export const tools = {
    'copy': {
        type: 'button',
        label: 'Copy',
        description: 'Copy Selected Cells',
        icon: 'Copy',
        onClick: sheet => void 0
    },
    'cut': {
        type: 'button',
        label: 'Cut',
        description: 'Cut Selected Cells',
        icon: 'Scissors',
        onClick: sheet => void 0
    },
    'paste': {
        type: 'button',
        label: 'Paste',
        description: 'Paste Selected Cells',
        icon: 'Clipboard',
        onClick: sheet => void 0
    },
    'sort': {
        type: 'button',
        label: 'Sorting',
        description: 'Set Sorting Method',
        icon: 'ArrowDownNarrowWide',
        onClick: sheet => void 0
    },
    'filter': {
        type: 'button',
        label: 'Filter',
        description: 'Filter viewport',
        icon: 'Filter',
        onClick: sheet => void 0
    },
    'group': {
        type: 'button',
        label: 'Group',
        description: 'Set grouping options',
        icon: 'Group',
        onClick: sheet => void 0
    },
    'viewOptions': {
        type: 'viewport',
        label: "Viewport Options",
        description: "Unified viewport options (Sorting, Filter, Grouping, Columns)",
        icon: 'View'
    }
} satisfies { [ToolName in string]: Tool };

export default tools