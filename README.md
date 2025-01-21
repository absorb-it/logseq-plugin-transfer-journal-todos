# logseq-plugin-transfer-journal-todos

This plugin has two functions:
* Every time a new journal is created - it moves all the unfinished tasks from the last journal to the new journal
  * it keeps the tree's information structure valid, probably doubling parent nodes
* Calls a Template only once and only when journal is the one of the current day
  * this way you can use daily templates and the agenda to plan your future jobs
  
This plugin combines both features, because modifying and moving TODOs between journals might collide with templates getting applied in the same moment

The plugin skeleton and a lot of othe features are copy/pasted from
  * https://github.com/ehudhala/logseq-plugin-daily-todo
  * https://github.com/YU000jp/logseq-plugin-weekdays-and-weekends
  * https://github.com/alecdibble/logseq-journal-auto-copier
  * https://github.com/vipzhicheng/logseq-plugin-move-block

The Icon was retrieved from https://icon-library.com/icon/todo-icon-27.html.html>Todo Icon # 395663
  
Please note: this plugin is very specific to how I manage tasks in Logseq, and the code is still in an experimental but working state.
Suggestions and improvements are welcome.

## Usage

...

## Installation

pnpm build

### Preparation

### Install plugins from Marketplace (recommended)

### Install plugins manually

* Download released version assets from Github.
* Unzip it.
* Click `Load unpacked plugin`, and select destination directory to the unziped folder.

## Licence
MIT
