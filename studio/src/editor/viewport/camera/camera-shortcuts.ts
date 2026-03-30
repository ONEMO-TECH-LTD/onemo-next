editor.once('load', () => {
    // R3F viewport camera preset shortcuts. These drive the visible overlay camera
    // rather than the hidden legacy engine canvas camera.

    const presetCallback = function (name: 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' | 'perspective'): () => void {
        return function () {
            if (editor.call('picker:isOpen')) {
                return;
            }

            editor.emit('r3f:viewer:cameraPreset', name);
        };
    };

    editor.call('hotkey:register', 'camera:front', {
        key: '1',
        numpadOnly: true,
        callback: presetCallback('front')
    });

    editor.call('hotkey:register', 'camera:back', {
        key: '1',
        ctrl: true,
        numpadOnly: true,
        callback: presetCallback('back')
    });

    editor.call('hotkey:register', 'camera:right', {
        key: '3',
        numpadOnly: true,
        callback: presetCallback('right')
    });

    editor.call('hotkey:register', 'camera:left', {
        key: '3',
        ctrl: true,
        numpadOnly: true,
        callback: presetCallback('left')
    });

    editor.call('hotkey:register', 'camera:top', {
        key: '7',
        numpadOnly: true,
        callback: presetCallback('top')
    });

    editor.call('hotkey:register', 'camera:bottom', {
        key: '7',
        ctrl: true,
        numpadOnly: true,
        callback: presetCallback('bottom')
    });

    let lastOrthoPreset: 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' = 'front';
    let inPerspective = true;

    editor.call('hotkey:register', 'camera:toggle-projection', {
        key: '5',
        numpadOnly: true,
        callback: function () {
            if (editor.call('picker:isOpen')) {
                return;
            }

            if (inPerspective) {
                editor.emit('r3f:viewer:cameraPreset', lastOrthoPreset);
            } else {
                editor.emit('r3f:viewer:cameraPreset', 'perspective');
            }
            inPerspective = !inPerspective;
        }
    });

    editor.call('hotkey:register', 'camera:perspective', {
        key: '0',
        numpadOnly: true,
        callback: function () {
            if (editor.call('picker:isOpen')) {
                return;
            }

            inPerspective = true;
            editor.emit('r3f:viewer:cameraPreset', 'perspective');
        }
    });

    editor.on('r3f:viewer:cameraPreset', (preset: string) => {
        if (preset === 'front' || preset === 'back' || preset === 'right' || preset === 'left' || preset === 'top' || preset === 'bottom') {
            lastOrthoPreset = preset;
        }
    });
});
