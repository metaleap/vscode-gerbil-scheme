import * as vsc from 'vscode'
import * as lsp from './lsp'
import * as repl from './repl'
import * as node_path from 'node:path'
import * as node_fs from 'node:fs'
import * as node_exec from 'child_process'


let lspClient: lsp.Client | null = null
let statusBarItemBuildOnSave: vsc.StatusBarItem
let regDisp: (...items: { dispose(): any }[]) => number

export function activate(ctx: vsc.ExtensionContext) {
	// register "repl", aka vscode custom notebook type
	regDisp = ctx.subscriptions.push.bind(ctx.subscriptions)
	regDisp(vsc.workspace.registerNotebookSerializer("gerbil-repl", new repl.NotebookSerializer()))
	regDisp(new repl.Kernel())

	// bring up LSP client unless disabled in user config
	lspClient = lsp.init(ctx)
	if (lspClient)
		regDisp(lspClient)

	// set up build-on-save
	regDisp(statusBarItemBuildOnSave =
		vsc.window.createStatusBarItem("gerbil-build-on-save", vsc.StatusBarAlignment.Left))
	statusBarItemBuildOnSave.text = "$(coffee)"
	statusBarItemBuildOnSave.tooltip = "Gerbil build-on-save running..."
	regDisp(vsc.workspace.onDidSaveTextDocument(tryBuildOnSave))

	// set up Eval code actions
	vsc.languages.registerCodeActionsProvider({ scheme: 'file', language: 'gerbil' }, {
		provideCodeActions: codeActions,
	})
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
		{ command: "gerbil-cmd-eval-quick", title: "Quick-Eval", arguments: [it, range] },
		{ command: "gerbil-cmd-eval-repl", title: "Eval in REPL...", arguments: [it, range] },
	]
}


function tryBuildOnSave(justSaved: vsc.TextDocument) {
	const cfg = vsc.workspace.getConfiguration()
	const build_on_save = cfg.get<boolean>("gerbil.buildOnSave", false)
	if (!build_on_save)
		return

	let dir_path = node_path.dirname(justSaved.fileName)
	let pkg_file_path = node_path.join(dir_path, "gerbil.pkg")
	while ((dir_path !== "/") && !node_fs.existsSync(pkg_file_path)) {
		dir_path = node_path.dirname(dir_path)
		pkg_file_path = node_path.join(dir_path, "gerbil.pkg")
	}
	if (!node_fs.existsSync(pkg_file_path))
		return

	statusBarItemBuildOnSave.show()
	setTimeout(() => { // needed for the status-item to actually show, annoyingly
		try {
			node_exec.execFileSync("gerbil", ["build"], { cwd: dir_path, })
		} catch (err) {
			const term = vsc.window.createTerminal({ cwd: dir_path, name: "gerbil build" })
			regDisp(term)
			term.show(true)
			term.sendText("gerbil build", true)
		} finally {
			statusBarItemBuildOnSave.hide()
		}
	}, 1)
}
