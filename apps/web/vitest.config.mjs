// tsconfig keeps `jsx: preserve` for Next, so tests that render components need the transform.
export default { oxc: { jsx: { runtime: "automatic" } } };
