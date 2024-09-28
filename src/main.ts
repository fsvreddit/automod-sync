// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit } from "@devvit/public-api";
import { synchroniseAutomodMenuHandler, updateSharedRulesJob } from "./automoderator.js";
import { handleModAction } from "./modActionHandler.js";
import { appSettings, saveSettingsToWiki } from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addMenuItem({
    location: "subreddit",
    label: "Synchronize Automoderator",
    forUserType: "moderator",
    onPress: synchroniseAutomodMenuHandler,
});

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

Devvit.addSchedulerJob({
    name: "saveSettingsToWiki",
    onRun: saveSettingsToWiki,
});

Devvit.addSchedulerJob({
    name: "updateSharedRulesJob",
    onRun: updateSharedRulesJob,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
