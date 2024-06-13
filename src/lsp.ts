import * as vsc from 'vscode';


import * as lsp from 'vscode-languageclient/node';


export type Client = lsp.LanguageClient



export function init(ctx: vsc.ExtensionContext): lsp.LanguageClient {
    const client = new lsp.LanguageClient(
        'lsp_gerbil', 'Gerbil LSP',

        {
            command: "gxlsp",
        } as lsp.ServerOptions,

        {
            documentSelector: [{ language: 'gerbil', scheme: 'file' }],
            synchronize: { fileEvents: vsc.workspace.createFileSystemWatcher('**/*.ss') },
        } as lsp.LanguageClientOptions

    )
    client.start()
    return client
}
