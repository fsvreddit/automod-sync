import { context, reddit } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { sendMessageWithResults, updateSharedRules } from "../core";
import pluralize from "pluralize";

export const handleSynchroniseNowMenu = async (c: Context): Promise<Response> => {
    const currentUser = await reddit.getCurrentUser();
    if (!currentUser) {
        return c.json<UiResponse>({
            showToast: "An error occurred",
        });
    }

    const currentUserPermissions = await currentUser.getModPermissionsForSubreddit(context.subredditName);
    if (!currentUserPermissions.includes("all") && (!currentUserPermissions.includes("config") || !currentUserPermissions.includes("wiki"))) {
        return c.json<UiResponse>({
            showToast: "You do not have permissions to manage AutoModerator on this subreddit",
        });
    }

    const syncResult = await updateSharedRules();
    if (syncResult.length && !syncResult.some(result => !result.success) && syncResult.some(result => result.updateNeeded)) {
        return c.json<UiResponse>({
            showToast: `Automod has been updated. ${syncResult.length} ${pluralize("rule", syncResult.length)} synchronized.`,
        });
    } else if (syncResult.length && !syncResult.some(result => !result.success) && !syncResult.some(result => result.updateNeeded)) {
        return c.json<UiResponse>({
            showToast: "Automod's synchronised rules are already up to date, no changes made.",
        });
    } else if (syncResult.length && syncResult.some(result => !result.success)) {
        const successfulRules = syncResult.filter(x => x.success).length;
        const failedRules = syncResult.filter(x => !x.success).length;
        await sendMessageWithResults(currentUser.username, context.subredditName, syncResult);
        return c.json<UiResponse>({
            showToast: `${successfulRules} ${pluralize("rule", successfulRules)} synchronized, ${failedRules} failed to sync. Check your messages.`,
        });
    } else {
        return c.json<UiResponse>({
            showToast: "No Automod rules needed updating.",
        });
    }
};
