import { ADDRESS_CLAMP_TO_EDGE, BLEND_NONE, BLEND_NORMAL, Color, Entity, FILTER_NEAREST, StandardMaterial, Texture } from '../viewport/viewport-engine';

editor.once('load', () => {
    let app;
    let iconsEntity;
    const textureNames = ['animation', 'audiolistener', 'audiosource', 'sound', 'camera', 'collision', 'light-point', 'light-directional', 'light-spot', 'particlesystem', 'rigidbody', 'script', 'unknown'];
    const components = ['camera', 'light', 'audiolistener', 'audiosource', 'sound', 'particlesystem', 'script', 'animation', 'model'];
    const icons = [];
    const pool = [];
    const dirtifyKeys = [
        'enabled:set',
        'components.model.type:set',
        'components.model.asset:set'
    ];
    const dirtifyLocalKeys = {
        'light': [
            'components.light.color.0:set',
            'components.light.color.1:set',
            'components.light.color.2:set',
            'components.light.type:set'
        ]
    };
    const materials = new Map();
    const materialsBehind = new Map();
    let scale = 0.5;
    const ICON_ALPHA_TEST = 0.05;
    const ICON_BEHIND_OPACITY = 0.25;

    const ensureIconForObserver = (obj: import('@playcanvas/observer').Observer | null | undefined) => {
        if (!obj || !obj.get) {
            return;
        }

        const resourceId = obj.get('resource_id');
        if (!resourceId) {
            return;
        }

        const existing = icons.find((icon) => {
            return icon._link?.get?.('resource_id') === resourceId;
        });
        if (existing) {
            existing.dirty = true;
            return;
        }

        let icon = pool.shift();
        if (!icon) {
            icon = new ViewportIcon();
        }

        icon.link(obj);
    };

    const createMaterial = (options) => {
        const material = new StandardMaterial();
        material.emissive = Color.WHITE;
        material.opacityMapChannel = 'b';
        material.alphaTest = ICON_ALPHA_TEST;
        Object.assign(material, options);
        material.update();
        return material;
    };

    class ViewportIcon {
        entity: any = null;

        behind: any = null;

        _link: any = null;

        events: any[] = [];

        eventsLocal: any[] = [];

        local = '';

        dirty = true;

        dirtify = () => {
            this.dirty = true;
        };

        entityCreate() {
            if (this.entity || !app) {
                return;
            }

            this.entity = new Entity('front', app);
            this.entity._icon = true;
            this.entity._getEntity = () => {
                return this._link && this._link.entity || null;
            };

            const layerFront = editor.call('gizmo:layers', 'Bright Gizmo');
            const layerBehind = editor.call('gizmo:layers', 'Dim Gizmo');

            this.entity.addComponent('render', {
                type: 'plane',
                castShadows: false,
                receiveShadows: false,
                castShadowsLightmap: false,
                layers: [layerFront.id]
            });
            this.entity.render.meshInstances[0].__editor = true;

            if (this._link && this._link.entity) {
                this.entity.setPosition(this._link.entity.getPosition());
            }

            this.entity.setLocalScale(scale, scale, scale);
            this.entity.setRotation(editor.call('camera:current').getRotation());
            this.entity.rotateLocal(90, 0, 0);

            this.behind = new Entity('behind', app);
            this.behind._icon = true;
            this.behind._getEntity = this.entity._getEntity;
            this.entity.addChild(this.behind);
            this.behind.addComponent('render', {
                type: 'plane',
                castShadows: false,
                receiveShadows: false,
                castShadowsLightmap: false,
                layers: [layerBehind.id]
            });
            this.behind.render.meshInstances[0].pick = false;

            iconsEntity.addChild(this.entity);
        }

        entityDelete() {
            if (!this.entity) {
                return;
            }

            this.entity.destroy();

            this.entity = null;
            this.behind = null;
        }

        update() {
            if (!this._link || !this._link.entity) {
                return;
            }

            // don't render if selected or disabled
            if (!this._link.entity._enabled || !this._link.entity._enabledInHierarchy || this._link.entity.__noIcon || scale === 0) {
                if (this.entity) {
                    this.entityDelete();
                }

                this.dirty = true;
                return;
            }

            if (this.entity) {
                // position
                this.entity.setPosition(this._link.entity.getPosition());
                this.entity.setLocalScale(scale, scale, scale);
                this.entity.setRotation(editor.call('camera:current').getRotation());
                this.entity.rotateLocal(90, 0, 0);
            }

            if (!this.dirty) {
                return;
            }
            this.dirty = false;

            // hide icon if model is set
            if (this._link.has('components.model') && this._link.get('components.model.enabled') && (this._link.get('components.model.type') !== 'asset' || this._link.get('components.model.asset'))) {
                if (this.entity) {
                    this.entityDelete();
                }
                return;
            }

            // hide icon if element is set
            if (this._link.has('components.element') && this._link.get('components.element.enabled')) {
                if (this.entity) {
                    this.entityDelete();
                }
                return;
            }

            // Find the first component that should display an icon (priority order)
            const component = components.find(c => this._link.has(`components.${c}`)) || '';

            if (component) {
                let textureName = component;
                if (component === 'light') {
                    const lightType = this._link.entity.light?.type || this._link.get('components.light.type') || 'point';
                    textureName += `-${lightType}`;
                }

                let material = materials.get(textureName);
                let materialBehind = materialsBehind.get(textureName);
                if (!material) {
                    material = materials.get('unknown');
                    materialBehind = materialsBehind.get('unknown');
                }

                // Don't render icon until texture has loaded
                if (!material || !material.opacityMap) {
                    if (this.entity) {
                        this.entityDelete();
                    }
                    this.dirty = true;
                    return;
                }

                if (!this.entity) {
                    this.entityCreate();
                }

                this.entity.enabled = true;
                this.entity.render.material = material;
                this.behind.render.material = materialBehind;

                // Update light color if needed
                if (component === 'light') {
                    const lightColor = this._link.entity.light?.color;
                    const observerColor = this._link.get('components.light.color');
                    const emissive = lightColor
                        ? [lightColor.r, lightColor.g, lightColor.b]
                        : Array.isArray(observerColor)
                            ? [
                                Number(observerColor[0] ?? 1),
                                Number(observerColor[1] ?? 1),
                                Number(observerColor[2] ?? 1)
                            ]
                            : [1, 1, 1];
                    this.entity.render.meshInstances[0].setParameter('material_emissive', emissive);
                    this.behind.render.meshInstances[0].setParameter('material_emissive', emissive);
                }

                if (this.local !== component) {
                    // clear local binds
                    this.eventsLocal.forEach(evt => evt.unbind());
                    this.eventsLocal = [];

                    // add local binds
                    if (dirtifyLocalKeys[component]) {
                        dirtifyLocalKeys[component].forEach((key) => {
                            this.eventsLocal.push(this._link.on(key, this.dirtify));
                        });
                    }

                    this.local = component;
                }
            } else if (this.entity) {
                this.entityDelete();
            }
        }

        link(obj: import('@playcanvas/observer').Observer) {
            this.unlink();

            this._link = obj;
            dirtifyKeys.forEach((key) => {
                this.events.push(obj.on(key, this.dirtify));
            });

            components.forEach((component) => {
                this.events.push(obj.on(`components.${component}:set`, this.dirtify));
                this.events.push(obj.on(`components.${component}:unset`, this.dirtify));
            });

            this.events.push(obj.once('destroy', () => {
                this.unlink();
            }));

            icons.push(this);

            this.dirty = true;
        }

        unlink() {
            if (!this._link) {
                return;
            }

            this.events.forEach(evt => evt.unbind());
            this.eventsLocal.forEach(evt => evt.unbind());

            if (this.entity) {
                this.entityDelete();
            }

            this.events = [];
            this.eventsLocal = [];
            this.local = '';
            this._link = null;

            const ind = icons.indexOf(this);
            icons.splice(ind, 1);
            pool.push(this);
        }
    }

    editor.once('viewport:load', (application) => {
        app = application;

        iconsEntity = new Entity(app);
        app.root.addChild(iconsEntity);

        textureNames.forEach((textureName) => {
            const material = createMaterial({
                blendType: BLEND_NONE,
                depthTest: true,
                depthWrite: true
            });
            materials.set(textureName, material);

            const materialBehind = createMaterial({
                opacity: ICON_BEHIND_OPACITY,
                blendType: BLEND_NORMAL,
                depthTest: false,
                depthWrite: false
            });
            materialsBehind.set(textureName, materialBehind);

            // Load texture and set opacityMap when ready
            const img = new Image();
            img.onload = () => {
                const texture = new Texture(app.graphicsDevice, {
                    addressU: ADDRESS_CLAMP_TO_EDGE,
                    addressV: ADDRESS_CLAMP_TO_EDGE,
                    minFilter: FILTER_NEAREST,
                    magFilter: FILTER_NEAREST
                });
                texture.setSource(img);
                material.opacityMap = texture;
                material.update();
                materialBehind.opacityMap = texture;
                materialBehind.update();
                editor.call('viewport:render');
            };
            img.onerror = (event) => {
                // Log image loading errors so missing icons don't fail silently
                console.error(`Failed to load entity icon texture "${textureName}" from`, img.src, event);
            };
            img.src = `/editor/scene/img/entity-icons/${textureName}.png`;
        });

        (editor.call('entities:list') || []).forEach((obj) => {
            ensureIconForObserver(obj);
        });

        editor.on('entities:add', ensureIconForObserver);
        editor.on('entities:add:entity', ensureIconForObserver);
    });

    editor.on('viewport:postUpdate', () => {
        icons.forEach(icon => icon.update());
    });

    editor.method('viewport:icons:size', (size) => {
        if (size === undefined) {
            return scale;
        }

        scale = size;
        editor.call('viewport:render');
    });

    const settings = editor.call('settings:user');
    editor.call('viewport:icons:size', settings.get('editor.iconSize'));
    settings.on('editor.iconSize:set', (size) => {
        editor.call('viewport:icons:size', size);
    });
});
