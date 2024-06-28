import * as vsc from 'vscode'
import * as lsp from './lsp'
import * as repl from './repl'
import * as node_path from 'node:path'
import * as node_fs from 'node:fs'
import * as node_exec from 'child_process'


let lspClient: lsp.Client | null = null
let statusBarItemBuildOnSave: vsc.StatusBarItem


export function activate(ctx: vsc.ExtensionContext) {
	// register "repl", aka vscode custom notebook type
	ctx.subscriptions.push(vsc.workspace.registerNotebookSerializer("gerbil-repl", new repl.NotebookSerializer()))
	ctx.subscriptions.push(new repl.Kernel())

	// bring up LSP client unless disabled in user config
	lspClient = lsp.init(ctx)
	if (lspClient)
		ctx.subscriptions.push(lspClient)

	// set up build-on-save
	ctx.subscriptions.push(vsc.workspace.onDidSaveTextDocument(tryBuildOnSave))
	ctx.subscriptions.push(statusBarItemBuildOnSave =
		vsc.window.createStatusBarItem("gerbil-build-on-save", vsc.StatusBarAlignment.Left))
	statusBarItemBuildOnSave.text = "$(coffee)"
	statusBarItemBuildOnSave.tooltip = "Gerbil build-on-save running..."
}

export function deactivate() {
	if (lspClient)
		return lspClient.stop()

	return (void 0)
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
			const buf = node_exec.execFileSync("gerbil", ["build"], { cwd: dir_path, })
		} catch (err) {
			vsc.window.showErrorMessage("Build-on-Save failed: " + err)
		} finally {
			statusBarItemBuildOnSave.hide()
		}
	}, 1)
}
