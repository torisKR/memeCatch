//! `MarkdownBody` (components/markdown-body.tsx): a community post's
//! Markdown as the app renders it with react-markdown, remark-gfm and
//! remark-breaks.
//!
//! comrak parses (GFM: tables, strikethrough, task lists, autolinks,
//! footnotes). Its own HTML writer is not used: the tree is turned into the
//! elements mdast-util-to-hast makes, the component's overrides are applied
//! (`a`, `img`, `p`, headings one level down, lists, `blockquote`, `code`,
//! `pre`, `hr`, tables), and the result is written as React's
//! `renderToStaticMarkup` writes it. So raw HTML is text, every soft line
//! break is a `<br/>`, URLs pass `normalizeUri` and then
//! `sanitizeMarkdownUrl`, and only local media is embedded.
//! `tests/markdown_parity.rs` holds it to the real component's output.
//!
//! Bounds: the parse stops at `PARSE_DEADLINE` (the body is then shown as
//! plain text), and containers deeper than `MAX_DEPTH` keep only their text,
//! so a hostile body cannot overflow the stack.

use std::time::{Duration, Instant};

use comrak::nodes::{AstNode, ListType, NodeValue};
use comrak::{Arena, Options};

const PARSE_DEADLINE: Duration = Duration::from_millis(250);
const MAX_DEPTH: usize = 256;

const LINK_CLASS: &str =
    "break-words font-semibold text-accent underline underline-offset-2 hover:opacity-80";
const MEDIA_CLASS: &str = "my-3 max-h-[28rem] w-auto max-w-full rounded-xl border border-border";
const VIDEO_CLASS: &str =
    "my-3 max-h-[28rem] w-auto max-w-full rounded-xl border border-border bg-black";
const P_CLASS: &str = "my-3 leading-relaxed first:mt-0 last:mb-0";
const UL_CLASS: &str = "my-3 list-disc space-y-1 pl-5";
const OL_CLASS: &str = "my-3 list-decimal space-y-1 pl-5";
const INLINE_CODE_CLASS: &str = "rounded bg-surface-2 px-1.5 py-0.5 text-[0.9em]";

/// `<MarkdownBody className={class}>{body}</MarkdownBody>`.
pub fn markdown_body(body: &str, class: &str) -> String {
    let mut out = String::with_capacity(body.len() * 2 + 128);
    out.push_str(r#"<div class="break-words text-base leading-relaxed "#);
    escape_into(&mut out, class);
    out.push_str(r#"">"#);
    for node in &render_nodes(body) {
        write(&mut out, node);
    }
    out.push_str("</div>");
    out
}

/// What react-markdown hands React: elements with their attributes in the
/// order the component writes them, and text.
#[derive(Debug, Clone, PartialEq)]
enum H {
    Element {
        tag: &'static str,
        attrs: Vec<(&'static str, String)>,
        children: Vec<H>,
    },
    Text(String),
}

fn el(tag: &'static str, attrs: Vec<(&'static str, String)>, children: Vec<H>) -> H {
    H::Element {
        tag,
        attrs,
        children,
    }
}

fn class(value: &str) -> Vec<(&'static str, String)> {
    vec![("class", value.to_owned())]
}

fn text(value: impl Into<String>) -> H {
    H::Text(value.into())
}

fn options() -> Options<'static> {
    let mut options = Options::default();
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    options
}

fn render_nodes(body: &str) -> Vec<H> {
    // CommonMark: U+0000 is read as U+FFFD (micromark does; comrak keeps it).
    let body = &body.replace('\0', "\u{FFFD}");
    let arena = Arena::new();
    let deadline = Instant::now() + PARSE_DEADLINE;
    let past_deadline = || Instant::now() >= deadline;
    let Ok(root) = comrak::try_parse_document(&arena, body, &options(), &past_deadline) else {
        tracing::warn!(bytes = body.len(), "markdown parse ran past its deadline");
        return vec![el("p", class(P_CLASS), vec![text(body)])];
    };
    let mut footnotes = Vec::new();
    let mut blocks = Vec::new();
    for child in root.children() {
        if matches!(child.data().value, NodeValue::FootnoteDefinition(_)) {
            footnotes.push(child);
        } else {
            blocks.extend(block(child, 1));
        }
    }
    let mut nodes = wrap(blocks, false);
    if let Some(section) = footnote_section(&footnotes) {
        nodes.push(text("\n"));
        nodes.push(section);
    }
    nodes
}

/// `wrap` of mdast-util-to-hast: a newline between siblings, and around
/// them when `loose`.
fn wrap(nodes: Vec<H>, loose: bool) -> Vec<H> {
    let mut out = Vec::with_capacity(nodes.len() * 2 + 2);
    if loose {
        out.push(text("\n"));
    }
    let count = nodes.len();
    for (index, node) in nodes.into_iter().enumerate() {
        if index > 0 {
            out.push(text("\n"));
        }
        out.push(node);
    }
    if loose && count > 0 {
        out.push(text("\n"));
    }
    out
}

/// The text of a node and everything under it, without recursion: what a
/// container past `MAX_DEPTH` keeps.
fn flat_text<'a>(node: &'a AstNode<'a>) -> String {
    let mut out = String::new();
    for descendant in node.descendants() {
        match &descendant.data().value {
            NodeValue::Text(value) => out.push_str(value),
            NodeValue::Code(code) => out.push_str(&code.literal),
            NodeValue::CodeBlock(code) => out.push_str(&code.literal),
            NodeValue::HtmlInline(value) => out.push_str(value),
            NodeValue::HtmlBlock(html) => out.push_str(&html.literal),
            NodeValue::SoftBreak | NodeValue::LineBreak => out.push('\n'),
            NodeValue::Paragraph | NodeValue::Heading(_)
                if !out.is_empty() && !out.ends_with('\n') =>
            {
                out.push('\n');
            }
            _ => {}
        }
    }
    out
}

fn blocks_of<'a>(node: &'a AstNode<'a>, depth: usize) -> Vec<H> {
    node.children()
        .filter_map(|child| block(child, depth + 1))
        .collect()
}

fn inlines_of<'a>(node: &'a AstNode<'a>, depth: usize) -> Vec<H> {
    let mut out = Vec::new();
    for child in node.children() {
        inline(child, depth + 1, &mut out);
    }
    out
}

/// A block node as zero or one element (a raw HTML block is text).
fn block<'a>(node: &'a AstNode<'a>, depth: usize) -> Option<H> {
    if depth > MAX_DEPTH {
        return Some(el("p", class(P_CLASS), vec![text(flat_text(node))]));
    }
    let value = node.data().value.clone();
    Some(match value {
        NodeValue::Paragraph => el("p", class(P_CLASS), inlines_of(node, depth)),
        NodeValue::Heading(heading) => heading_element(heading.level, inlines_of(node, depth)),
        NodeValue::ThematicBreak(_) => el("hr", class("my-4 border-border"), Vec::new()),
        NodeValue::BlockQuote => el(
            "blockquote",
            class("my-3 border-l-2 border-border pl-3 text-muted"),
            wrap(blocks_of(node, depth), true),
        ),
        NodeValue::List(list) => {
            let (tag, list_class) = match list.list_type {
                ListType::Bullet => ("ul", UL_CLASS),
                ListType::Ordered => ("ol", OL_CLASS),
            };
            let items = node
                .children()
                .map(|item| list_item(item, !list.tight, depth + 1))
                .collect();
            el(tag, class(list_class), wrap(items, true))
        }
        NodeValue::CodeBlock(code) => code_block(&code.info, &code.literal),
        NodeValue::HtmlBlock(html) => {
            text(html.literal.strip_suffix('\n').unwrap_or(&html.literal))
        }
        NodeValue::Table(_) => table(node, depth),
        // Definitions are gathered at the root; anything else has no block form.
        _ => return None,
    })
}

/// The component's headings: each one level down, `h6` twice.
fn heading_element(level: u8, children: Vec<H>) -> H {
    let (tag, heading_class) = match level {
        1 => ("h2", "mb-2 mt-5 text-xl font-extrabold first:mt-0"),
        2 => ("h3", "mb-2 mt-5 text-lg font-bold first:mt-0"),
        3 => ("h4", "mb-1.5 mt-4 text-base font-bold first:mt-0"),
        4 => ("h5", "mb-1.5 mt-4 text-base font-bold first:mt-0"),
        5 => ("h6", "mb-1 mt-3 text-sm font-bold first:mt-0"),
        _ => ("h6", "mb-1 mt-3 text-sm font-bold text-muted first:mt-0"),
    };
    el(tag, class(heading_class), children)
}

/// `listItem` of mdast-util-to-hast: a task's checkbox opens its first
/// paragraph; in a tight list the paragraphs are unwrapped.
fn list_item<'a>(item: &'a AstNode<'a>, loose: bool, depth: usize) -> H {
    if depth > MAX_DEPTH {
        return el("li", Vec::new(), vec![text(flat_text(item))]);
    }
    let symbol = match &item.data().value {
        NodeValue::TaskItem(task) => Some(task.symbol),
        _ => None,
    };
    let mut results = blocks_of(item, depth);
    // micromark-extension-gfm-task-list-item wants text on the checkbox's own
    // line; comrak does not, and a bare `[ ]` stays text in the app.
    let checked = match symbol {
        Some(symbol) if task_has_text(&results) => Some(symbol.is_some()),
        Some(symbol) => {
            let marker = format!("[{}]", symbol.unwrap_or(' '));
            match results.first_mut() {
                Some(H::Element {
                    tag: "p", children, ..
                }) => children.insert(0, text(marker)),
                _ => results.insert(0, el("p", class(P_CLASS), vec![text(marker)])),
            }
            None
        }
        None => None,
    };
    let mut attrs = Vec::new();
    if let Some(checked) = checked {
        let starts_with_paragraph = matches!(results.first(), Some(H::Element { tag: "p", .. }));
        if !starts_with_paragraph {
            results.insert(0, el("p", class(P_CLASS), Vec::new()));
        }
        if let Some(H::Element { children, .. }) = results.first_mut() {
            if !children.is_empty() {
                children.insert(0, text(" "));
            }
            let mut input = vec![("type", "checkbox".to_owned()), ("disabled", String::new())];
            if checked {
                input.push(("checked", String::new()));
            }
            children.insert(0, el("input", input, Vec::new()));
        }
        attrs.push(("class", "task-list-item".to_owned()));
    }
    let is_paragraph = |node: &H| matches!(node, H::Element { tag: "p", .. });
    let tail_needs_newline = results
        .last()
        .is_some_and(|tail| loose || !is_paragraph(tail));
    let mut children = Vec::new();
    for (index, child) in results.into_iter().enumerate() {
        if loose || index != 0 || !is_paragraph(&child) {
            children.push(text("\n"));
        }
        match child {
            H::Element {
                tag: "p",
                children: inner,
                ..
            } if !loose => children.extend(inner),
            other => children.push(other),
        }
    }
    if tail_needs_newline {
        children.push(text("\n"));
    }
    el("li", attrs, children)
}

/// Whether a task's first paragraph has text before its first line ending.
fn task_has_text(results: &[H]) -> bool {
    match results.first() {
        Some(H::Element {
            tag: "p", children, ..
        }) => match children.first() {
            None => false,
            Some(H::Element { tag: "br", .. }) => false,
            Some(_) => true,
        },
        _ => false,
    }
}

/// `code` and `pre` of the component: a block's `code` keeps the language
/// class (or none); without one and without a newline it is styled inline.
/// The text is mdast's value (no final line ending) with the newline
/// mdast-util-to-hast adds to any that is not empty.
fn code_block(info: &str, literal: &str) -> H {
    let value = literal.strip_suffix('\n').unwrap_or(literal);
    let literal = &if value.is_empty() {
        String::new()
    } else {
        format!("{value}\n")
    };
    let language = info.split_whitespace().next();
    let mut code_attrs = Vec::new();
    if let Some(language) = language {
        code_attrs.push(("class", format!("language-{language}")));
    } else if !literal.contains('\n') {
        code_attrs.push(("class", INLINE_CODE_CLASS.to_owned()));
    }
    el(
        "pre",
        class("my-3 overflow-x-auto rounded-xl bg-surface-2 p-3 text-sm leading-relaxed"),
        vec![el("code", code_attrs, vec![text(literal)])],
    )
}

/// A GFM table: rows padded or cut to the header's columns, `tbody` only
/// with body rows. React drops the whitespace text between table parts.
fn table<'a>(node: &'a AstNode<'a>, depth: usize) -> H {
    let columns = match &node.data().value {
        NodeValue::Table(table) => table.num_columns,
        _ => 0,
    };
    let mut head = Vec::new();
    let mut body = Vec::new();
    for row in node.children() {
        let header = matches!(&row.data().value, NodeValue::TableRow(row) if row.header);
        let mut cells: Vec<H> = row
            .children()
            .take(columns)
            .map(|cell| table_cell(header, inlines_of(cell, depth + 2)))
            .collect();
        while cells.len() < columns {
            cells.push(table_cell(header, Vec::new()));
        }
        let tr = el("tr", Vec::new(), cells);
        if header {
            head.push(tr);
        } else {
            body.push(tr);
        }
    }
    let mut parts = vec![el("thead", Vec::new(), head)];
    if !body.is_empty() {
        parts.push(el("tbody", Vec::new(), body));
    }
    el(
        "div",
        class("my-3 overflow-x-auto"),
        vec![el(
            "table",
            class("w-max min-w-full border-collapse text-sm"),
            parts,
        )],
    )
}

fn table_cell(header: bool, children: Vec<H>) -> H {
    if header {
        el(
            "th",
            class("border border-border bg-surface-2 px-2.5 py-1.5 text-left font-bold"),
            children,
        )
    } else {
        el("td", class("border border-border px-2.5 py-1.5"), children)
    }
}

fn inline<'a>(node: &'a AstNode<'a>, depth: usize, out: &mut Vec<H>) {
    if depth > MAX_DEPTH {
        out.push(text(flat_text(node)));
        return;
    }
    let value = node.data().value.clone();
    match value {
        NodeValue::Text(value) => out.push(text(value.into_owned())),
        // remark-breaks: every line ending is a break.
        NodeValue::SoftBreak | NodeValue::LineBreak => {
            out.push(el("br", Vec::new(), Vec::new()));
            out.push(text("\n"));
        }
        NodeValue::Code(code) => out.push(el(
            "code",
            class(INLINE_CODE_CLASS),
            vec![text(code.literal)],
        )),
        NodeValue::HtmlInline(value) => out.push(text(value)),
        NodeValue::Emph(_) => out.push(el("em", Vec::new(), inlines_of(node, depth))),
        NodeValue::Strong(_) => out.push(el("strong", Vec::new(), inlines_of(node, depth))),
        NodeValue::Strikethrough(_) => out.push(el("del", Vec::new(), inlines_of(node, depth))),
        NodeValue::Link(link) => out.push(anchor(&link.url, inlines_of(node, depth))),
        NodeValue::Image(link) => {
            if let Some(image) = image(&link.url, &alt_text(node)) {
                out.push(image);
            }
        }
        NodeValue::FootnoteReference(reference) => {
            let id = footnote_id(&reference.name);
            out.push(el(
                "sup",
                Vec::new(),
                vec![anchor(
                    &format!("#user-content-fn-{id}"),
                    vec![text(reference.ix.to_string())],
                )],
            ));
        }
        _ => out.extend(inlines_of(node, depth)),
    }
}

/// `alt` of an mdast image: the text of what the brackets hold.
fn alt_text<'a>(node: &'a AstNode<'a>) -> String {
    let mut out = String::new();
    for descendant in node.descendants().skip(1) {
        match &descendant.data().value {
            NodeValue::Text(value) => out.push_str(value),
            NodeValue::Code(code) => out.push_str(&code.literal),
            NodeValue::HtmlInline(value) => out.push_str(value),
            NodeValue::SoftBreak | NodeValue::LineBreak => out.push('\n'),
            _ => {}
        }
    }
    out
}

fn new_tab_link(url: String, children: Vec<H>) -> H {
    el(
        "a",
        vec![
            ("href", url),
            ("target", "_blank".to_owned()),
            ("rel", "noopener noreferrer nofollow".to_owned()),
            ("class", LINK_CLASS.to_owned()),
        ],
        children,
    )
}

/// The component's `a`: no URL left after the sanitizer is a `span`; a
/// local video file is a player; anything else opens in a new tab.
fn anchor(url: &str, children: Vec<H>) -> H {
    let url = sanitize_markdown_url(&normalize_uri(url));
    if url.is_empty() {
        return el("span", Vec::new(), children);
    }
    if is_video_url(&url) && is_local_markdown_media(&url) {
        return video(url);
    }
    new_tab_link(url, children)
}

/// The component's `img`: nothing without a URL, a link for media from
/// elsewhere, a player for a local video file.
fn image(url: &str, alt: &str) -> Option<H> {
    let url = sanitize_markdown_url(&normalize_uri(url));
    if url.is_empty() {
        return None;
    }
    if !is_local_markdown_media(&url) {
        let label = if alt.is_empty() {
            "외부 미디어 열기"
        } else {
            alt
        };
        return Some(new_tab_link(url, vec![text(label)]));
    }
    if is_video_url(&url) {
        return Some(video(url));
    }
    Some(el(
        "img",
        vec![
            ("src", url),
            ("alt", alt.to_owned()),
            ("loading", "lazy".to_owned()),
            ("decoding", "async".to_owned()),
            ("class", MEDIA_CLASS.to_owned()),
        ],
        Vec::new(),
    ))
}

fn video(src: String) -> H {
    el(
        "video",
        vec![
            ("src", src),
            ("controls", String::new()),
            ("preload", "metadata".to_owned()),
            ("playsInline", String::new()),
            ("class", VIDEO_CLASS.to_owned()),
        ],
        Vec::new(),
    )
}

/// The footer mdast-util-to-hast adds for footnotes, in the order they were
/// first referred to, each with a link back to every reference.
fn footnote_section<'a>(definitions: &[&'a AstNode<'a>]) -> Option<H> {
    let mut items = Vec::new();
    for definition in definitions {
        let (name, references) = match &definition.data().value {
            NodeValue::FootnoteDefinition(note) => (note.name.clone(), note.total_references),
            _ => continue,
        };
        if references == 0 {
            continue;
        }
        let id = footnote_id(&name);
        let mut back = Vec::new();
        for n in 1..=references {
            if n == 1 {
                back.push(anchor(
                    &format!("#user-content-fnref-{id}"),
                    vec![text("↩")],
                ));
            } else {
                back.push(text(" "));
                back.push(anchor(
                    &format!("#user-content-fnref-{id}-{n}"),
                    vec![text("↩"), el("sup", Vec::new(), vec![text(n.to_string())])],
                ));
            }
        }
        let mut content = blocks_of(definition, 1);
        match content.last_mut() {
            Some(H::Element {
                tag: "p", children, ..
            }) => {
                match children.last_mut() {
                    Some(H::Text(value)) => value.push(' '),
                    _ => children.push(text(" ")),
                }
                children.extend(back);
            }
            _ => content.extend(back),
        }
        items.push(el(
            "li",
            vec![("id", format!("user-content-fn-{id}"))],
            wrap(content, true),
        ));
    }
    if items.is_empty() {
        return None;
    }
    Some(el(
        "section",
        vec![
            ("data-footnotes", "true".to_owned()),
            ("class", "footnotes".to_owned()),
        ],
        vec![
            heading_element(2, vec![text("Footnotes")]),
            text("\n"),
            el("ol", class(OL_CLASS), wrap(items, true)),
            text("\n"),
        ],
    ))
}

/// The id mdast-util-to-hast gives a footnote: its label normalized
/// (white space collapsed, case folded) and percent-encoded.
fn footnote_id(name: &str) -> String {
    let collapsed = name.split_whitespace().collect::<Vec<_>>().join(" ");
    normalize_uri(&collapsed.to_uppercase().to_lowercase())
}

/// `normalizeUri` of micromark-util-sanitize-uri.
pub fn normalize_uri(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = String::with_capacity(value.len());
    let mut chars = value.char_indices();
    while let Some((index, c)) = chars.next() {
        if c == '%'
            && bytes.get(index + 1).is_some_and(u8::is_ascii_alphanumeric)
            && bytes.get(index + 2).is_some_and(u8::is_ascii_alphanumeric)
        {
            out.push_str(&value[index..index + 3]);
            chars.next();
            chars.next();
            continue;
        }
        let keep = matches!(c, '!' | '#' | '$' | '=' | '_' | '~')
            || ('&'..=';').contains(&c)
            || ('?'..='Z').contains(&c)
            || c.is_ascii_lowercase();
        if keep {
            out.push(c);
        } else {
            let mut buffer = [0; 4];
            for byte in c.encode_utf8(&mut buffer).bytes() {
                out.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    out
}

/// `sanitizeMarkdownUrl` of lib/markdown.ts.
pub fn sanitize_markdown_url(url: &str) -> String {
    let scheme = |prefix: &str| {
        url.get(..prefix.len())
            .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
    };
    let allowed = scheme("http://")
        || scheme("https://")
        || (url.starts_with('/') && !url.starts_with("//"))
        || url.starts_with('#');
    if allowed {
        url.to_owned()
    } else {
        String::new()
    }
}

/// `isVideoUrl` of lib/markdown.ts: `/\.(mp4|webm)(?=$|[?#])/i`.
pub fn is_video_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    [".mp4", ".webm"].iter().any(|needle| {
        lower.match_indices(needle).any(|(at, _)| {
            matches!(
                lower.as_bytes().get(at + needle.len()),
                None | Some(b'?' | b'#')
            )
        })
    })
}

/// `isLocalMarkdownMedia` of lib/markdown.ts.
pub fn is_local_markdown_media(url: &str) -> bool {
    let path = url.split(['?', '#']).next().unwrap_or("");
    let Some(rest) = path.strip_prefix("/api/media/").and_then(|tail| {
        ["meme-uploads/", "meme-thumbs/", "meme-card-art/"]
            .iter()
            .find_map(|root| tail.strip_prefix(root))
    }) else {
        return false;
    };
    !rest.is_empty()
        && rest
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'/' | b'-'))
        && !path
            .split('/')
            .any(|segment| segment == "." || segment == "..")
}

/// React's `escapeTextForBrowser`, for text and attribute values alike.
fn escape_into(out: &mut String, value: &str) {
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#x27;"),
            other => out.push(other),
        }
    }
}

const VOID: [&str; 4] = ["br", "hr", "img", "input"];
const TABLE_PARTS: [&str; 4] = ["table", "thead", "tbody", "tr"];

/// `renderToStaticMarkup`: void elements self-closed, no separators between
/// text nodes, and whitespace-only text dropped inside table parts.
fn write(out: &mut String, node: &H) {
    match node {
        H::Text(value) => escape_into(out, value),
        H::Element {
            tag,
            attrs,
            children,
        } => {
            out.push('<');
            out.push_str(tag);
            for (name, value) in attrs {
                out.push(' ');
                out.push_str(name);
                out.push_str("=\"");
                escape_into(out, value);
                out.push('"');
            }
            if VOID.contains(tag) {
                out.push_str("/>");
                return;
            }
            out.push('>');
            let in_table = TABLE_PARTS.contains(tag);
            for child in children {
                if in_table && matches!(child, H::Text(value) if value.trim().is_empty()) {
                    continue;
                }
                write(out, child);
            }
            out.push_str("</");
            out.push_str(tag);
            out.push('>');
        }
    }
}
