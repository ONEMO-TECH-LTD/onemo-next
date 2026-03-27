import { Pane, type FolderApi, type TabPageApi, type TpChangeEvent } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import type {
  StudioActionField,
  StudioBooleanField,
  StudioColorField,
  StudioControlRegistry,
  StudioField,
  StudioFileField,
  StudioNumberField,
  StudioSelectField,
  StudioTextField,
  StudioVec3Field,
} from '@/studio/controls/registry/types'

type PaneContainer = Pane | FolderApi | TabPageApi

interface StudioFieldBinding {
  path: string
  replaceField: (field: StudioField) => void
  sync: () => void
}

export interface StudioPaneController {
  schemaSignature: string
  dispose: () => void
  exportState: () => unknown
  importState: (state: unknown) => void
  sync: (registry: StudioControlRegistry) => void
}

function createReadonlyBinding<T extends string>(
  container: PaneContainer,
  params: { value: T },
  label: string,
){
  return container.addBinding(params, 'value', {
    label,
    readonly: true,
  })
}

function bindNumberField(container: PaneContainer, field: StudioNumberField): StudioFieldBinding {
  let currentField = field
  const params = { value: currentField.get() }

  const binding = container.addBinding(params, 'value', {
    label: currentField.label,
    min: currentField.min,
    max: currentField.max,
    step: currentField.step,
  }).on('change', (ev: TpChangeEvent<number>) => {
    currentField.set(ev.value)
    params.value = currentField.get()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioNumberField
    },
    sync() {
      params.value = currentField.get()
      binding.refresh()
    },
  }
}

function bindTextField(container: PaneContainer, field: StudioTextField): StudioFieldBinding {
  let currentField = field
  const params = { value: currentField.get() }

  const binding = container.addBinding(params, 'value', {
    label: currentField.label,
  }).on('change', (ev: TpChangeEvent<string>) => {
    currentField.set(ev.value)
    params.value = currentField.get()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioTextField
    },
    sync() {
      params.value = currentField.get()
      binding.refresh()
    },
  }
}

function bindColorField(container: PaneContainer, field: StudioColorField): StudioFieldBinding {
  let currentField = field
  const params = { value: currentField.get() }

  const binding = container.addBinding(params, 'value', {
    label: currentField.label,
    view: 'color',
  }).on('change', (ev: TpChangeEvent<string>) => {
    currentField.set(ev.value)
    params.value = currentField.get()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioColorField
    },
    sync() {
      params.value = currentField.get()
      binding.refresh()
    },
  }
}

function bindBooleanField(container: PaneContainer, field: StudioBooleanField): StudioFieldBinding {
  let currentField = field
  const params = { value: currentField.get() }

  const binding = container.addBinding(params, 'value', {
    label: currentField.label,
  }).on('change', (ev: TpChangeEvent<boolean>) => {
    currentField.set(ev.value)
    params.value = currentField.get()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioBooleanField
    },
    sync() {
      params.value = currentField.get()
      binding.refresh()
    },
  }
}

function bindSelectField(container: PaneContainer, field: StudioSelectField): StudioFieldBinding {
  let currentField = field
  const params = { value: currentField.get() }

  const binding = container.addBinding(params, 'value', {
    label: currentField.label,
    options: Object.fromEntries(currentField.options.map((option) => [option.label, option.value])),
  }).on('change', (ev: TpChangeEvent<string>) => {
    currentField.set(ev.value)
    params.value = currentField.get()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioSelectField
    },
    sync() {
      params.value = currentField.get()
      binding.refresh()
    },
  }
}

function bindVec3Field(container: PaneContainer, field: StudioVec3Field): StudioFieldBinding {
  let currentField = field
  const params = { value: { ...currentField.get() } }

  const binding = container.addBinding(params, 'value', {
    label: currentField.label,
    x: { min: currentField.min, max: currentField.max, step: currentField.step },
    y: { min: currentField.min, max: currentField.max, step: currentField.step },
    z: { min: currentField.min, max: currentField.max, step: currentField.step },
  } as Parameters<typeof container.addBinding>[2]).on('change', (ev: TpChangeEvent<{ x: number; y: number; z: number }>) => {
    currentField.set(ev.value)
    Object.assign(params.value, currentField.get())
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioVec3Field
    },
    sync() {
      Object.assign(params.value, currentField.get())
      binding.refresh()
    },
  }
}

function bindActionField(container: PaneContainer, field: StudioActionField): StudioFieldBinding {
  let currentField = field

  container.addButton({
    title: currentField.buttonTitle ?? currentField.label,
    label: currentField.label === currentField.buttonTitle || !currentField.buttonTitle ? undefined : currentField.label,
  }).on('click', async () => {
    await currentField.run()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioActionField
    },
    sync() {},
  }
}

function fileDisplayName(raw: string | undefined): string {
  if (!raw) return '—'
  // Show only the filename portion of a path
  const last = raw.split('/').pop() ?? raw
  return last.length > 22 ? '...' + last.slice(-20) : last
}

function bindFileField(container: PaneContainer, field: StudioFileField): StudioFieldBinding {
  let currentField = field

  // Single row: button whose title shows the current filename + "..." indicator
  const button = container.addButton({
    label: currentField.label,
    title: fileDisplayName(currentField.currentValue?.()) + '  …',
  }).on('click', async () => {
    await currentField.pick?.()
  })

  return {
    path: currentField.path,
    replaceField(nextField) {
      currentField = nextField as StudioFileField
    },
    sync() {
      // Tweakpane buttons don't expose a title setter; rebuild title via the element if possible
      try {
        const el = (button as unknown as { element: HTMLElement }).element
        const titleEl = el.querySelector('.tp-btnv_t') as HTMLElement | null
        if (titleEl) titleEl.textContent = fileDisplayName(currentField.currentValue?.()) + '  …'
      } catch {
        // Graceful fallback — title stays stale but binding still fires correctly
      }
    },
  }
}

function bindField(container: PaneContainer, field: StudioField): StudioFieldBinding {
  switch (field.kind) {
    case 'number':
      return bindNumberField(container, field)
    case 'text':
      return bindTextField(container, field)
    case 'color':
      return bindColorField(container, field)
    case 'boolean':
      return bindBooleanField(container, field)
    case 'select':
      return bindSelectField(container, field)
    case 'action':
      return bindActionField(container, field)
    case 'file':
      return bindFileField(container, field)
    case 'vec3':
      return bindVec3Field(container, field)
    default:
      return {
        path: (field as StudioField).path,
        replaceField() {},
        sync() {},
      }
  }
}

function collectFields(registry: StudioControlRegistry): StudioField[] {
  return registry.tabs.flatMap((tab) => tab.sections.flatMap((section) => section.fields))
}

function getTabTitle(tabId: string, tabTitle: string) {
  const fullTitles: Record<string, string> = {
    scene: 'Scene',
    materials: 'Material',
    environment: 'Environment',
    lights: 'Lighting',
    camera: 'Camera',
    image: 'Image',
    layout: 'Layout',
  }

  return fullTitles[tabId] ?? tabTitle
}

export function getStudioPaneSchemaSignature(registry: StudioControlRegistry) {
  return JSON.stringify({
    id: registry.id,
    title: registry.title,
    tabs: registry.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      sections: tab.sections.map((section) => ({
        id: section.id,
        title: section.title,
        expanded: section.defaultExpanded ?? true,
        fields: section.fields.map((field) => ({
          kind: field.kind,
          path: field.path,
          label: field.label,
          description: field.description,
          buttonTitle: field.kind === 'action' ? field.buttonTitle : field.kind === 'file' ? field.buttonTitle : undefined,
          accept: field.kind === 'file' ? field.accept : undefined,
          hasPicker: field.kind === 'file' ? Boolean(field.pick) : undefined,
          options: field.kind === 'select' ? field.options.map((option) => ({ label: option.label, value: option.value })) : undefined,
          vec3: field.kind === 'vec3' ? { min: field.min, max: field.max, step: field.step } : undefined,
        })),
      })),
    })),
  })
}

export function buildStudioPane(container: HTMLElement, registry: StudioControlRegistry): StudioPaneController {
  const pane = new Pane({
    container,
    title: registry.title,
  }) as Pane & {
    exportState: () => unknown
    importState: (state: unknown) => void
  }
  pane.registerPlugin(EssentialsPlugin)

  const bindings: StudioFieldBinding[] = []

  const tab = (pane as unknown as Pane & {
    addTab: (config: { pages: Array<{ title: string }> }) => { pages: TabPageApi[] }
  }).addTab({
    pages: registry.tabs.map((studioTab) => ({
      title: getTabTitle(studioTab.id, studioTab.title),
    })),
  })

  registry.tabs.forEach((studioTab, tabIndex) => {
    const page = tab.pages[tabIndex]
    studioTab.sections.forEach((section) => {
      const folder = page.addFolder({
        title: section.title,
        expanded: section.defaultExpanded ?? true,
      })
      section.fields.forEach((field) => {
        bindings.push(bindField(folder, field))
      })
    })
  })

  return {
    schemaSignature: getStudioPaneSchemaSignature(registry),
    dispose() {
      pane.dispose()
    },
    exportState() {
      return pane.exportState()
    },
    importState(state) {
      pane.importState(state)
    },
    sync(nextRegistry) {
      const nextFields = collectFields(nextRegistry)
      const nextFieldByPath = new Map(nextFields.map((field) => [field.path, field]))

      bindings.forEach((binding) => {
        const nextField = nextFieldByPath.get(binding.path)
        if (!nextField) return
        binding.replaceField(nextField)
        binding.sync()
      })
    },
  }
}
