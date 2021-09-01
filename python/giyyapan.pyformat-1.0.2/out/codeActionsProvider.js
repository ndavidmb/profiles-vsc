"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const Path = require("path");
const vscode = require("vscode");
const consts_1 = require("./consts");
const editHelper_1 = require("./helpers/editHelper");
const envHelper_1 = require("./helpers/envHelper");
const fsHelper_1 = require("./helpers/fsHelper");
class CodeActionProvider {
    provideCodeActions(document, range, _context, _token) {
        const config = vscode.workspace.getConfiguration(consts_1.IDENTIFIER, document.uri);
        if (!config.enableImportOrganization) {
            return [];
        }
        const codeAction = new vscode.CodeAction('PyFormat: Sort imports', vscode.CodeActionKind.SourceOrganizeImports.append('pyformat'));
        codeAction.command = {
            title: 'PyFormat: Sort imports',
            command: 'pyformat.sortImports'
        };
        return [codeAction];
    }
    sortImports(document) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('pyformat: sort imports');
            // await new Promise((resolve) => { setTimeout(() => { resolve() }, 50) })
            const config = vscode.workspace.getConfiguration(consts_1.IDENTIFIER, document.uri);
            const { isortArgs = [] } = config;
            // console.log({ isortArgs })
            const tmpFile = document.isDirty ? yield fsHelper_1.createTemporaryFile(Path.extname(document.uri.fsPath)) : undefined;
            if (tmpFile) {
                // add a '\n' to the end of the document to avoid isort's bug
                yield fsHelper_1.writeFile(tmpFile.filePath, document.getText() + '\n');
            }
            const args = ['--diff', ...isortArgs, tmpFile ? tmpFile.filePath : document.uri.fsPath];
            const stdout = yield new Promise((resolve, reject) => {
                const command = `${envHelper_1.getModuleExecutable('isort', document.uri)} ${args.join(' ')}`;
                // console.log({ command })
                child_process_1.exec(command, (err, stdout, stderr) => {
                    // console.log('isort exec complete', { command, err, stdout, stderr })
                    if (err) {
                        reject(err || stderr);
                        let msg = 'Format with "isort" failed.';
                        if (envHelper_1.isModuleNotFoundError(err)) {
                            msg += '\nPlease install "isort" in your python environment';
                        }
                        vscode.window.showErrorMessage(msg);
                        return;
                    }
                    resolve(stdout);
                });
            });
            const workspaceEdit = editHelper_1.getWorkspaceEditFromPatch(document.getText(), stdout, document.uri);
            yield vscode.workspace.applyEdit(workspaceEdit);
            if (tmpFile) {
                yield fsHelper_1.removeFile(tmpFile.filePath);
                tmpFile.dispose();
            }
        });
    }
}
exports.CodeActionProvider = CodeActionProvider;
//# sourceMappingURL=codeActionsProvider.js.map