import {ModAction} from "@devvit/protos";
import {TriggerContext, WikiPage} from "@devvit/public-api";
import {updateSharedRules} from "./automoderator.js";

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

    const rulesUpdated = await updateSharedRules(context);
    if (rulesUpdated) {
        console.log("WikiRevise: At least one automod rule was updated by sync task.");
    } else {
        console.log("WikiRevise: No rules were updated by sync task.");
    }

    await context.redis.set(redisKey, wikiPage.revisionId);
}
