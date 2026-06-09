import * as vscode from 'vscode';
import * as path from 'path';

// VSCode names the paste artifact image.png, then image copy.png, image copy 2.png …
const ARTIFACT_RE = /^image( copy( \d+)?)?\.png$/;

let output: vscode.OutputChannel;

// Per-directory serialization so a multi-paste burst doesn't assign the same number twice.
const dirQueues = new Map<string, Promise<void>>();

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('Screenshot Renamer');
  context.subscriptions.push(output);
  output.appendLine('[activate] listening on onDidCreateFiles');

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((e) => {
      for (const uri of e.files) {
        // Spike logging: confirms the event fires on Explorer paste and reveals real naming.
        output.appendLine(`[created] base=${path.posix.basename(uri.path)}  ${uri.toString()}`);
        handleCreated(uri);
      }
    })
  );
}

export function deactivate(): void {
  /* no-op */
}

function watchedFolderSetting(): string {
  return vscode.workspace
    .getConfiguration('screenshotRenamer')
    .get<string>('watchedFolder', '')
    .trim();
}

// True when uri lives inside <anyWorkspaceFolder>/<watchedFolder> or a subfolder of it.
function isInsideWatched(uri: vscode.Uri): boolean {
  const watched = watchedFolderSetting();
  if (!watched) {
    return false;
  }
  const segments = watched.split(/[\\/]+/).filter(Boolean);
  for (const wf of vscode.workspace.workspaceFolders ?? []) {
    if (wf.uri.scheme !== uri.scheme || wf.uri.authority !== uri.authority) {
      continue;
    }
    const root = path.posix.join(wf.uri.path, ...segments);
    const rel = path.posix.relative(root, uri.path);
    if (rel !== '' && !rel.startsWith('..') && !path.posix.isAbsolute(rel)) {
      return true;
    }
  }
  return false;
}

function handleCreated(uri: vscode.Uri): void {
  if (!ARTIFACT_RE.test(path.posix.basename(uri.path))) {
    return;
  }
  if (!isInsideWatched(uri)) {
    return;
  }
  enqueue(uri);
}

function enqueue(uri: vscode.Uri): void {
  const dirUri = uri.with({ path: path.posix.dirname(uri.path) });
  const key = dirUri.toString();
  const prev = dirQueues.get(key) ?? Promise.resolve();
  const next = prev
    .then(() => renameOne(uri))
    .catch((err) => output.appendLine(`[error] ${err?.message ?? err}`));
  dirQueues.set(
    key,
    next.finally(() => {
      if (dirQueues.get(key) === next) {
        dirQueues.delete(key);
      }
    })
  );
}

async function renameOne(src: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.stat(src);
  } catch {
    return; // already gone (e.g. moved by the user)
  }
  const dirUri = src.with({ path: path.posix.dirname(src.path) });
  const date = todayStamp();
  const n = await nextNumber(dirUri, date);
  const newName = `${date}-${String(n).padStart(2, '0')}.png`;
  const dst = dirUri.with({ path: path.posix.join(dirUri.path, newName) });
  await vscode.workspace.fs.rename(src, dst, { overwrite: false });
  output.appendLine(`[renamed] ${path.posix.basename(src.path)} -> ${newName}`);
  showToast(src, dst);
}

async function nextNumber(dirUri: vscode.Uri, date: string): Promise<number> {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(dirUri);
  } catch {
    return 1;
  }
  const re = new RegExp(`^${date}-(\\d+)\\.png$`);
  let max = 0;
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File) {
      continue;
    }
    const m = re.exec(name);
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return max + 1;
}

function todayStamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function showToast(original: vscode.Uri, renamed: vscode.Uri): void {
  const oldName = path.posix.basename(original.path);
  const newName = path.posix.basename(renamed.path);
  void vscode.window.showInformationMessage(`${oldName} → ${newName}`, 'Отменить').then((choice) => {
    if (choice !== 'Отменить') {
      return;
    }
    void vscode.workspace.fs.rename(renamed, original, { overwrite: false }).then(
      () => output.appendLine(`[undo] ${newName} -> ${oldName}`),
      (err) => vscode.window.showErrorMessage(`Не удалось отменить: ${err?.message ?? err}`)
    );
  });
}
