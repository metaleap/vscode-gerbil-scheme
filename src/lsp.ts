import * as vsc from 'vscode';


export function textDocument_hover(td: vsc.TextDocument, pos: vsc.Position, cancel: vsc.CancellationToken): vsc.ProviderResult<vsc.Hover> {
    return {
        contents: ['Hover Content']
    }
}
