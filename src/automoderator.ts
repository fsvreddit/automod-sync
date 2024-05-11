import {TriggerContext, WikiPage} from "@devvit/public-api";
import _ from "lodash";
import regexEscape from "regex-escape";

export async function getAutomodConfigFromSubreddit (subredditName: string, context: TriggerContext): Promise<string[]> {
    let automodPage: WikiPage;
    try {
        automodPage = await context.reddit.getWikiPage(subredditName, "config/automoderator");
    } catch (error) {
        console.log(error);
        return [];
    }

    const allRules: string[] = [];
    let currentRule: string[] = [];
    for (const line of automodPage.content.split("\n")) {
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
    const includeRegex = /^#include ([\w\d_-]+) (.+)[\r\n$]/;
    const matches = rule.match(includeRegex);
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

type AutomodForSub = {
    [subreddit: string]: string[]
}

export async function updateSharedRules (subredditName: string, context: TriggerContext): Promise<boolean> {
    const rules = await getAutomodConfigFromSubreddit(subredditName, context);
    const newRules: string[] = [];
    const subredditsToReadConfigFrom = _.uniq(_.compact(rules.map(includeStatementMatches)).map(result => result.subredditName));

    if (subredditsToReadConfigFrom.length === 0) {
        console.log("Automod does not contain any valid include directives.");
        return false;
    }

    const automodForSub: AutomodForSub = {};

    for (const subreddit of subredditsToReadConfigFrom) {
        const otherSubAutomod = await getAutomodConfigFromSubreddit(subreddit, context);

        automodForSub[subreddit] = otherSubAutomod;
    }

    let atLeastOneRuleUpdated = false;

    for (let rule of rules) {
        const includeRuleDetails = includeStatementMatches(rule);
        if (includeRuleDetails) {
            const regex = new RegExp(`^#share ${regexEscape(includeRuleDetails.ruleName)}[\r\n]`);
            const ruleToInsert = automodForSub[includeRuleDetails.subredditName].find(x => regex.test(x));
            if (ruleToInsert) {
                const newRule = ruleToInsert.replace(`#share ${includeRuleDetails.ruleName}`, `#include ${includeRuleDetails.subredditName} ${includeRuleDetails.ruleName}\r\n# This Automod rule has been synchronised from /r/${includeRuleDetails.subredditName}. Edits made on this copy may be lost.`);
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
        await saveAutomodConfigToSubreddit(subredditName, newRules, context);
        console.log("Rule Sync: Automod has been updated!");
    }

    return atLeastOneRuleUpdated;
}
