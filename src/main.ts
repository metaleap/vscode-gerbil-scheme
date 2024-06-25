import * as vsc from 'vscode'
import * as lsp from './lsp'
import * as repl from './repl'


let lsp_client: lsp.Client | null = null


export function activate(ctx: vsc.ExtensionContext) {
	ctx.subscriptions.push(vsc.workspace.registerNotebookSerializer("gerbil-repl", new repl.NotebookSerializer()))
	ctx.subscriptions.push(new repl.Kernel())

	lsp_client = lsp.init(ctx)

	if (lsp_client)
		ctx.subscriptions.push(lsp_client)
}

export function deactivate() {
	if (lsp_client)
		return lsp_client.stop()

	return (void 0)
}
