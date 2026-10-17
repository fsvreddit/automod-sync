import { context, reddit, redis, WikiPage } from "@devvit/web/server";
import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { sendMessageWithResults, SyncFailureReason, updateSharedRules } from "../core/automoderator.js";
import pluralize from "pluralize";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";

export const onModAction = async (c: Context): Promise<Response> => {
    const event = await c.req.json<OnModActionRequest>();

    if (!event.action || event.action !== "wikirevise" || !event.subreddit || !event.moderator) {
        return c.json<TriggerResponse>({ success: true });
    }

    if (event.moderator.name === context.appSlug) {
        return c.json<TriggerResponse>({ success: true });
    }

    if (await hasEventBeenHandled(`modAction:${event.moderator.name}:${event.actionedAt}`)) {
        return c.json<TriggerResponse>({ success: true });
    }

    console.log(`WikiRevise: ${event.moderator.name} edited a wiki page.`);

    const redisKey = "lastrevisionchecked";
    const lastVersionProcessed = await redis.get(redisKey);
    let wikiPage: WikiPage;
    try {
        wikiPage = await reddit.getWikiPage(event.subreddit.name, "config/automoderator");
    } catch {
        return c.json<TriggerResponse>({ success: true });
    }

    if (wikiPage.revisionId === lastVersionProcessed) {
        console.log("WikiRevise: Automod page revision has not been updated.");
        return c.json<TriggerResponse>({ success: true });
    }

    const syncResult = await updateSharedRules();
    if (syncResult.some(x => !x.success && x.reason !== SyncFailureReason.NoIncludes)) {
        console.log("WikiRevise: One or more rules failed to synchronise. Sending message.");
        await sendMessageWithResults(event.moderator.name, event.subreddit.name, syncResult);
    } else {
        console.log(`WikiRevise: ${syncResult.length} ${pluralize("rule", syncResult.length)} updated by sync task with no failures.`);
    }

    await redis.set(redisKey, wikiPage.revisionId);

    return c.json<TriggerResponse>({ success: true });
};
