import '@logseq/libs';
import {BlockEntity} from '@logseq/libs/dist/LSPlugin';
import {format} from 'date-fns';
import {t} from 'logseq-l10n';

import de from "./translations/de.json";


let config;

const todoRegex = /^(TODO)\s+/;
const commentStart = "#+BEGIN_COMMENT\n";
const commentEnd = "\n#+END_COMMENT";
const smallIndicatorStart = "[^";
const smallIndicatorEnd = "]";
const transferDone = "todos_transferred"
const ignoreTodos = "dont_transfer"
const settingsSchema = [
  {
    key: 'transferDoneString',
    type: 'string',
    title: t("Special Transfer-Done String"),
    description: t("Special String to indicate that transfer was already done. If empty, default one 'todos_transferred' is used. Will be removed on next day."),
    default: '',
  }, {
    key: 'transferDoneComment',
    type: 'boolean',
    title: t("Hidden Transfer-Done Comment"),
    description: t("Use hidden comment to indicate transfer was already done. If false (default), some small readable indication is used."),
    default: false,
  }, {
    key: 'journalTemplate',
    type: 'string',
    title: t("Journal Template"),
    description: t("Template to apply once on Todays Journal. This is not like the common Journal template, which get's applied to any newly created, today or future Journal."),
    default: '',
  }]

function escapeRegExp(inputString: string) {
    return inputString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkIgnore(srcBlock) {
  let ignoreRegex =  new RegExp(escapeRegExp(ignoreTodos));
  return ignoreRegex.test(srcBlock.content);
}

function recursivelyCheckForRegexInBlock(block: BlockEntity, regex: RegExp): boolean {
  if (block.children !== undefined) {
    return regex.test(block.content) || block.children.some(child => recursivelyCheckForRegexInBlock(child, regex));
  } else {
    return regex.test(block.content)
  };
}

async function getLastBlock(pageName: string) {
  const blocks = await logseq.Editor.getPageBlocksTree(pageName);
  if (blocks.length === 0) {
    return null;
  }
  return blocks[blocks.length - 1];
};

async function insertTemplateBlock(blockUuid, template: string) {
  const exist = await logseq.App.existTemplate(template) as boolean
  if (exist === true) {
    const newBlock = await logseq.Editor.insertBlock(blockUuid, "", { sibling: true, isPageBlock: true, before: true, focus: false })
    if (newBlock) {
      await logseq.App.insertTemplate(newBlock.uuid, template);
    }
  }
}

async function queryCurrentRepoRangeJournals(untilDate) {
  try {
    const journals = await logseq.DB.datascriptQuery(`
      [:find (pull ?p [*])
       :where
       [?b :block/page ?p]
       [?p :block/journal? true]
       [?p :block/journal-day ?d]
       [(< ?d ${untilDate})]
      ]
    `);
    return (journals || []).flat();
  } catch (e) {
    console.error(e);
  }
}

async function updateNewJournalWithAllTODOs(newJournal) {
  const newJournalBlocks = await logseq.Editor.getPageBlocksTree(newJournal.name);

  let transferDoneString =
      (logseq.settings.transferDoneComment?commentStart:smallIndicatorStart) +
      (logseq.settings.transferDoneString?logseq.settings.transferDoneString:transferDone) +
      (logseq.settings.transferDoneComment?commentEnd:smallIndicatorEnd);
  let transferDoneRegexp = new RegExp(escapeRegExp(transferDoneString));

  let alreadyDone = false;
  for (let group of newJournalBlocks) {
    alreadyDone = alreadyDone || recursivelyCheckForRegexInBlock(group, transferDoneRegexp);;
  }

  if (!alreadyDone) {
    const prevJournals = await queryCurrentRepoRangeJournals(newJournal['journalDay']);
    const latestJournal = prevJournals.reduce(
      (prev, current) => prev['journal-day'] > current['journal-day'] ? prev : current
    );

    const latestJournalBlocks = await logseq.Editor.getPageBlocksTree(latestJournal.name);
    let newJournalLastBlock = await getLastBlock(newJournal.name);

    // tag page with special String to indicate for today that we transferred all todos and applied templates
    await logseq.Editor.prependBlockInPage(newJournal.name, transferDoneString);
    await new Promise(f => setTimeout(f, 200));

    // apply Template if configured
    if (logseq.settings.journalTemplate) {
      logseq.Editor.exitEditingMode();
      await insertTemplateBlock(newJournalLastBlock.uuid, logseq.settings.journalTemplate)
    }
    await new Promise(f => setTimeout(f, 200));

    // transfer undone TODOs from previous journal
    newJournalLastBlock = await getLastBlock(newJournal.name);
    for (let group of latestJournalBlocks) {
      if (group.content !== '') {
          newJournalLastBlock = await recursiveTransferTODOs(group, newJournalLastBlock, false);
          await recursiveCleanupNotTODOs(group);
      }
    }
    await logseq.Editor.insertBlock(newJournalLastBlock.uuid,'');
    await new Promise(f => setTimeout(f, 200));

    // logseq.UI.showMsg("Todays Journal page updated", { timeout: 2200 });
    console.log("Todays Journal page updated");
  }
}

async function recursiveTransferTODOs(srcBlock: BlockEntity, lastDestBlock: BlockEntity, hasParentTodo: boolean) {
  let hasChildTodo = recursivelyCheckForRegexInBlock(srcBlock, todoRegex);
  hasParentTodo = hasParentTodo || todoRegex.test(srcBlock.content);

  if (!(checkIgnore(srcBlock)) && (hasParentTodo || hasChildTodo)) {
    let newBlock = lastDestBlock;
    if (lastDestBlock.content !== '') {
      newBlock = await logseq.Editor.insertBlock(lastDestBlock.uuid, srcBlock.content, {
        sibling: true,
      });
    } else {
      await logseq.Editor.updateBlock(lastDestBlock.uuid, srcBlock.content);
      newBlock.content = srcBlock.content; // update doesn't update the instance.
    }

    if (srcBlock.children.length > 0) {
      let newChildBlock = await logseq.Editor.insertBlock(newBlock.uuid, '');
      const firstChildBlockUUID = newChildBlock.uuid;
      for (let child of srcBlock.children) {
        newChildBlock = await recursiveTransferTODOs(child, newChildBlock, hasParentTodo);
      }
      if (newChildBlock.uuid === firstChildBlockUUID && newChildBlock.content === '') {
        await logseq.Editor.removeBlock(newChildBlock.uuid);
      }
    }
    return newBlock;
  } else {
    return lastDestBlock;
  }
}

async function recursiveCleanupNotTODOs(srcBlock: BlockEntity): boolean {
  let hadChilds = srcBlock.children.length;
  let transferDoneString =
    logseq.settings.transferDoneString?logseq.settings.transferDoneString:transferDone;

  let removedChilds = 0
  if (!(checkIgnore(srcBlock))) {
    removedChilds += srcBlock.children.map(child => { return (recursiveCleanupNotTODOs(child))?1:0; });
    if (todoRegex.test(srcBlock.content) || (hadChilds && removedChilds == hadChilds)) {
      await logseq.Editor.removeBlock(srcBlock.uuid);
      return true;
    }
  }

  let string1 = commentStart + transferDoneString + commentEnd;
  let string2 = smallIndicatorStart + transferDoneString + smallIndicatorEnd;
  await logseq.Editor.updateBlock(
    srcBlock.uuid, srcBlock.content.replace(string1, "").replace(string2, "")
  );

  return false;
};

async function main() {
  config = await logseq.App.getUserConfigs();
  // await l10nSetup({
  //   builtinTranslations: {  // import translations
  //     de
  //   }
  // })

  setInterval(async function () {
    let page = await logseq.Editor.getPage(format(new Date(), config.preferredDateFormat));
    if(!page) {
      console.warn("Create new Journal");
      await logseq.Editor.createPage(
        format(new Date(), config.preferredDateFormat),
        {},
        {
          createFirstBlock: true,
          redirect: false,
          journal: true,
        }
      );
    }
    await updateNewJournalWithAllTODOs(page);
  },10000);
}

// bootstrap
logseq.useSettingsSchema(settingsSchema).ready(main).catch(null)
