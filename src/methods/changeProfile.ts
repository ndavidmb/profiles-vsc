import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";
import * as service from "../api.service";

export const changeProfile = async () => {
  const profiles = await service.getProfiles();
  const profileChoose = await vscode.window.showQuickPick(profiles, {
    matchOnDetail: true,
  });

  if (!profileChoose) {
    return;
  }

  const profileSettings = await service.getProfileSettings(profileChoose);
  const globalSettings = await service.getGlobalSettings();

  Object.keys(profileSettings).forEach((prop) => {
    globalSettings[prop] = profileSettings[prop];
  });

  console.log(globalSettings["workbench.colorTheme"]);
  console.log(profileSettings);
  replaceProfileSettings(globalSettings);
};

const replaceProfileSettings = async (settings: any) => {
  const home = os.homedir();
  console.log(home);

  fs.writeFile(
    `${home}/.config/Code/User/settings.json`,
    JSON.stringify(settings, null, 2),
    "utf8",
    function (err) {
      if (err) {
        throw err;
      }

      vscode.window.showInformationMessage('Everything have been updated correctly');
    }
  );
};
