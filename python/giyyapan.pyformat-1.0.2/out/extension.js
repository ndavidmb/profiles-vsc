"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const codeActionsProvider_1 = require("./codeActionsProvider");
const consts_1 = require("./consts");
const formatProvider_1 = require("./formatProvider");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // console.log(`"${IDENTIFIER}" is now active`)
    const formatProvider = new formatProvider_1.FormattingEditProvider(context);
    const codeActionProvider = new codeActionsProvider_1.CodeActionProvider();
    context.subscriptions.push(vscode.commands.registerCommand(`${consts_1.IDENTIFIER}.sortImports`, () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== consts_1.PYTHON_LANGUAGE) {
            return vscode.window.showErrorMessage('Please open a Python file to sort the imports.');
        }
        return codeActionProvider.sortImports(activeEditor.document);
    }));
    vscode.languages.registerDocumentFormattingEditProvider(consts_1.PYTHON, formatProvider);
    vscode.languages.registerDocumentRangeFormattingEditProvider(consts_1.PYTHON, formatProvider);
    vscode.languages.registerCodeActionsProvider(consts_1.PYTHON, codeActionProvider);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map