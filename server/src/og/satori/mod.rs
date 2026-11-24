//! The parts of Satori 0.25 (in `next/og`) that lay out and paint free text:
//! line break words (`linebreak`), `Intl.Segmenter` (`segment`), the font
//! engine of a text node with its per-character fallback (`engine`), and the
//! text node's line filling and painting (`text`). R7's `og::text` is the
//! one-line special case the fixed cards use.

pub mod engine;
pub mod linebreak;
mod linebreak_data;
pub mod segment;
pub mod text;
