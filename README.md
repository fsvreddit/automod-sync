An AutoModerator Synchronization app to share automod rules between subreddits.

To share a rule with other subreddits, make sure that the rule **starts with** a comment in this format:

`#share Rule Name or identifier`

E.g.

`#share Profanity filter`

To include a rule from another subreddit in your AutoModerator ruleset, create an empty rule in your automod configuration starting with an #include directive like this:

`#include <subname> <Rule Name or identifier>`

e.g.

`#include fsvsandbox Profanity filter`

This tells the app to pull in the rule from /r/fsvsandbox with the name "Profanity filter".

Both the sharing and receiving subreddit need to have Automod Sync installed.

Rules are synchronized:
* When you update your sub's automoderator page and include a new #include directive
* When you choose the option "Synchronize Automoderator" from the subreddit ... menu
* Once per hour, if any shared rules have been updated on the subreddits that are hosting them

Certain attributes of an AutoMod rule can be amended on your subreddit without being overwritten by the synchronization process. Action attributes as well as the moderators_exempt and priority attributes can be changed on the receiving subreddit, and will not be overwritten by the synchronization process even if they change on the subreddit sharing the rule. The full list of attributes that will not be overwritten is `action`, `action_reason`, `set_flair`, `overwrite_flair`, `set_sticky`, `set_nsfw`, `set_spoiler`, `set_contest_mode`, `set_original_content`, `set_suggested_sort`, `set_locked`, `report_reason`, `comment`, `comment_locked`, `comment_stickied`, `modmail`, `modmail_subject`, `message`, `message_subject`, `moderators_exempt`, `priority`.

If you want the above attributes to be overwritten regardless, you can add -p to the #include directive as follows:

`#include fsvsandbox -p Profanity Filter`

If you want to return to a fully synchronized rule, simply remove all the action attributes or even blank out the rule except for the #include line.

Note: there may be formatting differences between the rules on a sharing sub and a sub that #includes that rule. To preserve action attributes, it's necessary to run every rule through a parser which applies its own formatting.

## Sharing rules that aren't in your core AutoMod ruleset

Some subreddits, such as those dedicated to produce libraries of rules may wish to share rules without having them in the main Automod wiki page. In the settings page you can configure a list of wiki pages that will also be checked for when importing rules.

## Privacy controls

By default, sharing is disabled. In the app settings you can choose to make rules shareable to any subreddit that knows the name of the rule you're sharing, or provide a list of subreddits (comma separated, not case sensitive) that you are happy to share rules with. If you find that a rule fails to synchronize, check the sharing settings to ensure that the subreddit shares its rules.

## Version history

v1.3.2:

* Fixed a bug with automatic synchronisation not working when rules are updated on the sharing subreddit

v1.3:

* Fix error saving rules on some subreddits
* Fix issue where -p flag would be ignored

v1.2.2:

* Fix issue with other unicode tokens that don't represent emoji
* Preserves actions under the `parent_submission` or `author` YAML node
* Preserves `flair_css_class` and `flair_template_id` under `author`, as these are likely to be unique to a given subreddit.

v1.2:

* Fix issue preventing rules with escaped emoji from syncing
* Add better error handling for issues preventing Automod wiki page from being saved
* Add -p option on #include directives to allow rules to be synced while preserving actions
* Allow subreddit names in #include directives to have r/ or /r/ prepended without preventing sync

v1.1: 

* Rule and subreddit names are now not case sensitive
* Sends a DM to the person updating Automod or synchronizing via a menu if any rule fails to synchronize.

v1.0.3: Fixed a bug that prevented rules synchronizing in some cases
