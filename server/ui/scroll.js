// components/scroll-chrome.tsx: on a phone the header and the bottom bar go
// away while scrolling down. The rule is lib/scroll-chrome.ts itself.
{
  const phone = window.matchMedia?.("(max-width: 767px)");
  lib.scrollChrome.attachScrollChrome(window, root, () => phone?.matches ?? false);
}
