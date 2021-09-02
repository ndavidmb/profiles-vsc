import axios from "axios";

export const getProfiles = async () => {
  const {
    data: { profiles },
  } = await axios.get<{ profiles: string[] }>(
    "https://raw.githubusercontent.com/ndavidmb/profiles-vsc/main/profiles.json"
  );
  return profiles;
};

export const getProfileSettings = async (profile: string) => {
  const { data } = await axios.get(
    `https://raw.githubusercontent.com/ndavidmb/profiles-vsc/main/${profile}.settings.json`
  );
  return data;
};

export const getGlobalSettings = async () => {
  const { data } = await axios.get(
    "https://raw.githubusercontent.com/ndavidmb/profiles-vsc/main/settings.json"
  );
  return data;
};
