import { ScheduledJobEvent, SettingsFormField, TriggerContext, WikiPage, WikiPagePermissionLevel } from "@devvit/public-api";
import Ajv, { JSONSchemaType } from "ajv";
import { addSeconds } from "date-fns";

export enum AppSetting {
    EnableSharingToAll = "enableSharingToAll",
    SubList = "subList",
    AlternateWikiPages = "alternateWikiPages",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "group",
        label: "Sharing Options",
        fields: [
            {
                name: AppSetting.EnableSharingToAll,
                type: "boolean",
                label: "Enable sharing to any subreddit",
                defaultValue: false,
            },
            {
                name: AppSetting.SubList,
                type: "string",
                label: "Subreddits to share with",
                helpText: "Optional. Only applies if enable sharing to any subreddit is disabled. A comma separated list of subreddits, not case sensitive.",
                onValidate: async (_, context) => {
                    await context.scheduler.runJob({
                        name: "saveSettingsToWiki",
                        runAt: addSeconds(new Date(), 1),
                    });
                },
            },
            {
                name: AppSetting.AlternateWikiPages,
                type: "string",
                label: "Alternate ruleset wiki pages",
                helpText: "Optional. A list of wiki pages that can also be used to store Automod rulesets for sharing.",
            },
        ],
    },
];

export interface SubSharingSettings {
    enableSharingToAll: boolean;
    subList: string[];
    alternateWikiPages: string[];
}

const SETTINGS_WIKI_PAGE = "automod-sync/settings";

export async function saveSettingsToWiki (_: ScheduledJobEvent, context: TriggerContext) {
    const subreddit = await context.reddit.getCurrentSubreddit();

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, SETTINGS_WIKI_PAGE);
    } catch {
        //
    }

    const settings = await context.settings.getAll();
    const settingsObject: SubSharingSettings = {
        enableSharingToAll: settings[AppSetting.EnableSharingToAll] as boolean | undefined ?? false,
        subList: (settings[AppSetting.SubList] as string | undefined ?? "").split(",").map(x => x.toLowerCase().trim()).filter(x => x !== ""),
        alternateWikiPages: (settings[AppSetting.AlternateWikiPages] as string | undefined ?? "").split(",").map(x => x.toLowerCase().trim()).filter(x => x !== ""),
    };

    const wikiSaveOptions = {
        subredditName: subreddit.name,
        page: SETTINGS_WIKI_PAGE,
        content: JSON.stringify(settingsObject, null, 4),
    };

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiSaveOptions);
    } else {
        await context.reddit.createWikiPage(wikiSaveOptions);
        await context.reddit.updateWikiPageSettings({
            subredditName: subreddit.name,
            page: SETTINGS_WIKI_PAGE,
            listed: false,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
        });
    }
}

export async function getSettingsFromSubreddit (subredditName: string, context: TriggerContext): Promise<SubSharingSettings> {
    let wikiPage: WikiPage;
    try {
        wikiPage = await context.reddit.getWikiPage(subredditName, SETTINGS_WIKI_PAGE);
    } catch {
        return {
            enableSharingToAll: false,
            subList: [],
            alternateWikiPages: [],
        };
    }

    const settings = JSON.parse(wikiPage.content) as SubSharingSettings;

    const subSharingSettingsSchema: JSONSchemaType<SubSharingSettings> = {
        type: "object",
        properties: {
            enableSharingToAll: { type: "boolean", nullable: false },
            subList: {
                type: "array",
                nullable: false,
                items: { type: "string" },
            },
            alternateWikiPages: {
                type: "array",
                nullable: false,
                items: { type: "string" },
            },
        },
        required: ["enableSharingToAll", "subList", "alternateWikiPages"],
    };

    const ajv = new Ajv.default();
    const validate = ajv.compile(subSharingSettingsSchema);
    if (!validate(settings)) {
        console.log(`Sub sharing settings on /r/${subredditName} invalid: ${ajv.errorsText(validate.errors)}`);
        return {
            enableSharingToAll: false,
            subList: [],
            alternateWikiPages: [],
        };
    }

    return settings;
}
