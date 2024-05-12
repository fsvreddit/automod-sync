An AutoModerator Synchronization app to share automod rules between subreddits.

To share a rule with other subreddits, make sure that the rule **starts with** a comment in this format:

`#share Rule Name or identifier`

E.g.

`#share Profanity filter`

To include a rule in your AutoModerator ruleset, create an empty rule in your automod configuration starting with an #include directive like this:

`#include <subname> <Rule Name or identifier>`

e.g.

`#include fsvsandbox Profanity filter`

This tells the app to pull in the rule from /r/fsvsandbox with the name "Profanity filter". Do not edit rules that have been synchronised from other subreddits because they will be overwritten by 

Both the sharing and receiving subreddit need to have Automod Sync installed.

Rules are synchronized:
* When you update your sub's automoderator page and include a new #include directive
* When you choose the option "Synchronize Automoderator" from the subreddit ... menu
* Once per hour, if any shared rules have been updated on the subreddits that are hosting them

## Privacy controls

By default, sharing is disabled. In the app settings you can choose to make rules shareable to any subreddit that knows the name of the rule you're sharing, or provide a list of subreddits (comma separated, not case sensitive) that you are happy to share rules with.
