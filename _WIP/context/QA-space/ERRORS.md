# QA harness errors

## KAI-10221 current-runtime screenshot

- Failed approach: the first probe used the wrong `waitForFunction` signature; the second waited on an invented generic status regex that did not match the real route text.
- Working approach: reuse the product oracle's exact status contract — wait for `image ready`, click Detect, then wait for `done (cut: u2netp)`.
- Remember: current-route visual probes must use the established status oracle rather than paraphrasing UI text.
