"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diff_match_patch_1 = require("diff-match-patch");
const os_1 = require("os");
const vscode_1 = require("vscode");
// Code borrowed from goFormat.ts (Go Extension for VS Code)
var EditAction;
(function (EditAction) {
    EditAction[EditAction["Delete"] = 0] = "Delete";
    EditAction[EditAction["Insert"] = 1] = "Insert";
    EditAction[EditAction["Replace"] = 2] = "Replace";
})(EditAction || (EditAction = {}));
class Patch {
}
const NEW_LINE_LENGTH = os_1.EOL.length;
class Edit {
    constructor(action, start) {
        this.action = action;
        this.start = start;
        this.text = '';
    }
    apply() {
        switch (this.action) {
            case EditAction.Insert:
                return vscode_1.TextEdit.insert(this.start, this.text);
            case EditAction.Delete:
                return vscode_1.TextEdit.delete(new vscode_1.Range(this.start, this.end));
            case EditAction.Replace:
                return vscode_1.TextEdit.replace(new vscode_1.Range(this.start, this.end), this.text);
            default:
                return new vscode_1.TextEdit(new vscode_1.Range(new vscode_1.Position(0, 0), new vscode_1.Position(0, 0)), '');
        }
    }
}
function getTextEditsFromPatch(before, patch) {
    if (patch.startsWith('---')) {
        // Strip the first two lines
        patch = patch.substring(patch.indexOf('@@'));
    }
    if (patch.length === 0) {
        return [];
    }
    // Remove the text added by unified_diff
    // # Work around missing newline (http://bugs.python.org/issue2142).
    patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');
    // tslint:disable-next-line:no-require-imports
    const dmp = require('diff-match-patch');
    const d = new dmp.diff_match_patch();
    const patches = patchFromText.call(d, patch);
    if (!Array.isArray(patches) || patches.length === 0) {
        throw new Error('Unable to parse Patch string');
    }
    const textEdits = [];
    // Add line feeds and build the text edits
    patches.forEach(p => {
        p.diffs.forEach(diff => {
            diff[1] += os_1.EOL;
        });
        getTextEditsInternal(before, p.diffs, p.start1).forEach(edit => textEdits.push(edit.apply()));
    });
    return textEdits;
}
exports.getTextEditsFromPatch = getTextEditsFromPatch;
function getWorkspaceEditFromPatch(originalContents, patch, uri) {
    const workspaceEdit = new vscode_1.WorkspaceEdit();
    if (patch.startsWith('---')) {
        // Strip the first two lines
        patch = patch.substring(patch.indexOf('@@'));
    }
    if (patch.length === 0) {
        return workspaceEdit;
    }
    // Remove the text added by unified_diff
    // # Work around missing newline (http://bugs.python.org/issue2142).
    patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');
    // tslint:disable-next-line:no-require-imports
    const dmp = require('diff-match-patch');
    const d = new dmp.diff_match_patch();
    const patches = patchFromText.call(d, patch);
    if (!Array.isArray(patches) || patches.length === 0) {
        throw new Error('Unable to parse Patch string');
    }
    // Add line feeds and build the text edits
    patches.forEach(p => {
        p.diffs.forEach(diff => {
            diff[1] += os_1.EOL;
        });
        getTextEditsInternal(originalContents, p.diffs, p.start1).forEach(edit => {
            switch (edit.action) {
                case EditAction.Delete:
                    workspaceEdit.delete(uri, new vscode_1.Range(edit.start, edit.end));
                    break;
                case EditAction.Insert:
                    workspaceEdit.insert(uri, edit.start, edit.text);
                    break;
                case EditAction.Replace:
                    workspaceEdit.replace(uri, new vscode_1.Range(edit.start, edit.end), edit.text);
                    break;
                default:
                    break;
            }
        });
    });
    return workspaceEdit;
}
exports.getWorkspaceEditFromPatch = getWorkspaceEditFromPatch;
/**
* Parse a textual representation of patches and return a list of Patch objects.
* @param {string} textline Text representation of patches.
* @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
* @throws {!Error} If invalid input.
*/
function patchFromText(textline) {
    const patches = [];
    if (!textline) {
        return patches;
    }
    // Start Modification by Don Jayamanne 24/06/2016 Support for CRLF
    const text = textline.split(/[\r\n]/);
    // End Modification
    let textPointer = 0;
    const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/;
    while (textPointer < text.length) {
        const m = text[textPointer].match(patchHeader);
        if (!m) {
            throw new Error(`Invalid patch string: ${text[textPointer]}`);
        }
        // tslint:disable-next-line:no-any
        const patch = new diff_match_patch_1.diff_match_patch.patch_obj();
        patches.push(patch);
        patch.start1 = parseInt(m[1], 10);
        if (m[2] === '') {
            patch.start1 -= 1;
            patch.length1 = 1;
        }
        else if (m[2] === '0') {
            patch.length1 = 0;
        }
        else {
            patch.start1 -= 1;
            patch.length1 = parseInt(m[2], 10);
        }
        patch.start2 = parseInt(m[3], 10);
        if (m[4] === '') {
            patch.start2 -= 1;
            patch.length2 = 1;
        }
        else if (m[4] === '0') {
            patch.length2 = 0;
        }
        else {
            patch.start2 -= 1;
            patch.length2 = parseInt(m[4], 10);
        }
        textPointer += 1;
        // tslint:disable-next-line:no-require-imports
        const dmp = require('diff-match-patch');
        while (textPointer < text.length) {
            const sign = text[textPointer].charAt(0);
            let line;
            try {
                //var line = decodeURI(text[textPointer].substring(1));
                // For some reason the patch generated by python files don't encode any characters
                // And this patch module (code from Google) is expecting the text to be encoded!!
                // Temporary solution, disable decoding
                // Issue #188
                line = text[textPointer].substring(1);
            }
            catch (ex) {
                // Malformed URI sequence.
                throw new Error('Illegal escape in patch_fromText');
            }
            if (sign === '-') {
                // Deletion.
                patch.diffs.push([dmp.DIFF_DELETE, line]);
            }
            else if (sign === '+') {
                // Insertion.
                patch.diffs.push([dmp.DIFF_INSERT, line]);
            }
            else if (sign === ' ') {
                // Minor equality.
                patch.diffs.push([dmp.DIFF_EQUAL, line]);
            }
            else if (sign === '@') {
                // Start of next patch.
                break;
            }
            else if (sign === '') {
                // Blank line?  Whatever.
            }
            else {
                // WTF?
                throw new Error(`Invalid patch mode '${sign}' in: ${line}`);
            }
            textPointer += 1;
        }
    }
    return patches;
}
function getTextEditsInternal(before, diffs, startLine = 0) {
    let line = startLine;
    let character = 0;
    if (line > 0) {
        const beforeLines = before.split(/\r?\n/g);
        beforeLines.filter((_l, i) => i < line).forEach(l => character += l.length + NEW_LINE_LENGTH);
    }
    const edits = [];
    let edit = null;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < diffs.length; i += 1) {
        const start = new vscode_1.Position(line, character);
        // Compute the line/character after the diff is applied.
        // tslint:disable-next-line:prefer-for-of
        for (let curr = 0; curr < diffs[i][1].length; curr += 1) {
            if (diffs[i][1][curr] !== '\n') {
                character += 1;
            }
            else {
                character = 0;
                line += 1;
            }
        }
        // tslint:disable-next-line:no-require-imports
        const dmp = require('diff-match-patch');
        // tslint:disable-next-line:switch-default
        switch (diffs[i][0]) {
            case dmp.DIFF_DELETE:
                if (edit === null) {
                    edit = new Edit(EditAction.Delete, start);
                }
                else if (edit.action !== EditAction.Delete) {
                    throw new Error('cannot format due to an internal error.');
                }
                edit.end = new vscode_1.Position(line, character);
                break;
            case dmp.DIFF_INSERT:
                if (edit === null) {
                    edit = new Edit(EditAction.Insert, start);
                }
                else if (edit.action === EditAction.Delete) {
                    edit.action = EditAction.Replace;
                }
                // insert and replace edits are all relative to the original state
                // of the document, so inserts should reset the current line/character
                // position to the start.
                line = start.line;
                character = start.character;
                edit.text += diffs[i][1];
                break;
            case dmp.DIFF_EQUAL:
                if (edit !== null) {
                    edits.push(edit);
                    edit = null;
                }
                break;
        }
    }
    if (edit !== null) {
        edits.push(edit);
    }
    return edits;
}
//# sourceMappingURL=editHelper.js.map