//! The lucide-react icons the home page draws, as lucide-react 0.x renders
//! them (paths copied from its output, not from the icon site).

use maud::{Markup, PreEscaped, html};

fn lucide(name: &str, class: &str, body: &'static str) -> Markup {
    let class = if class.is_empty() {
        format!("lucide lucide-{name}")
    } else {
        format!("lucide lucide-{name} {class}")
    };
    html! {
        svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class=(class) aria-hidden="true" {
            (PreEscaped(body))
        }
    }
}

pub fn arrow_right(class: &str) -> Markup {
    lucide(
        "arrow-right",
        class,
        r#"<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>"#,
    )
}

pub fn search(class: &str) -> Markup {
    lucide(
        "search",
        class,
        r#"<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>"#,
    )
}

pub fn messages_square(class: &str) -> Markup {
    lucide(
        "messages-square",
        class,
        r#"<path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"></path>"#,
    )
}

pub fn shield_check(class: &str) -> Markup {
    lucide(
        "shield-check",
        class,
        r#"<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path>"#,
    )
}

pub fn message_circle(class: &str) -> Markup {
    lucide(
        "message-circle",
        class,
        r#"<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path>"#,
    )
}

pub fn chevron_down(class: &str) -> Markup {
    lucide("chevron-down", class, r#"<path d="m6 9 6 6 6-6"></path>"#)
}

pub fn trophy(class: &str) -> Markup {
    lucide(
        "trophy",
        class,
        r#"<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"></path><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"></path><path d="M18 9h1.5a1 1 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"></path><path d="M6 9H4.5a1 1 0 0 1 0-5H6"></path>"#,
    )
}

pub fn heart(class: &str) -> Markup {
    lucide(
        "heart",
        class,
        r#"<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>"#,
    )
}

pub fn image(class: &str) -> Markup {
    lucide(
        "image",
        class,
        r#"<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>"#,
    )
}

pub fn circle_check(class: &str) -> Markup {
    lucide(
        "circle-check",
        class,
        r#"<circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path>"#,
    )
}

pub fn circle_x(class: &str) -> Markup {
    lucide(
        "circle-x",
        class,
        r#"<circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path>"#,
    )
}

pub fn triangle_alert(class: &str) -> Markup {
    lucide(
        "triangle-alert",
        class,
        r#"<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>"#,
    )
}

pub fn rotate_ccw(class: &str) -> Markup {
    lucide(
        "rotate-ccw",
        class,
        r#"<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>"#,
    )
}

pub fn sparkles(class: &str) -> Markup {
    lucide(
        "sparkles",
        class,
        r#"<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle>"#,
    )
}

pub fn copy(class: &str) -> Markup {
    lucide(
        "copy",
        class,
        r#"<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>"#,
    )
}

pub fn check(class: &str) -> Markup {
    lucide("check", class, r#"<path d="M20 6 9 17l-5-5"></path>"#)
}
