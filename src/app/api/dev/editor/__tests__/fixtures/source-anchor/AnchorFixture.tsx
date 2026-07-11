export function AnchorFixture() {
  return (
    <section data-root="fixture">
      <div data-panel="main">
        <button key="save" data-action="save" className="primary">
          Save
        </button>
        <span className="duplicate">Same</span>
        <span className="duplicate">Same</span>
        <strong data-anchor="target">Target</strong>
      </div>
    </section>
  )
}
