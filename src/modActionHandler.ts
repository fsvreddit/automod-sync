import { ModAction } from "@devvit/protos";
import { TriggerContext, WikiPage } from "@devvit/public-api";
import { sendMessageWithResults, SyncFailureReason, updateSharedRules } from "./automoderator.js";
import pluralize from "pluralize";

export async function handleModAction (event: ModAction, context: TriggerContext) {
    if (!event.action || event.action !== "wikirevise" || !event.subreddit || !event.moderator) {
        return;
    }

    if (event.moderator.id === context.appAccountId) {
        return;
    }

    console.log(`WikiRevise: ${event.moderator.name} edited a wiki page.`);

    const redisKey = "lastrevisionchecked";
    const lastVersionProcessed = await context.redis.get(redisKey);
    let wikiPage: WikiPage;
    try {
        wikiPage = await context.reddit.getWikiPage(event.subreddit.name, "config/automoderator");
    } catch {
        return;
    }

    if (wikiPage.revisionId === lastVersionProcessed) {
        console.log("WikiRevise: Automod page revision has not been updated.");
        return;
    }

    const syncResult = await updateSharedRules(context);
    if (syncResult.some(x => !x.success && x.reason !== SyncFailureReason.NoIncludes)) {
        console.log("WikiRevise: One or more rules failed to synchronise. Sending message.");
        await sendMessageWithResults(context, event.moderator.name, event.subreddit.name, syncResult);
    } else {
        console.log(`WikiRevise: ${syncResult.length} ${pluralize("rule", syncResult.length)} updated by sync task with no failures.`);
    }

    await context.redis.set(redisKey, wikiPage.revisionId);
}
