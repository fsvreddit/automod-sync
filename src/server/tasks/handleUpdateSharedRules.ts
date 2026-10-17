import { TaskResponse } from "@devvit/web/server";
import { Context } from "hono";
import { updateSharedRules } from "../core";

export const handleUpdateSharedRulesJob = async (c: Context): Promise<Response> => {
    await updateSharedRules();

    return c.json<TaskResponse>({ success: true }, 200);
};
