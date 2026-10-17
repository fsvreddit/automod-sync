import { scheduler } from "@devvit/web/server";
import { SchedulerJob } from "./constants";

export async function handleAppInstallOrUpgrade () {
    // Clear down existing scheduler jobs, if any, in case a new release changes the schedule
    const currentJobs = await scheduler.listJobs();
    await Promise.all(currentJobs.map(job => scheduler.cancelJob(job.id)));
    console.log(`Cancelled ${currentJobs.length} existing scheduler jobs.`);

    // Choose a randomised schedule per install. Run every hour.
    const minute = Math.floor(Math.random() * 60);

    await scheduler.runJob({
        name: SchedulerJob.UpdateSharedRules,
        cron: `${minute} * * * *`,
    });
}
