import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { saveSettingsToWikiPageValidator } from "./validators";
import { handleSaveSettingsToWikiJob, handleUpdateSharedRulesJob } from "./tasks";
import { onAppInstall, onAppUpgrade, onModAction } from "./triggers";
import { handleSynchroniseNowMenu } from "./menu";

const application = new Hono();

// Triggers
application.post("/internal/triggers/app-install", onAppInstall);
application.post("/internal/triggers/app-upgrade", onAppUpgrade);
application.post("/internal/triggers/on-mod-action", onModAction);

// Settings validators
application.post("/internal/validators/save-settings-to-wiki", saveSettingsToWikiPageValidator);

// Scheduler jobs
application.post("/internal/tasks/save-settings-to-wiki", handleSaveSettingsToWikiJob);
application.post("/internal/tasks/update-shared-rules", handleUpdateSharedRulesJob);

// Menus
application.post("/internal/menu/synchronise-automod", handleSynchroniseNowMenu);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
