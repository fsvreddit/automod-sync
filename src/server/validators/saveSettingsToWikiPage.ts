import { scheduler } from "@devvit/web/server";
import { SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { addSeconds } from "date-fns";

export const saveSettingsToWikiPageValidator = async (c: Context): Promise<Response> => {
    await scheduler.runJob({
        name: "saveSettingsToWiki",
        runAt: addSeconds(new Date(), 1),
    });

    return c.json<SettingsValidationResponse>({
        success: true,
    });
};
