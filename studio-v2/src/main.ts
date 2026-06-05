import * as THREE from 'three';

import { Editor } from '../editor-js/Editor.js';
import { Viewport } from '../editor-js/Viewport.js';
import { Toolbar } from '../editor-js/Toolbar.js';
import { Script } from '../editor-js/Script.js';
import { Player } from '../editor-js/Player.js';
import { Sidebar } from '../editor-js/Sidebar.js';
import { Menubar } from '../editor-js/Menubar.js';
import { Resizer } from '../editor-js/Resizer.js';
import { AnimationResizer } from '../editor-js/AnimationResizer.js';
import { Animation } from '../editor-js/Animation.js';

import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

type EditorWindow = Window &
  typeof globalThis & {
    editor: unknown;
    THREE: typeof THREE;
    URL: typeof URL;
    webkitURL?: typeof URL;
    BlobBuilder?: unknown;
    WebKitBlobBuilder?: unknown;
    MozBlobBuilder?: unknown;
  };

const studioWindow = window as EditorWindow;

studioWindow.URL = studioWindow.URL || studioWindow.webkitURL || URL;
studioWindow.BlobBuilder =
  studioWindow.BlobBuilder || studioWindow.WebKitBlobBuilder || studioWindow.MozBlobBuilder;

const editor = new Editor();

studioWindow.editor = editor;
studioWindow.THREE = THREE;

const objectLoaderRegistry = THREE.ObjectLoader as typeof THREE.ObjectLoader & {
  registerGeometry?: (type: string, geometry: typeof TextGeometry) => void;
};
objectLoaderRegistry.registerGeometry?.('TextGeometry', TextGeometry);

const viewport = new Viewport(editor);
document.body.appendChild(viewport.dom);

const toolbar = new Toolbar(editor);
document.body.appendChild(toolbar.dom);

const script = new Script(editor);
document.body.appendChild(script.dom);

const player = new Player(editor);
document.body.appendChild(player.dom);

const sidebar = new Sidebar(editor);
document.body.appendChild(sidebar.dom);

const menubar = new Menubar(editor);
document.body.appendChild(menubar.dom);

const resizer = new Resizer(editor);
document.body.appendChild(resizer.dom);

const animation = new Animation(editor);
document.body.appendChild(animation.dom);

const animationResizer = new AnimationResizer(editor);
document.body.appendChild(animationResizer.dom);

editor.signals.animationPanelChanged.add((height: number | false) => {
  const visible = height !== false;

  viewport.dom.classList.toggle('with-animation', visible);
  toolbar.dom.classList.toggle('with-animation', visible);

  if (visible) {
    viewport.dom.style.bottom = `${height}px`;
    toolbar.dom.style.bottom = `${height + 20}px`;
  } else {
    viewport.dom.style.bottom = '';
    toolbar.dom.style.bottom = '';
  }

  editor.signals.windowResize.dispatch();
});

let isLoadingFromHash = false;

editor.storage.init(() => {
  editor.storage.get(async (state: unknown) => {
    if (isLoadingFromHash) return;

    if (state !== undefined) {
      await editor.fromJSON(state);
    } else {
      editor.signals.sceneEnvironmentChanged.dispatch('Default');
    }

    const selected = editor.config.getKey('selected');

    if (selected !== undefined) {
      editor.selectByUuid(selected);
    }
  });

  let timeout: number | undefined;

  function saveState() {
    if (editor.config.getKey('autosave') === false) {
      return;
    }

    clearTimeout(timeout);

    timeout = window.setTimeout(() => {
      editor.signals.savingStarted.dispatch();

      timeout = window.setTimeout(() => {
        editor.storage.set(editor.toJSON());
        editor.signals.savingFinished.dispatch();
      }, 100);
    }, 1000);
  }

  const signals = editor.signals;

  signals.geometryChanged.add(saveState);
  signals.objectAdded.add(saveState);
  signals.objectChanged.add(saveState);
  signals.objectRemoved.add(saveState);
  signals.materialChanged.add(saveState);
  signals.sceneBackgroundChanged.add(saveState);
  signals.sceneEnvironmentChanged.add(saveState);
  signals.sceneFogChanged.add(saveState);
  signals.sceneGraphChanged.add(saveState);
  signals.scriptChanged.add(saveState);
  signals.historyChanged.add(saveState);
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
});

document.addEventListener('drop', (event) => {
  event.preventDefault();

  if (!event.dataTransfer) return;
  if (event.dataTransfer.types[0] === 'text/plain') return;

  if (event.dataTransfer.items) {
    editor.loader.loadItemList(event.dataTransfer.items);
  } else {
    editor.loader.loadFiles(event.dataTransfer.files);
  }
});

function onWindowResize() {
  editor.signals.windowResize.dispatch();
}

window.addEventListener('resize', onWindowResize);

onWindowResize();

const hash = window.location.hash;

if (hash.slice(1, 6) === 'file=') {
  const file = hash.slice(6);

  if (confirm(editor.strings.getKey('prompt/file/open'))) {
    const loader = new THREE.FileLoader();
    loader.crossOrigin = '';
    loader.load(file, (text) => {
      editor.clear();
      editor.fromJSON(JSON.parse(text));
    });

    isLoadingFromHash = true;
  }
}
