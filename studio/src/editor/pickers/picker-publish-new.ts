/**
 * Legacy PlayCanvas publish/download build UI — stubbed for ONEMO Studio (no external publishing).
 */
editor.once('load', () => {
    const noop = () => {};

    editor.method('picker:publish:new', noop);
    editor.method('picker:publish:download', noop);
    editor.method('picker:publish', noop);
});
