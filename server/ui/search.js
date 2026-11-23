// components/search-shortcut.tsx: "/" focuses the header search where it is
// shown, unless the key is typed into a field.
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  const input = document.getElementById("header-search");
  if (!input || input.offsetParent === null) return;
  event.preventDefault();
  input.focus();
  input.select();
});
