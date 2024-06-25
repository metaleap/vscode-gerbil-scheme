import * as vsc from 'vscode'


// TODO: Gerbil-LSP-specific code here


// below, the VSC plumbin' boilerplate

export class Kernel {
    private readonly self: vsc.NotebookController
    private exec_order = 0

    constructor() {
        this.self = vsc.notebooks.createNotebookController("nbctl-gerbil-repl", "gerbil-repl", "Gerbil REPL")
        this.self.supportsExecutionOrder = true
        this.self.supportedLanguages = ["gerbil"]
        this.self.executeHandler = this.exec.bind(this)
    }

    dispose() {
        this.self.dispose()
    }

    private exec(cells: vsc.NotebookCell[], notebook: vsc.NotebookDocument, _ctl: vsc.NotebookController) {
        for (const cell of cells)
            if (cell.kind === vsc.NotebookCellKind.Code) {
                const exec = this.self.createNotebookCellExecution(cell)
                exec.executionOrder = ++this.exec_order
                exec.start(Date.now())
                const src = cell.document.getText().trim()
                // TODO: actual REPL / eval call here
                exec.replaceOutput(new vsc.NotebookCellOutput([
                    vsc.NotebookCellOutputItem.text(src, "text/x-clojure")
                ]))
                exec.end(true, Date.now())
            }
        notebook.save()
    }
}

// serialization: we don't just JSON-(un)marshal the vsc.NotebookData directly because that would store
// unwanted ephemeral stuff (recent outputs and execution stats), plus we want to cleanly ctor it on load

interface NotebookCell {
    source: string
    cell_type: vsc.NotebookCellKind
}

export class NotebookSerializer implements vsc.NotebookSerializer {
    async serializeNotebook(data: vsc.NotebookData, _: vsc.CancellationToken): Promise<Uint8Array> {
        const cells: NotebookCell[] = []
        for (const cell of data.cells)
            cells.push({ source: cell.value, cell_type: cell.kind })
        return new TextEncoder().encode(JSON.stringify(cells))
    }

    async deserializeNotebook(content: Uint8Array, _: vsc.CancellationToken): Promise<vsc.NotebookData> {
        const cells = (<NotebookCell[]>JSON.parse(new TextDecoder().decode(content)))
        return new vsc.NotebookData(cells.map(item =>
            new vsc.NotebookCellData(item.cell_type, item.source,
                ((item.cell_type === vsc.NotebookCellKind.Code) ? 'gerbil' : 'markdown'))
        ))
    }
}
