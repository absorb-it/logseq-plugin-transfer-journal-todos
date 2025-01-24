import {BlockEntity, BlockUUIDTuple, PageEntity} from '@logseq/libs/dist/LSPlugin.user';
import { commentStart, commentEnd, smallIndicatorStart, smallIndicatorEnd, transferDone, ignoreTodos } from './settings'
import { t } from 'logseq-l10n'

export function checkIgnore(srcBlock) {
  let ignoreString:string =
      ((logseq.settings!.dontTransferString)?logseq.settings!.dontTransferString:ignoreTodos) + "";

  let ignoreRegex =  new RegExp(escapeRegExp(ignoreString));
  return ignoreRegex.test(srcBlock.content);
}

export function escapeRegExp(inputString: string) {
    return inputString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isBlockEntity(b: BlockEntity | BlockUUIDTuple): b is BlockEntity {
  return (b as BlockEntity).uuid !== undefined;
}

export function buildTransferDoneString(inputString: any) {
  let transferDoneString =
      ((logseq.settings!.transferDoneComment)?commentStart:smallIndicatorStart) +
      ((inputString)?inputString:transferDone) +
      ((logseq.settings!.transferDoneComment)?commentEnd:smallIndicatorEnd);
  return transferDoneString;
}


export async function replaceBlockString(newJournal: PageEntity, oldString, newString) {
  const blocks = await logseq.Editor.getPageBlocksTree(newJournal.name);

  for (let group of blocks) {
    recursivelyReplaceStringInBlock(group, oldString, newString);
  }
}

export function recursivelyReplaceStringInBlock(block: BlockEntity | BlockUUIDTuple, oldString: string, newString: string) {
  if (isBlockEntity(block)) {
    if (block.children) {
      block.children.some(child => recursivelyReplaceStringInBlock(child, oldString, newString));
    };
    logseq.Editor.updateBlock(block.uuid, block.content.replace(oldString, newString));
  }
}

export function recursivelyCheckForRegexInBlock(block: BlockEntity | BlockUUIDTuple, regex: RegExp): boolean {
  if (isBlockEntity(block)) {
    if (block.children) {
      return regex.test(block.content) || block.children.some(child => recursivelyCheckForRegexInBlock(child, regex));
    } else {
      return regex.test(block.content)
    };
  }
  return false;
}

export async function getLastBlock(pageName: string) {
  const blocks = await logseq.Editor.getPageBlocksTree(pageName);
  if (blocks.length === 0) {
    return null;
  }
  return blocks[blocks.length - 1];
};

export async function insertTemplateBlock(blockUuid, template: string) {
  const exist = await logseq.App.existTemplate(template) as boolean
  if (exist === true) {
    logseq.UI.showMsg(`${t("Insert template")} "${template}"`, "success", { timeout: 2200 })
    const newBlock = await logseq.Editor.insertBlock(blockUuid, "", { sibling: true, isPageBlock: true, before: true, focus: false })
    if (newBlock) {
      logseq.App.insertTemplate(newBlock.uuid, template).finally(() => {
        console.debug(`Render insert template ${template}`)
        setTimeout(() =>
          logseq.Editor.exitEditingMode(), 100)
      })
    }
  } else {
    logseq.UI.showMsg(t("The Template not found."), "warming", { timeout: 5000 })
    console.warn(`Template "${template}" not found.`)
  }


}

