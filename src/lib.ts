import {BlockEntity, BlockUUIDTuple, PageEntity} from '@logseq/libs/dist/LSPlugin.user';
import { ignoreTodos } from './settings'
import { t } from 'logseq-l10n'

export function checkIgnore(srcBlock) {
  let ignoreRegex =  new RegExp(escapeRegExp(ignoreTodos));
  return ignoreRegex.test(srcBlock.content);
}

export function escapeRegExp(inputString: string) {
    return inputString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isBlockEntity(b: BlockEntity | BlockUUIDTuple): b is BlockEntity {
  return (b as BlockEntity).uuid !== undefined;
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
  // logseq.showMainUI()

  // logseq.Editor.updateBlock(blockUuid, "")
  const exist = await logseq.App.existTemplate(template) as boolean
  if (exist === true) {
    logseq.UI.showMsg(`${t("Insert template")} "${template}"`, "success", { timeout: 2200 })
    const newBlock = await logseq.Editor.insertBlock(blockUuid, "", { sibling: true, isPageBlock: true, before: true, focus: false })
    if (newBlock) {
      logseq.App.insertTemplate(newBlock.uuid, template).finally(() => {
        console.log(`Render insert template ${template}`)
        logseq.Editor.removeBlock(blockUuid)
        setTimeout(() =>
          logseq.Editor.exitEditingMode(), 100)
      })
    }
  } else {
    logseq.UI.showMsg(t("The Template not found."), "warming", { timeout: 5000 })
    console.warn(`Template "${template}" not found.`)
  }

  setTimeout(() =>
    logseq.hideMainUI(), 200)
}

