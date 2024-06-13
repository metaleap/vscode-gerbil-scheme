import * as vsc from 'vscode';

import * as lsp from './lsp'


let lsp_client: lsp.Client;


export function activate(ctx: vsc.ExtensionContext) {
	lsp_client = lsp.init(ctx)

	ctx.subscriptions.push(...[
		lsp_client,
		// other, future disposables go here...
	])

}

export function deactivate() {
	if (lsp_client)
		return lsp_client.stop()

	return void 0
}
