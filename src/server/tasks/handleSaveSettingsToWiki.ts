import { reddit, settings, TaskResponse, WikiPage } from "@devvit/web/server";
import { Context } from "hono";
import { AppSetting, SETTINGS_WIKI_PAGE, SubSharingSettings } from "../core";

export type UpdateAllStatisticsJobData = {
    jobGuid: string;
    subStatsOnly?: boolean;
};

export const handleSaveSettingsToWikiJob = async (c: Context): Promise<Response> => {
    const subreddit = await reddit.getCurrentSubreddit();

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage(subreddit.name, SETTINGS_WIKI_PAGE);
    } catch {
        //
    }

    const appSettings = await settings.getAll();
    const settingsObject: SubSharingSettings = {
        enableSharingToAll: appSettings[AppSetting.EnableSharingToAll] as boolean | undefined ?? false,
        subList: (appSettings[AppSetting.SubList] as string | undefined ?? "").split(",").map(x => x.toLowerCase().trim()).filter(x => x !== ""),
        alternateWikiPages: (appSettings[AppSetting.AlternateWikiPages] as string | undefined ?? "").split(",").map(x => x.toLowerCase().trim()).filter(x => x !== ""),
    };

    const wikiSaveOptions = {
        subredditName: subreddit.name,
        page: SETTINGS_WIKI_PAGE,
        content: JSON.stringify(settingsObject, null, 4),
    };

    if (wikiPage) {
        await reddit.updateWikiPage(wikiSaveOptions);
    } else {
        await reddit.createWikiPage(wikiSaveOptions);
        await reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: SETTINGS_WIKI_PAGE,
            listed: false,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment
            permLevel: 2, // MODS_ONLY
        });
    }

    return c.json<TaskResponse>({ message: "Handled update all statistics job." }, 200);
};
