import * as vsc from 'vscode'
import * as lsp from './lsp'


let lsp_client: lsp.Client | null = null


export function activate(ctx: vsc.ExtensionContext) {
	lsp_client = lsp.init(ctx)

	if (lsp_client)
		ctx.subscriptions.push(lsp_client)
}

export function deactivate() {
	if (lsp_client)
		return lsp_client.stop()

	return void 0
}
