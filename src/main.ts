import * as vsc from 'vscode'
import * as lsp from './lsp'
import * as repl from './repl'
import * as node_path from 'node:path'
import * as node_fs from 'node:fs'
import * as node_exec from 'child_process'


let lspClient: lsp.Client | null = null
let statusBarItemBuildOnSave: vsc.StatusBarItem
let regDisp: (...items: { dispose(): any }[]) => number
let lastEvalExpr: string = ""

export function activate(ctx: vsc.ExtensionContext) {
	// register "repl", aka vscode custom notebook type
	regDisp = ctx.subscriptions.push.bind(ctx.subscriptions)
	regDisp(vsc.workspace.registerNotebookSerializer('gerbil-repl', new repl.NotebookSerializer()))
	regDisp(new repl.Kernel())

	// bring up LSP client unless disabled in user config
	lspClient = lsp.init(ctx)
	if (lspClient)
		regDisp(lspClient)

	// set up build-on-save
	regDisp(statusBarItemBuildOnSave =
		vsc.window.createStatusBarItem('gerbil-build-on-save', vsc.StatusBarAlignment.Left))
	statusBarItemBuildOnSave.text = "$(coffee)"
	statusBarItemBuildOnSave.tooltip = "Gerbil build-on-save running..."
	regDisp(vsc.workspace.onDidSaveTextDocument(tryBuildOnSave))

	// set up Eval code actions
	if (lspClient) {
		regDisp(vsc.commands.registerCommand('gerbil.cmd.eval.quick', cmdEvalQuick))
		regDisp(vsc.commands.registerCommand('gerbil.cmd.eval.repl', cmdReplFromExpr))
		vsc.languages.registerCodeActionsProvider({ scheme: 'file', language: 'gerbil' }, {
			provideCodeActions: codeActions,
		})
	}
}

export function deactivate() {
	if (lspClient)
		return lspClient.stop()

	return (void 0)
}


function codeActions(it: vsc.TextDocument, range: vsc.Range, _ctx: vsc.CodeActionContext, _: vsc.CancellationToken): vsc.Command[] {
	if (range.isEmpty)
		return []
	return [
		{ command: 'gerbil.cmd.eval.quick', title: "Quick-Eval", arguments: [it, range] },
		{ command: 'gerbil.cmd.eval.repl', title: "New REPL from expression...", arguments: [it, range] },
	]
}


function cmdEvalQuick(...args: any[]) {
	if (args && args.length) {
		args[0] = (args[0] as vsc.TextDocument).fileName
		lspClient!.sendRequest('workspace/executeCommand',
			{ command: 'eval-in-file', arguments: args } as lsp.ExecuteCommandParams
		).then(
			(result) =>
				vsc.window.showInformationMessage("" + result),
			vsc.window.showErrorMessage,
		).catch(
			vsc.window.showErrorMessage)

	} else {
		let expr_suggestion: string = lastEvalExpr
		if (vsc.window.activeTextEditor && vsc.window.activeTextEditor.document && vsc.window.activeTextEditor.selection && !vsc.window.activeTextEditor.selection.isEmpty)
			expr_suggestion = vsc.window.activeTextEditor.document.getText(vsc.window.activeTextEditor.selection)
		vsc.window.showInputBox({
			title: "Gerbil Quick-Eval", value: expr_suggestion, placeHolder: "Enter a Gerbil Scheme expression",
			prompt: ("Enter a Gerbil Scheme expression to quick-eval" +
				((vsc.window.activeTextEditor && vsc.window.activeTextEditor.document && !vsc.window.activeTextEditor.document.isUntitled)
					? ` in the context of ${vsc.window.activeTextEditor!.document.fileName}`
					: "")),
		})
			.then(expr_to_eval => {
				if (expr_to_eval && expr_to_eval.length && (expr_to_eval = expr_to_eval.trim()).length)
					lspClient!.sendRequest('workspace/executeCommand', {
						command: 'eval-expr', arguments: [
							(vsc.window.activeTextEditor!.document.isUntitled ? '' : vsc.window.activeTextEditor!.document.fileName),
							lastEvalExpr = expr_to_eval,
						]
					}).then(
						(result) =>
							vsc.window.showInformationMessage("" + result),
						vsc.window.showErrorMessage,
					).catch(
						vsc.window.showErrorMessage)
			})
	}
}


async function cmdReplFromExpr(...args: any[]) {
	let src_file: vsc.TextDocument | null = null
	if (args && args.length)
		src_file = args[0] as vsc.TextDocument
	else if (vsc.window.activeTextEditor)
		src_file = vsc.window.activeTextEditor.document
	if (!src_file)
		return

	let range: vsc.Range | null = null
	if (args && args.length && (args.length > 1))
		range = args[1] as vsc.Range
	else if (vsc.window.activeTextEditor && vsc.window.activeTextEditor.selection && !vsc.window.activeTextEditor.selection.isEmpty)
		range = vsc.window.activeTextEditor.selection
	if (!range)
		return

	await vsc.window.showNotebookDocument(await vsc.workspace.openNotebookDocument('gerbil-repl', {
		cells: [{
			languageId: 'gerbil',
			kind: vsc.NotebookCellKind.Code,
			value: src_file.getText(range),
		}],
	}))
}


function tryBuildOnSave(justSaved: vsc.TextDocument) {
	const cfg = vsc.workspace.getConfiguration()
	const build_on_save = cfg.get<boolean>('gerbil.buildOnSave', false)
	if (!build_on_save)
		return

	let dir_path = node_path.dirname(justSaved.fileName)
	let pkg_file_path = node_path.join(dir_path, 'gerbil.pkg')
	while ((dir_path !== '/') && !node_fs.existsSync(pkg_file_path)) {
		dir_path = node_path.dirname(dir_path)
		pkg_file_path = node_path.join(dir_path, 'gerbil.pkg')
	}
	if (!node_fs.existsSync(pkg_file_path))
		return

	statusBarItemBuildOnSave.show()
	setTimeout(() => { // needed for the status-item to actually show, annoyingly
		try {
			node_exec.execFileSync('gerbil', ['build'], { cwd: dir_path, })
		} catch (err) {
			const term = vsc.window.createTerminal({ cwd: dir_path, name: 'gerbil build' })
			regDisp(term)
			term.show(true)
			term.sendText('gerbil build', true)
		} finally {
			statusBarItemBuildOnSave.hide()
		}
	}, 1)
}
