import '@logseq/libs';
import {LSPluginBaseInfo, BlockEntity, BlockUUIDTuple, PageEntity} from '@logseq/libs/dist/LSPlugin.user';
import {format} from 'date-fns';
import { setup as l10nSetup, t, } from "logseq-l10n"

import { todoRegex, ignoreTodos, commentStart, commentEnd, smallIndicatorStart, smallIndicatorEnd, transferDone, settingsTemplate } from './settings'
import { delay, buildTransferDoneString, checkIgnore, escapeRegExp, isBlockEntity, recursivelyCheckForRegexInBlock, replaceBlockString, getLastBlock, insertTemplateBlock } from './lib'
import de from "./translations/de.json";

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

async function updateNewJournalWithAllTODOs(newJournal: PageEntity) {
  console.debug("starting updateNewJournalWithAllTODOs");

  const newJournalBlocks = await logseq.Editor.getPageBlocksTree(newJournal.name);

  let transferDoneString = buildTransferDoneString(logseq.settings!.transferDoneString)
  let transferDoneRegexp = new RegExp(escapeRegExp(transferDoneString));

  let alreadyDone = false;
  for (let group of newJournalBlocks) {
    alreadyDone = alreadyDone || recursivelyCheckForRegexInBlock(group, transferDoneRegexp);;
  }

  if (!alreadyDone) {
    logseq.showMainUI();

    let newJournalLastBlock;
    newJournalLastBlock = await getLastBlock(newJournal.name);
    if (newJournalLastBlock) {
      // apply Template if configured
      if (logseq.settings!.journalTemplate) {
        await logseq.Editor.exitEditingMode();
        let myTemplate;
        myTemplate = logseq.settings!.journalTemplate;
        if (myTemplate)
          await insertTemplateBlock(newJournalLastBlock.uuid, myTemplate);
      }
    }
    await delay(200);

    // tag page with special String to indicate for today that we transferred all todos and applied templates
    await logseq.Editor.exitEditingMode();
    await logseq.Editor.prependBlockInPage(newJournal.name, transferDoneString);
    await delay(200);

    const prevJournals = await queryCurrentRepoRangeJournals(newJournal['journalDay']);
    try {
      const latestJournal = prevJournals.reduce(
        (prev, current) => prev['journal-day'] > current['journal-day'] ? prev : current
      );

      await delay(200);

      await logseq.Editor.exitEditingMode();
      const latestJournalBlocks = await logseq.Editor.getPageBlocksTree(latestJournal.name);
      // transfer undone TODOs from previous journal
      newJournalLastBlock = await getLastBlock(newJournal.name);
      if (newJournalLastBlock) {
        for (let group of latestJournalBlocks) {
          if (group.content !== '') {
              newJournalLastBlock = await recursiveTransferTODOs(group, newJournalLastBlock, false);
              await recursiveCleanupNotTODOs(group);
          }
        }
        await logseq.Editor.insertBlock(newJournalLastBlock.uuid,'');
      }
    } catch (e) { };

    logseq.UI.showMsg(`${t("Todays Journal page updated")}`, "success", { timeout: 2200 })
    console.debug("Todays Journal page updated");
    setTimeout(() =>
      logseq.hideMainUI(), 200)
  }
}

async function recursiveTransferTODOs(srcBlock: BlockEntity, lastDestBlock: BlockEntity, hasParentTodo: boolean) {
  let hasChildTodo = recursivelyCheckForRegexInBlock(srcBlock, todoRegex);
  hasParentTodo = hasParentTodo || todoRegex.test(srcBlock.content);

  if (!(checkIgnore(srcBlock)) && (hasParentTodo || hasChildTodo)) {
    let newBlock;
    newBlock = lastDestBlock;
    if (lastDestBlock && lastDestBlock.uuid && lastDestBlock.content !== '') {
      newBlock = await logseq.Editor.insertBlock(lastDestBlock.uuid, srcBlock.content, {
        sibling: true,
      });
    } else {
      await logseq.Editor.updateBlock(lastDestBlock.uuid, srcBlock.content);
      newBlock.content = srcBlock.content; // update doesn't update the instance.
    }

    if (newBlock && srcBlock.children && srcBlock.children.length > 0) {
      let newChildBlock;
      newChildBlock = await logseq.Editor.insertBlock(newBlock.uuid, '');
      if (newChildBlock)  {
        const firstChildBlockUUID = newChildBlock.uuid;
        for (let child of srcBlock.children) {
          if (isBlockEntity(child)) {
            newChildBlock = await recursiveTransferTODOs(child, newChildBlock, hasParentTodo);
          }
        }
        if (newChildBlock.uuid === firstChildBlockUUID && newChildBlock.content === '') {
          await logseq.Editor.removeBlock(newChildBlock.uuid);
        }
      }
    }
    return newBlock;
  } else {
    return lastDestBlock;
  }
}

function recursiveCleanupNotTODOs(srcBlock: BlockEntity | BlockUUIDTuple): boolean {
  if (isBlockEntity(srcBlock)) {
    let hadChilds = srcBlock.children?srcBlock.children.length:0;
    let transferDoneString =
      (logseq.settings!.transferDoneString)?logseq.settings!.transferDoneString:transferDone;

    let removedChilds = 0
    if (!(checkIgnore(srcBlock))) {
      if (srcBlock.children) {
        srcBlock.children.map(child => {
          if (recursiveCleanupNotTODOs(child)) {
            removedChilds++;
          }
        });
      }
      if (todoRegex.test(srcBlock.content) || srcBlock.content == "" || (hadChilds && removedChilds == hadChilds)) {
        logseq.Editor.removeBlock(srcBlock.uuid);
        return true;
      }
    }

    let string1 = commentStart + transferDoneString + commentEnd;
    let string2 = smallIndicatorStart + transferDoneString + smallIndicatorEnd;
    logseq.Editor.updateBlock(
      srcBlock.uuid, srcBlock.content.replace(string1, "").replace(string2, "")
    );
  }
  return false;
};

async function updatePage() {
  console.debug("starting updatePage");
  let config = await logseq.App.getUserConfigs();
  let page = await logseq.Editor.getPage(format(new Date(), config.preferredDateFormat));
  if(!page) {
    console.debug("Create new Journal");
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
  if(page) {
    await updateNewJournalWithAllTODOs(page);
  }
}

async function main() {
  let config = await logseq.App.getUserConfigs();

  await l10nSetup({
    builtinTranslations: {//Full translations
      de
    }
  })

  /* user settings */
  await logseq.useSettingsSchema(settingsTemplate());

  let checkingIntervalTime = parseInt(logseq.settings!.checkingInterval! + "") * 1000;
  let checkingInterval = setInterval(updatePage, checkingIntervalTime?checkingIntervalTime:60000);

  logseq.onSettingsChanged(async (newSet: LSPluginBaseInfo['settings'], oldSet: LSPluginBaseInfo['settings']) => {
      if (newSet.checkingInterval !== oldSet.checkingInterval) {
        let checkingIntervalTime = parseInt(newSet.checkingInterval + "") * 1000;
        clearInterval(checkingInterval);
        checkingInterval = setInterval(updatePage, checkingIntervalTime?checkingIntervalTime:60000);
      }
      if (newSet.transferDoneString !== oldSet.transferDoneString){
        let page = await logseq.Editor.getPage(format(new Date(), config.preferredDateFormat));
        if(page) {
          replaceBlockString(page,
                            buildTransferDoneString(oldSet.transferDoneString),
                            buildTransferDoneString(newSet.transferDoneString)
                            );
        }
      }
     if (newSet.dontTransferString !== oldSet.dontTransferString){
        let page = await logseq.Editor.getPage(format(new Date(), config.preferredDateFormat));
        if(page) {
          replaceBlockString(page,
                             (oldSet.dontTransferString)?oldSet.dontTransferString:ignoreTodos,
                             (newSet.dontTransferString)?newSet.dontTransferString:ignoreTodos);
        }
      }
    }
  );
}

// bootstrap
logseq.ready(main).catch(null)
