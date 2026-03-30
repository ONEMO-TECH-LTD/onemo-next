editor.once('load', () => {
    const noop = () => {};
    const noopFalse = () => false;
    const noopTrue = () => true;
    const noopNull = () => null;
    const identity = <T>(value: T) => value;

    [
        'picker:versioncontrol',
        'picker:versioncontrol:mergeOverlay',
        'picker:versioncontrol:mergeOverlay:hide',
        'vcgraph:showGraphPanel',
        'vcgraph:closeGraphPanel',
        'vcgraph:moveToBackground',
        'vcgraph:moveToForeground',
        'vcgraph:showInitial',
        'vcgraph:showNodeMenu',
        'vcgraph:placeVcNodes',
        'vcgraph:compactBranches',
        'vcgraph:verticalConsistency'
    ].forEach((method) => {
        editor.method(method, noop);
    });

    editor.method('picker:versioncontrol:isErrorWidgetVisible', noopFalse);
    editor.method('picker:versioncontrol:isProgressWidgetVisible', noopFalse);
    editor.method('picker:versioncontrol:transformCheckpointData', identity);

    editor.method('vcgraph:isHidden', noopTrue);
    editor.method('vcgraph:makeNodeMenu', noopNull);
    editor.method('vcgraph:getAllStyles', () => []);
    editor.method('vcgraph:numStyles', () => 0);
    editor.method('vcgraph:splitNodeDescription', (value: string) => value);
    editor.method('vcgraph:syncHistGraph', noopNull);
    editor.method('vcgraph:makeHistGraph', noopNull);
    editor.method('vcgraph:utils', noopNull);
});
