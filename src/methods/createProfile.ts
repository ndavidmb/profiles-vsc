import * as fs from "fs";
import simpleGit from "simple-git";
import * as vscode from "vscode";

const git = simpleGit();

export const createProfile = () => {
  vscode.window
    .showInputBox({ placeHolder: "Nombre del perfil" })
    .then((res) => {
      try {
        git.addRemote("origin", "https://github.com/ndavidmb/profiles-vsc.git");
        fs.writeFile(
          `./src/temporal/${res}.settings.json`,
          "",
          "utf8",
          function (err) {
            if (err) {
              throw err;
            }
            console.log('file wrote');
          }
        );
      } catch (e) {
        console.error("error en git", e);
      }
    });
};
