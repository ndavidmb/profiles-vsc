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
// Copied some codes from https://github.com/Microsoft/vscode
const child_process_1 = require("child_process");
const Path = require("path");
const vscode = require("vscode");
const consts_1 = require("./consts");
const editHelper_1 = require("./helpers/editHelper");
const envHelper_1 = require("./helpers/envHelper");
const fsHelper_1 = require("./helpers/fsHelper");
class FormattingEditProvider {
    constructor(_context) {
        this.disposables = [];
        // Workaround for https://github.com/Microsoft/vscode/issues/41194
        this.documentVersionBeforeFormatting = -1;
        this.formatterMadeChanges = false;
        this.saving = false;
        this.disposables.push(vscode.workspace.onDidSaveTextDocument((document) => __awaiter(this, void 0, void 0, function* () { return this.onSaveDocument(document); })));
    }
    provideDocumentFormattingEdits(document, options, token) {
        return this.provideDocumentRangeFormattingEdits(document, undefined, options, token);
    }
    provideDocumentRangeFormattingEdits(document, range, options, token) {
        return __awaiter(this, void 0, void 0, function* () {
            // Workaround for https://github.com/Microsoft/vscode/issues/41194
            // VSC rejects 'format on save' promise in 750 ms. Python formatting may take quite a bit longer.
            // Workaround is to resolve promise to nothing here, then execute format document and force new save.
            // However, we need to know if this is 'format document' or formatting on save.
            if (this.saving) {
                // We are saving after formatting (see onSaveDocument below)
                // so we do not want to format again.
                return [];
            }
            // console.log('document uri', document.uri)
            // Remember content before formatting so we can detect if
            // formatting edits have been really applied
            const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
            if (editorConfig.get('formatOnSave') === true) {
                this.documentVersionBeforeFormatting = document.version;
            }
            const config = vscode.workspace.getConfiguration(consts_1.IDENTIFIER, document.uri);
            const { formatProvider, blackArgs, autopep8Args = [] } = config;
            if (formatProvider === 'black') {
                return yield this.formatWithBlack(document, range, blackArgs);
            }
            else {
                return yield this.formatWithAutoPep8(document, range, autopep8Args);
            }
        });
    }
    formatWithBlack(document, range, blackArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('pyformat: format with black');
            // black and have the ability to read from the process input stream and return the formatted code out of the output stream.
            // However they don't support returning the diff of the formatted text when reading data from the input stream.
            // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
            // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
            const tmpFile = document.isDirty ? yield fsHelper_1.createTemporaryFile(Path.extname(document.uri.fsPath)) : undefined;
            if (tmpFile) {
                yield fsHelper_1.writeFile(tmpFile.filePath, document.getText());
            }
            const args = ['--diff', '--quiet', ...blackArgs, tmpFile ? tmpFile.filePath : document.uri.fsPath];
            if (range && !range.isEmpty) {
                // NOTE: black does not support range formatting
                vscode.window.showErrorMessage('Format in range is not supported by black.');
                return [];
            }
            const stdout = yield new Promise((resolve, reject) => {
                const command = `${envHelper_1.getModuleExecutable('black', document.uri)} ${args.join(' ')}`;
                // console.log({ command })
                child_process_1.exec(command, (err, stdout, stderr) => {
                    // console.log('autopep8 exec complete', { command, err, stdout, stderr })
                    if (err) {
                        reject(err || stderr);
                        let msg = 'Format with "black" failed.';
                        if (envHelper_1.isModuleNotFoundError(err)) {
                            msg += '\nPlease install "black" in your python environment';
                        }
                        vscode.window.showErrorMessage(msg);
                        resolve(null);
                        return;
                    }
                    resolve(stdout);
                });
            });
            if (stdout === null) {
                return [];
            }
            const edits = editHelper_1.getTextEditsFromPatch(document.getText(), stdout);
            // console.log({ edits })
            this.formatterMadeChanges = edits.length > 0;
            if (tmpFile) {
                yield fsHelper_1.removeFile(tmpFile.filePath);
                tmpFile.dispose();
            }
            return edits;
        });
    }
    formatWithAutoPep8(document, range, autopep8Args) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('pyformat: format with autopep8');
            // autopep8 and have the ability to read from the process input stream and return the formatted code out of the output stream.
            // However they don't support returning the diff of the formatted text when reading data from the input stream.
            // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
            // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
            const tmpFile = document.isDirty ? yield fsHelper_1.createTemporaryFile(Path.extname(document.uri.fsPath)) : undefined;
            if (tmpFile) {
                yield fsHelper_1.writeFile(tmpFile.filePath, document.getText());
            }
            const args = ['--diff', ...autopep8Args, tmpFile ? tmpFile.filePath : document.uri.fsPath];
            if (range && !range.isEmpty) {
                args.push(...['--line-range', (range.start.line + 1).toString(), (range.end.line + 1).toString()]);
            }
            const stdout = yield new Promise((resolve, reject) => {
                const command = `${envHelper_1.getModuleExecutable('autopep8', document.uri)} ${args.join(' ')}`;
                // console.log({ command })
                child_process_1.exec(command, (err, stdout, stderr) => {
                    // console.log('autopep8 exec complete', { command, err, stdout, stderr })
                    if (err) {
                        reject(err || stderr);
                        let msg = 'Format with "autopep8" failed.';
                        if (envHelper_1.isModuleNotFoundError(err)) {
                            msg += '\nPlease install "autopep8" in your python environment';
                        }
                        vscode.window.showErrorMessage(msg);
                        resolve(null);
                        return;
                    }
                    resolve(stdout);
                });
            });
            if (stdout === null) {
                return [];
            }
            const edits = editHelper_1.getTextEditsFromPatch(document.getText(), stdout);
            // console.log({ edits })
            this.formatterMadeChanges = edits.length > 0;
            if (tmpFile) {
                yield fsHelper_1.removeFile(tmpFile.filePath);
                tmpFile.dispose();
            }
            return edits;
        });
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    onSaveDocument(document) {
        return __awaiter(this, void 0, void 0, function* () {
            // Promise was rejected = formatting took too long.
            // Don't format inside the event handler, do it on timeout
            setTimeout(() => {
                try {
                    if (this.formatterMadeChanges
                        && !document.isDirty
                        && document.version === this.documentVersionBeforeFormatting) {
                        // Formatter changes were not actually applied due to the timeout on save.
                        // Force formatting now and then save the document.
                        vscode.commands.executeCommand('editor.action.formatDocument').then(() => __awaiter(this, void 0, void 0, function* () {
                            this.saving = true;
                            yield document.save();
                            this.saving = false;
                        }));
                    }
                }
                finally {
                    this.documentVersionBeforeFormatting = -1;
                    this.saving = false;
                    this.formatterMadeChanges = false;
                }
            }, 50);
        });
    }
}
exports.FormattingEditProvider = FormattingEditProvider;
//# sourceMappingURL=formatProvider.js.map