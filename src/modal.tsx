import * as obs from 'obsidian';

export default class TextPrompt extends obs.Modal {
    constructor(app: obs.App) {
        super(app);
    }

    onOpen() {

    }

    onClose() {
        this.contentEl.empty();
    }
}