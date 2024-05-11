// Visit developers.reddit.com/docs to learn Devvit!

import {Devvit} from "@devvit/public-api";
import {updateSharedRules} from "./automoderator.js";

Devvit.addMenuItem({
    location: "subreddit",
    label: "Automod Thing",
    forUserType: "moderator",
    onPress: async (event, context) => {
        const subreddit = await context.reddit.getCurrentSubreddit();
        const rulesUpdated = await updateSharedRules(subreddit.name, context);
        if (rulesUpdated) {
            context.ui.showToast({text: "Automod has been updated.", appearance: "success"});
        } else {
            context.ui.showToast("No Automod rules needed updating.");
        }
    },
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
