// The frame's analytics call: `window.memecatch.track` of server/ui/core.js.
// Page scripts import it from here and build-ui.mjs answers the import with
// that function (PAGE_SHIMS), so this module only declares its type and is
// never bundled.
export declare function track(event: string, params?: Record<string, string | number>): void;
