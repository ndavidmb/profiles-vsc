import * as vscode from "vscode";
import { changeProfile } from "./methods/changeProfile";
import { createProfile } from "./methods/createProfile";

export function activate(context: vscode.ExtensionContext) {
  const change = vscode.commands.registerCommand(
    "change-profile.changeProfile",
    changeProfile
  );
  const create = vscode.commands.registerCommand(
    "change-profile.createProfile",
    createProfile
  );

  context.subscriptions.push(change);
  context.subscriptions.push(create);
}

// this method is called when your extension is deactivated
export function deactivate() {}
