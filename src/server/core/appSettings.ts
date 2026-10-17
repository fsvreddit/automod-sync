import { reddit, WikiPage } from "@devvit/web/server";
import Ajv, { JSONSchemaType } from "ajv";
import { SETTINGS_WIKI_PAGE } from "./constants";

export enum AppSetting {
    EnableSharingToAll = "enableSharingToAll",
    SubList = "subList",
    AlternateWikiPages = "alternateWikiPages",
}

export interface SubSharingSettings {
    enableSharingToAll: boolean;
    subList: string[];
    alternateWikiPages: string[];
}

export async function getSettingsFromSubreddit (subredditName: string): Promise<SubSharingSettings> {
    let wikiPage: WikiPage;
    try {
        wikiPage = await reddit.getWikiPage(subredditName, SETTINGS_WIKI_PAGE);
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

    const ajv = new Ajv();
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
