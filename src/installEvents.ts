import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";

export async function handleAppInstallOrUpgrade (_: AppInstall | AppUpgrade, context: TriggerContext) {
    // Clear down existing scheduler jobs, if any, in case a new release changes the schedule
    const currentJobs = await context.scheduler.listJobs();
    await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));
    console.log(`Cancelled ${currentJobs.length} existing scheduler jobs.`);

    // Choose a randomised schedule per install. Run every hour.
    const minute = Math.floor(Math.random() * 60);

    await context.scheduler.runJob({
        name: "updateSharedRulesJob",
        cron: `${minute} * * * *`,
    });
}
