# Test Audit Rule

After writing or modifying test files, you MUST audit them for useless tests before considering the work done.

## What counts as a useless test

A test is useless if it would **never catch a real bug**:

1. **Trivially true** — `expect(1+1).toBe(2)`, `expect(true).toBeTruthy()`
2. **Render-without-crashing with no assertion** — only checks `container.firstChild` exists or `toBeInTheDocument()` on the rendered wrapper itself
3. **Hardcoded heading checks on placeholder pages** — testing `<h1>Page Name</h1>` on a stub page with no logic
4. **DOM existence without value** — `expect(element).toBeInTheDocument()` when you should be checking the element's text, role, or attributes
5. **Duplicate of another test** — same setup + assertion as a sibling test, just worded differently

## What to do instead

Every `it()` block must assert something that would **fail if the component had a real bug**:

- **Props flow correctly**: pass different props → verify different output
- **Conditional rendering**: test both the showing and hiding branches
- **User interaction**: click/type → verify state change or callback
- **Accessibility**: verify `aria-*` attributes, roles, labels
- **Edge cases**: empty strings, null values, boundary conditions

## When to skip testing entirely

Some components are too simple to test meaningfully:

- A presentational one-liner with zero logic (e.g. a component that just renders a `<div className="flex-1" />`)
- A component that just forwards all its props to a single child element — test the page/feature that uses it instead

**No test is better than a fake test.** A fake test inflates coverage metrics while providing zero safety.

## Trigger

Run this audit mentally after every test file creation or modification. If you find useless tests, delete or replace them immediately.
