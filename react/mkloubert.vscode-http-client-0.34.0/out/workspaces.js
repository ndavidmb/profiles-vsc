"use strict";
/**
 * This file is part of the vscode-http-client distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 *
 * vscode-http-client is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * vscode-http-client is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const FSExtra = require("fs-extra");
const Path = require("path");
const vschc = require("./extension");
const vschc_requests = require("./requests");
const vscode = require("vscode");
const vscode_helpers = require("vscode-helpers");
/**
 * A workspace (handler).
 */
class Workspace extends vscode_helpers.WorkspaceBase {
    constructor() {
        super(...arguments);
        this._isReloadingConfig = false;
        /**
         * Execute 'openRequestsOnStartup()' method when reloading config or not.
         */
        this.executeOpenRequestsOnStartup = false;
    }
    /**
     * Gets the current configuration.
     */
    get config() {
        return this._config;
    }
    /**
     * @inheritdoc
     */
    get configSource() {
        return this._configSrc;
    }
    /**
     * Tries to return aa full path of an existing element.
     *
     * @param {string} p The path of the element.
     *
     * @return {string|false} The full path or (false) if not found.
     */
    getExistingPath(p) {
        let pathToReturn = vscode_helpers.toStringSafe(p);
        if (!Path.isAbsolute(p)) {
            pathToReturn = false;
            const ROOT_DIRS = [
                Path.join(this.rootPath),
                vschc.getUsersExtensionDir(),
            ];
            for (const DIR of ROOT_DIRS) {
                const PATH_TO_CHECK = Path.join(DIR, p);
                if (FSExtra.existsSync(PATH_TO_CHECK)) {
                    pathToReturn = PATH_TO_CHECK;
                    break;
                }
            }
        }
        else {
            if (!FSExtra.existsSync(pathToReturn)) {
                pathToReturn = false;
            }
        }
        if (false !== pathToReturn) {
            pathToReturn = Path.resolve(pathToReturn);
        }
        return pathToReturn;
    }
    /**
     * Initializes that workspace object.
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            this._configSrc = {
                section: 'http.client',
                resource: vscode.Uri.file(Path.join(this.rootPath, '.vscode/settings.json')),
            };
            yield this.onDidChangeConfiguration();
        });
    }
    /**
     * Checks if a path is inside that workspace or not.
     *
     * @param {string} p The path to check.
     *
     * @return {boolean} Is path of or not.
     */
    isPathOf(p) {
        p = vscode_helpers.toStringSafe(p);
        if (!Path.isAbsolute(p)) {
            return true;
        }
        const FOLDER_URI = vscode.Uri.file(Path.resolve(this.folder.uri.fsPath));
        const URI = vscode.Uri.file(Path.resolve(p));
        return URI.fsPath === FOLDER_URI.fsPath ||
            URI.fsPath.startsWith(FOLDER_URI.fsPath + Path.sep);
    }
    /**
     * @inheritdoc
     */
    onDidChangeConfiguration() {
        return __awaiter(this, arguments, void 0, function* () {
            const ME = this;
            const MY_ARGS = arguments;
            if (ME._isReloadingConfig) {
                vscode_helpers.invokeAfter(() => __awaiter(this, void 0, void 0, function* () {
                    yield ME.onDidChangeConfiguration
                        .apply(ME, MY_ARGS);
                }), 1000);
                return;
            }
            ME._isReloadingConfig = true;
            try {
                let loadedCfg = vscode.workspace.getConfiguration(ME.configSource.section, ME.configSource.resource) || {};
                ME._config = loadedCfg;
                if (ME.executeOpenRequestsOnStartup) {
                    yield ME.openRequestsOnStartup();
                }
            }
            finally {
                ME._isReloadingConfig = false;
            }
        });
    }
    /**
     * Opens all requests that should be opened on startup.
     */
    openRequestsOnStartup() {
        return __awaiter(this, void 0, void 0, function* () {
            const CFG = this.config;
            if (!CFG) {
                return;
            }
            if (vscode_helpers.toBooleanSafe(CFG.openNewOnStartup)) {
                yield vschc_requests.startNewRequest();
            }
            if (vscode_helpers.toBooleanSafe(CFG.open)) {
                const OPEN = vscode_helpers.asArray(CFG.open);
                for (const O of OPEN) {
                    let entry;
                    if (!_.isObject(O)) {
                        entry = {
                            file: vscode_helpers.toStringSafe(O),
                        };
                    }
                    else {
                        entry = O;
                    }
                    if (vscode_helpers.isEmptyString(entry.file)) {
                        continue;
                    }
                    const IMPORT_FILE = this.getExistingPath(entry.file);
                    if (false !== IMPORT_FILE) {
                        const DATA = yield FSExtra.readFile(IMPORT_FILE, 'utf8');
                        const REQUEST = JSON.parse(DATA);
                        yield vschc_requests.startNewRequest({
                            data: REQUEST,
                        });
                    }
                }
            }
        });
    }
}
exports.Workspace = Workspace;
//# sourceMappingURL=workspaces.js.map