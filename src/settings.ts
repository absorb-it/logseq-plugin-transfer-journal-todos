import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user'
import { isAfter, sub } from 'date-fns'
import { t } from "logseq-l10n"

export const todoRegex = /^(TODO)\s+/;
export const commentStart = "#+BEGIN_COMMENT\n";
export const commentEnd = "\n#+END_COMMENT";
export const smallIndicatorStart = "[^";
export const smallIndicatorEnd = "]";
export const transferDone = "todos_transferred"
export const ignoreTodos = "dont_transfer"

export const settingsTemplate = (): SettingSchemaDesc[] => [
  {
    key: 'transferDoneString',
    type: 'string',
    title: t("Special Transfer-Done String"),
    description: t("Special String to indicate that transfer was already done. If empty, default one 'todos_transferred' is used. Will be removed on next day."),
    default: transferDone,
  }, {
    key: 'transferDoneComment',
    type: 'boolean',
    title: t("Hidden Transfer-Done Comment"),
    description: t("Use hidden comment to indicate transfer was already done. If false (default), some small readable indication is used."),
    default: false,
  }, {
    key: 'dontTransferString',
    type: 'string',
    title: t("Special Dont-Transfer String"),
    description: t("Special String to indicate that transfer of open TODOs in this block is not required. If empty, default one 'dont_transfer' is used."),
    default: ignoreTodos,
  }, {
    key: 'journalTemplate',
    type: 'string',
    title: t("Journal Template"),
    description: t("Template to apply once on Todays Journal. This is not like the common Journal template, which get's applied to any newly created, today or future Journal. Probably add some 'Dont-Transfer' String to your Template to prevent moving open TODOs into the next day."),
    default: "",
  }, {
    key: 'checkingInterval',
    type: 'number',
    title: t("Checking Interval"),
    description: t("This is the time between parsing and checking, if current days Journal page needs an update. Default is every minute, but you can set the seconds here to modify this value."),
    default: 60,
  }
]
