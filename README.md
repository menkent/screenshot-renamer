# Screenshot Renamer

VS Code-расширение, которое в remote-режиме (Remote-SSH / Tunnel) переименовывает
картинки, вставленные из буфера обмена в дерево файлов (Explorer), давая им
осмысленные имена по дате и порядковому номеру.

## Зачем

При вставке картинки из буфера в Explorer VS Code сам создаёт файл `image.png`
(а при повторе — `image copy.png`, `image copy 2.png`). Расширение ловит этот файл
и переименовывает его в `YYYY-MM-DD-NN.png`, например `2026-06-09-01.png`.

Работает в remote-воркспейсах: байты картинки на удалённый хост перебрасывает само
ядро VS Code, поэтому локальная ОС значения не имеет (macOS / Windows / Linux).

## Как работает

- Переименование активно **только внутри одной настроенной папки и её подпапок**
  (`screenshotRenamer.watchedFolder`). За её пределами расширение не вмешивается.
- Файл остаётся там, где вставлен — меняется только имя.
- Номер — порядковый за календарный день в пределах конкретной подпапки
  (считается сканированием папки, состояние нигде не хранится).
- После переименования показывается тост `старое → новое` с кнопкой **«Отменить»**.

## Настройка

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `screenshotRenamer.watchedFolder` | `docs-agents/screens` | Папка относительно корня воркспейса. Пусто = выключено. |

## Install

Расширение пакуется в `.vsix` и ставится один раз на инстанс VS Code (включая
Remote-SSH / vscode-server хост, где расширение и работает).

```bash
npm install            # зависимости
npm run deploy         # сборка, упаковка в screenshot-renamer.vsix и установка
```

`npm run deploy` ставит расширение в инстанс, доступный через `code` CLI. После
установки выполните **Developer: Reload Window**.

Поставить вручную из готового пакета:

```bash
code --install-extension screenshot-renamer.vsix --force
```

Удалить: `code --uninstall-extension local.screenshot-renamer`.

## Build & release

| Команда | Описание |
|---------|----------|
| `npm run compile` | Dev-сборка `dist/extension.js` |
| `npm run watch` | Пересборка при изменениях |
| `npm run check-types` | Проверка типов без эмита |
| `npm run bump:patch` / `bump:minor` | Поднять версию в `package.json` |
| `npm run vsix` | Production-сборка в `screenshot-renamer.vsix` |
| `npm run deploy` | `vsix` + установка через `code` CLI |
| `npm run release` | `npm version patch` + `git push --follow-tags` (триггерит релиз в CI) |

Пуш тега `v*` в GitHub собирает `.vsix` и публикует его в GitHub Release
(см. `.github/workflows/build.yml`).
