export interface SceneConfig {
  name: string
  created: string
  modified: string
  face: Record<string, number | string>
  back: Record<string, number | string>
  frame: Record<string, number | string>
  scene: Record<string, number | string>
  colors: {
    backColor: string
    frameColor: string
    bgColor: string
  }
}
