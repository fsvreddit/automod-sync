import {MenuItemOnPressEvent, ScheduledJobEvent, TriggerContext, WikiPage, Context} from "@devvit/public-api";
import _ from "lodash";
import regexEscape from "regex-escape";
import {SubSharingSettings, getSettingsFromSubreddit} from "./settings.js";
import {replaceAll} from "./utility.js";
import {parseDocument} from "yaml";

function normaliseLineEndings (input: string): string {
    // Automod uses CRLF for some reason. Normal wiki pages use LF.
    return replaceAll(replaceAll(input, "\r\n", "\n"), "\n", "\r\n");
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
                autoModContent += `\r\n---\r\n${normaliseLineEndings(nonLivePage.content)}`;
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
    try {
        await context.reddit.getWikiPage(subredditName, "config/automoderator");
    } catch {
        // Automod does not exist.
        throw new Error("Automoderator is not yet set up.");
    }

    await context.reddit.updateWikiPage({
        subredditName,
        page: "config/automoderator",
        content: rules.join("\n---\n"),
        reason: "Updated by AutoMod Sync",
    });
}

function includeStatementMatches (rule: string) {
    const [firstLine] = normaliseLineEndings(rule).split("\r\n");
    const includeRegex = /^\s*#include ([\w\d_-]+) (.+)$/;
    const matches = firstLine.match(includeRegex);
    if (!matches || matches.length > 3) {
        return;
    }

    const [, subredditName, ruleName] = matches;
    if (subredditName && ruleName) {
        return {
            subredditName,
            ruleName: ruleName.trim(),
        };
    }
}

type YamlNode = {
    [subreddit: string]: unknown
}

function replacedRuleWithActionsPreserved (originalRule: string, ruleToReplaceWith: string): string {
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

    const parsedOriginalRule = parseDocument(replaceAll(originalRule, "\r", ""));
    const parsedReplacementRule = parseDocument(replaceAll(ruleToReplaceWith, "\r", ""));
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

type AutomodForSub = {
    [subreddit: string]: string[]
}

export async function updateSharedRules (context: TriggerContext): Promise<boolean> {
    const thisSubreddit = await context.reddit.getCurrentSubreddit();
    const rules = await getAutomodConfigFromSubreddit(thisSubreddit.name, context);
    const newRules: string[] = [];
    const subredditsToReadConfigFrom = _.uniq(_.compact(rules.map(includeStatementMatches)).map(result => result.subredditName));

    console.log(`Rule Sync: Reading from ${subredditsToReadConfigFrom.length} subreddits`);

    if (subredditsToReadConfigFrom.length === 0) {
        console.log("Rule Sync: Automod does not contain any valid include directives.");
        return false;
    }

    const automodForSub: AutomodForSub = {};

    for (const subreddit of subredditsToReadConfigFrom) {
        const otherSubSharingSettings = await getSettingsFromSubreddit(subreddit, context);
        if (!otherSubSharingSettings.enableSharingToAll && !otherSubSharingSettings.subList.some(sub => sub.toLowerCase() === thisSubreddit.name.toLowerCase())) {
            // Other sub has not allowed sharing with this one, so store an empty ruleset.
            console.log(`Rule Sync: /r/${subreddit} is not sharing rules with /r/${thisSubreddit.name}`);
            automodForSub[subreddit] = [];
            continue;
        }

        const otherSubAutomod = await getAutomodConfigFromSubreddit(subreddit, context, true, otherSubSharingSettings);

        automodForSub[subreddit] = otherSubAutomod;
    }

    let atLeastOneRuleUpdated = false;

    for (let rule of rules) {
        const includeRuleDetails = includeStatementMatches(rule);
        if (includeRuleDetails) {
            const regex = new RegExp(`^\\s*#share ${regexEscape(includeRuleDetails.ruleName)}[\r\n]`);
            const ruleToInsert = automodForSub[includeRuleDetails.subredditName].find(x => regex.test(x));
            if (ruleToInsert) {
                const ruleWithActionsPreserved = replacedRuleWithActionsPreserved(rule, ruleToInsert);
                const newRule = ruleWithActionsPreserved.replace(`#share ${includeRuleDetails.ruleName}`, `#include ${includeRuleDetails.subredditName} ${includeRuleDetails.ruleName}\r\n# This Automod rule has been synchronised from /r/${includeRuleDetails.subredditName}. Edits made on this copy may be lost.`);
                if (rule !== newRule) {
                    // Rule has changed!
                    rule = newRule;
                    atLeastOneRuleUpdated = true;
                }
            } else {
                console.log(`No match for ${includeRuleDetails.ruleName} on ${includeRuleDetails.subredditName}`);
            }
        }
        newRules.push(rule);
    }

    if (atLeastOneRuleUpdated) {
        await saveAutomodConfigToSubreddit(thisSubreddit.name, newRules, context);
        console.log("Rule Sync: Automod has been updated!");
    }

    return atLeastOneRuleUpdated;
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

    const rulesUpdated = await updateSharedRules(context);
    if (rulesUpdated) {
        context.ui.showToast({text: "Automod has been updated.", appearance: "success"});
    } else {
        context.ui.showToast("No Automod rules needed updating.");
    }
}

export async function updateSharedRulesJob (_: ScheduledJobEvent, context: TriggerContext) {
    await updateSharedRules(context);
}
