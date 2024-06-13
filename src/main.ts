import * as vsc from 'vscode';

import * as lsp from './lsp'



export function activate(context: vsc.ExtensionContext) {
	context.subscriptions.push(...[

		vsc.languages.registerHoverProvider('gerbil', {
			provideHover: lsp.textDocument_hover,
		}),

	]);
}

export function deactivate() { }
