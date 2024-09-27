import {MenuItemOnPressEvent, ScheduledJobEvent, TriggerContext, WikiPage, Context} from "@devvit/public-api";
import _ from "lodash";
import regexEscape from "regex-escape";
import {SubSharingSettings, getSettingsFromSubreddit} from "./settings.js";
import {replaceAll, replaceSpecialCharacters} from "./utility.js";
import {parseDocument} from "yaml";
import pluralize from "pluralize";

function normaliseLineEndings (input: string): string {
    // Automod uses CRLF for some reason. Normal wiki pages use LF.
    return replaceAll(input, "\r", "");
}

export async function getAutomodConfigFromSubreddit (subredditName: string, context: TriggerContext, includeNonLiveRules?: boolean, otherSubSharingSettings?: SubSharingSettings): Promise<string[]> {
    let automodPage: WikiPage;
    try {
        automodPage = await context.reddit.getWikiPage(subredditName, "config/automoderator");
    } catch (error) {
        console.log(error);
        return [];
    }

    let autoModContent = automodPage.content;

    if (includeNonLiveRules && otherSubSharingSettings) {
        for (const pagename of otherSubSharingSettings.alternateWikiPages) {
            let nonLivePage: WikiPage;
            try {
                nonLivePage = await context.reddit.getWikiPage(subredditName, pagename);
                autoModContent += `\n---\n${normaliseLineEndings(nonLivePage.content)}`;
            } catch {
                //
            }
        }
    }

    const allRules: string[] = [];
    let currentRule: string[] = [];
    for (const line of autoModContent.split("\n")) {
        if (line.startsWith("---")) {
            // Separator between rules.
            if (currentRule.length > 0) {
                // Rule isn't completely empty. Add to list.
                allRules.push(currentRule.join("\n"));
            }
            currentRule = [];
        } else {
            currentRule.push(line);
        }
    }
    if (currentRule.length > 0) {
        // Rule isn't completely empty. Add to list.
        allRules.push(currentRule.join("\n"));
    }

    return allRules;
}

export async function saveAutomodConfigToSubreddit (subredditName: string, rules: string[], context: TriggerContext) {
    const automodWikiPage = "config/automoderator";
    try {
        await context.reddit.getWikiPage(subredditName, automodWikiPage);
    } catch {
        // Automod does not exist.
        throw new Error("Automoderator is not yet set up.");
    }

    await context.reddit.updateWikiPage({
        subredditName,
        page: automodWikiPage,
        content: rules.join("\n---\n"),
        reason: "Updated by AutoMod Sync",
    });
}

function includeStatementMatches (rule: string) {
    const [firstLine] = normaliseLineEndings(rule).split("\n");
    const includeRegex = /^\s*#include (?:\/?r\/)?([\w\d_-]+)( -p)? (.+)$/i;
    const matches = includeRegex.exec(firstLine);
    if (!matches || matches.length > 4) {
        return;
    }

    const [, subredditName, preserveActions, ruleName] = matches;
    if (subredditName && ruleName) {
        return {
            subredditName,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            preserveActions: preserveActions !== undefined,
            ruleName: ruleName.trim(),
        };
    }
}

type YamlNode = Record<string, unknown>;

export function replacedRuleWithActionsPreserved (originalRule: string, ruleToReplaceWith: string): string {
    const attributesToPreserve = [
        "action",
        "action_reason",
        "set_flair",
        "overwrite_flair",
        "set_sticky",
        "set_nsfw",
        "set_spoiler",
        "set_contest_mode",
        "set_original_content",
        "set_suggested_sort",
        "set_locked",
        "report_reason",
        "comment",
        "comment_locked",
        "comment_stickied",
        "modmail",
        "modmail_subject",
        "message",
        "message_subject",
        "moderators_exempt",
        "priority",
    ];

    const parsedOriginalRule = parseDocument(normaliseLineEndings(originalRule));
    const parsedReplacementRule = parseDocument(normaliseLineEndings(ruleToReplaceWith));
    const originalRuleHasActions = attributesToPreserve.some(action => parsedOriginalRule.has(action));

    if (originalRuleHasActions) {
        // Delete action attributes in the replacement rule
        attributesToPreserve.map(action => parsedReplacementRule.delete(action));
        const actionsFromOriginalRule = parsedOriginalRule.contents?.toJSON() as YamlNode;
        for (const entry of Object.entries(actionsFromOriginalRule).filter(entry => attributesToPreserve.includes(entry[0]))) {
            // Insert action attributes from original rule into replacement rule
            parsedReplacementRule.set(entry[0], entry[1]);
        }
    }

    return normaliseLineEndings(parsedReplacementRule.toString({
        singleQuote: true,
        indent: 4,
        lineWidth: 0,
    }));
}

type AutomodForSub = Record<string, string[]>;

export enum SyncFailureReason {
    NoIncludes = "noIncludes",
    SubNotSharing = "subNotSharing",
    RuleNotFound = "ruleNotFound",
    ErrorUpdatingAutomod = "errorUpdatingAutomod",
}

interface RuleSyncResult {
    subName: string,
    ruleName: string,
    success: boolean,
    reason?: SyncFailureReason,
    updateNeeded?: boolean
}

export async function updateSharedRules (context: TriggerContext): Promise<RuleSyncResult[]> {
    const thisSubreddit = await context.reddit.getCurrentSubreddit();
    const rules = await getAutomodConfigFromSubreddit(thisSubreddit.name, context);
    const newRules: string[] = [];
    const subredditsToReadConfigFrom = _.uniq(_.compact(rules.map(includeStatementMatches)).map(result => result.subredditName.toLowerCase()));

    console.log(`Rule Sync: Reading from ${subredditsToReadConfigFrom.length} subreddits`);

    if (subredditsToReadConfigFrom.length === 0) {
        console.log("Rule Sync: Automod does not contain any valid include directives.");
        return [{
            subName: thisSubreddit.name,
            ruleName: "",
            success: false,
            reason: SyncFailureReason.NoIncludes,
        }];
    }

    const syncResult: RuleSyncResult[] = [];
    const subsNotSharing: string[] = [];

    const automodForSub: AutomodForSub = {};

    for (const subreddit of subredditsToReadConfigFrom) {
        const otherSubSharingSettings = await getSettingsFromSubreddit(subreddit, context);
        if (!otherSubSharingSettings.enableSharingToAll && !otherSubSharingSettings.subList.some(sub => sub.toLowerCase() === thisSubreddit.name.toLowerCase())) {
            // Other sub has not allowed sharing with this one, so store an empty ruleset.
            console.log(`Rule Sync: /r/${subreddit} is not sharing rules with /r/${thisSubreddit.name}`);
            subsNotSharing.push(subreddit);
            automodForSub[subreddit] = [];
            continue;
        }

        const otherSubAutomod = await getAutomodConfigFromSubreddit(subreddit, context, true, otherSubSharingSettings);

        automodForSub[subreddit] = otherSubAutomod;
    }

    for (let rule of rules) {
        const includeRuleDetails = includeStatementMatches(rule);
        if (includeRuleDetails) {
            if (subsNotSharing.includes(includeRuleDetails.subredditName.toLowerCase())) {
                syncResult.push({
                    subName: includeRuleDetails.subredditName,
                    ruleName: includeRuleDetails.ruleName,
                    success: false,
                    reason: SyncFailureReason.SubNotSharing,
                });
            } else {
                const regex = new RegExp(`^\\s*#share ${regexEscape(includeRuleDetails.ruleName)}[\r\n]`, "i");
                const ruleToInsert = automodForSub[includeRuleDetails.subredditName.toLowerCase()].find(x => regex.test(x));
                if (ruleToInsert) {
                    console.log(`Rule Sync: Found rule ${includeRuleDetails.ruleName} on ${includeRuleDetails.subredditName}`);
                    let newRuleSplit: string[];
                    if (includeRuleDetails.preserveActions) {
                        newRuleSplit = replaceSpecialCharacters(normaliseLineEndings(ruleToInsert)).split("\n");
                    } else {
                        newRuleSplit = replaceSpecialCharacters(replacedRuleWithActionsPreserved(rule, ruleToInsert)).split("\n");
                    }
                    newRuleSplit.shift();
                    const preserveActionsParam = includeRuleDetails.preserveActions ? " -p" : "";
                    newRuleSplit.unshift(
                        `#include ${includeRuleDetails.subredditName}${preserveActionsParam} ${includeRuleDetails.ruleName}`,
                        `# This Automod rule has been synchronised from /r/${includeRuleDetails.subredditName}. Edits made on this copy may be lost.`,
                    );
                    const newRule = newRuleSplit.join("\n");

                    let updateNeeded = false;
                    if (rule !== newRule) {
                        // Rule has changed!
                        rule = newRule;
                        updateNeeded = true;
                    }

                    syncResult.push({
                        subName: includeRuleDetails.subredditName,
                        ruleName: includeRuleDetails.ruleName,
                        success: true,
                        updateNeeded,
                    });
                } else {
                    console.log(`Rule Sync: No match for ${includeRuleDetails.ruleName} on ${includeRuleDetails.subredditName}`);
                    syncResult.push({
                        subName: includeRuleDetails.subredditName,
                        ruleName: includeRuleDetails.ruleName,
                        success: false,
                        reason: SyncFailureReason.RuleNotFound,
                    });
                }
            }
        }
        newRules.push(rule);
    }

    if (syncResult.some(result => result.updateNeeded)) {
        try {
            await saveAutomodConfigToSubreddit(thisSubreddit.name, newRules, context);
        } catch (error) {
            console.log("Error saving Automod wiki page");
            console.log(error);
            return [{
                subName: thisSubreddit.name,
                ruleName: "",
                success: false,
                reason: SyncFailureReason.ErrorUpdatingAutomod,
            }];
        }

        console.log("Rule Sync: Automod has been updated!");
    }

    return syncResult;
}

export async function synchroniseAutomodMenuHandler (_: MenuItemOnPressEvent, context: Context) {
    const currentUser = await context.reddit.getCurrentUser();
    if (!currentUser) {
        context.ui.showToast("An error occurred");
        return;
    }

    const currentSubreddit = await context.reddit.getCurrentSubreddit();
    const currentUserPermissions = await currentUser.getModPermissionsForSubreddit(currentSubreddit.name);
    if (!currentUserPermissions.includes("all") && (!currentUserPermissions.includes("config") || !currentUserPermissions.includes("wiki"))) {
        context.ui.showToast("You do not have permissions to manage AutoModerator on this subreddit");
        return;
    }

    const syncResult = await updateSharedRules(context);
    if (syncResult.length && !syncResult.some(result => !result.success) && syncResult.some(result => result.updateNeeded)) {
        context.ui.showToast({text: `Automod has been updated. ${syncResult.length} ${pluralize("rule", syncResult.length)} synchronized.`, appearance: "success"});
    } else if (syncResult.length && !syncResult.some(result => !result.success) && !syncResult.some(result => result.updateNeeded)) {
        context.ui.showToast({text: "Automod's synchronised rules are already up to date, no changes made.", appearance: "success"});
    } else if (syncResult.length && syncResult.some(result => !result.success)) {
        const successfulRules = syncResult.filter(x => x.success).length;
        const failedRules = syncResult.filter(x => !x.success).length;
        context.ui.showToast(`${successfulRules} ${pluralize("rule", successfulRules)} synchronized, ${failedRules} failed to sync. Check your messages.`);
        await sendMessageWithResults(context, currentUser.username, currentSubreddit.name, syncResult);
    } else {
        context.ui.showToast("No Automod rules needed updating.");
    }
}

export async function sendMessageWithResults (context: TriggerContext, username: string, subreddit: string, syncResult: RuleSyncResult[]) {
    let message = `Hi /u/${username},\n\nAutomod Sync failed to synchronise one or more rules on /r/${subreddit}.\n\n`;

    if (syncResult.some(result => result.reason === SyncFailureReason.NoIncludes)) {
        message += "* ❌ No #include directives were found in AutoModerator's config\n\n";
    } else if (syncResult.some(result => result.reason === SyncFailureReason.ErrorUpdatingAutomod)) {
        message += "* ❌ An error occurred when trying to write to the Automoderator wiki page.\n\n";
    } else {
        for (const sourceSubreddit of _.uniq(syncResult.map(result => result.subName))) {
            message += `* /r/${sourceSubreddit}\n\n`;
            const subredditRules = syncResult.filter(result => result.subName === sourceSubreddit);
            if (subredditRules.some(result => result.reason === SyncFailureReason.SubNotSharing)) {
                message += "  * ❌ Subreddit is not configured to share Automod rules with this one.\n\n";
            } else {
                for (const rule of subredditRules) {
                    if (rule.success) {
                        message += `  * "${rule.ruleName}": ✔️ Success\n`;
                    }
                    if (rule.reason === SyncFailureReason.RuleNotFound) {
                        message += `  * "${rule.ruleName}": ❌ Rule not found in subreddit\n`;
                    }
                }
                message += "\n";
            }
        }
    }

    await context.reddit.sendPrivateMessage({
        subject: `Automod Sync results for /r/${subreddit}`,
        text: message,
        to: username,
    });
}

export async function updateSharedRulesJob (_: ScheduledJobEvent, context: TriggerContext) {
    await updateSharedRules(context);
}
