// Visit developers.reddit.com/docs to learn Devvit!

import {Devvit} from "@devvit/public-api";
import {updateSharedRules, updateSharedRulesJob} from "./automoderator.js";
import {handleModAction} from "./modActionHandler.js";
import {appSettings, saveSettingsToWiki} from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addMenuItem({
    location: "subreddit",
    label: "Synchronize Automoderator",
    forUserType: "moderator",
    onPress: async (event, context) => {
        const currentUser = await context.reddit.getCurrentUser();
        if (!currentUser) {
            context.ui.showToast("An error occurred");
            return;
        }

        const currentSubreddit = await context.reddit.getCurrentSubreddit();
        const currentUserPermissions = await currentUser.getModPermissionsForSubreddit(currentSubreddit.name);
        if (!currentUserPermissions.includes("all") || !currentUserPermissions.includes("config") || !currentUserPermissions.includes("wiki")) {
            context.ui.showToast("You do not have permissions to manage AutoModerator on this subreddit");
            return;
        }

        const rulesUpdated = await updateSharedRules(context);
        if (rulesUpdated) {
            context.ui.showToast({text: "Automod has been updated.", appearance: "success"});
        } else {
            context.ui.showToast("No Automod rules needed updating.");
        }
    },
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
