//! The markup around every page: header, footer, bottom navigation and the
//! chat launcher. Transcribed from what `app/_root/root-document.tsx` renders
//! for a signed-out Korean visitor (`scripts/html-to-maud.mjs`), so the class
//! lists are the ones `app/globals.css` and Tailwind already style.
//!
//! `ui/site.js` lists which of these controls have a script and which do
//! nothing yet (the menu, the language switch, the account menu, the chat).

use maud::{Markup, html};

/// `components/global-header.tsx`. `login_href` is `/login?next=<path>`, as
/// `components/auth-menu.tsx` builds it before the session is known.
pub fn header(login_href: &str) -> Markup {
    html! {
        header data-site-header class="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70" {
            div class="mx-auto flex min-h-16 max-w-site flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:flex-nowrap sm:px-6 sm:py-0 lg:gap-x-3" {
                div class="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto" {
                    a aria-label="밈캐치 홈" class="group flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl py-1 pr-1 transition-transform active:scale-[0.97]" href="/" {
                        span aria-hidden="true" class="inline-grid shrink-0 place-items-center rounded-[30%] bg-accent size-8" {
                            svg viewBox="0 0 64 64" class="h-[74%] w-[74%]" fill="none" {
                                path d="M 37.4 11.7 A 21 21 0 1 0 52.9 33.8" stroke="#FFF9F5" stroke-width="10" stroke-linecap="round" {}
                                circle cx="49.2" cy="20" r="6" fill="#FFF9F5" {}
                                path fill="#FFF9F5" d="M14.5 44.5 10.5 58.5 25.5 53.5Z" {}
                            }
                        }
                        span class="flex shrink-0 flex-col whitespace-nowrap leading-none" {
                            span class="text-lg font-extrabold tracking-[-0.045em]" { "밈캐치" }
                            span class="mt-1 hidden font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-muted sm:block" { "catchmeme.com" }
                        }
                    }
                    label class="glass-panel relative grid h-11 min-w-[5.25rem] shrink-0 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-foreground transition-shadow hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_55%,transparent)] focus-within:ring-4 focus-within:ring-(--flame-500)/20" {
                        span class="sr-only" { "언어 설정" }
                        span aria-hidden="true" class="relative text-sm leading-none" {
                            "🇰🇷"
                            span aria-hidden="true" class="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-(--flame-500)" {}
                        }
                        span aria-hidden="true" { "KO" }
                        svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-3.5 w-3.5 text-muted" aria-hidden="true" {
                            path d="m6 9 6 6 6-6" {}
                        }
                        select aria-label="언어 선택" class="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0" {
                            option value="ko" selected { "🇰🇷 한국어" }
                            option value="en" { "🇺🇸 English" }
                            option value="ja" { "🇯🇵 日本語" }
                            option value="zh" { "🇨🇳 中文(简体)" }
                            option value="zh-tw" { "🇹🇼 中文(繁體)" }
                            option value="th" { "🇹🇭 ภาษาไทย" }
                            option value="vi" { "🇻🇳 Tiếng Việt" }
                            option value="mn" { "🇲🇳 Монгол" }
                            option value="id" { "🇮🇩 Bahasa Indonesia" }
                            option value="ar" { "🇦🇪 العربية" }
                            option value="ru" { "🇷🇺 Русский" }
                            option value="es" { "🇪🇸 Español" }
                            option value="de" { "🇩🇪 Deutsch" }
                            option value="fr" { "🇫🇷 Français" }
                            option value="it" { "🇮🇹 Italiano" }
                            option value="pt" { "🇧🇷 Português" }
                            option value="tr" { "🇹🇷 Türkçe" }
                            option value="ms" { "🇲🇾 Bahasa Melayu" }
                            option value="hi" { "🇮🇳 हिन्दी" }
                        }
                    }
                }
                nav aria-label="주요 발견" class="hidden shrink-0 items-center gap-0.5 md:flex lg:gap-1" {
                    a class="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2 lg:px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent font-medium text-muted hover:bg-surface-2 hover:text-foreground" href="/explore?sort=recent" { "최신 밈" }
                    a class="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2 lg:px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent font-medium text-muted hover:bg-surface-2 hover:text-foreground" href="/community" { "커뮤니티" }
                }
                div class="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-nowrap sm:justify-start *:shrink-0" {
                    form role="search" class="hidden lg:block" action="/search" {
                        label for="header-search" class="sr-only" { "밈 검색" }
                        div class="relative" {
                            svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" {
                                circle cx="11" cy="11" r="7" {}
                                path d="m20 20-3.5-3.5" {}
                            }
                            input id="header-search" type="search" placeholder="밈 검색" autocomplete="off" enterkeyhint="search" class="peer h-11 w-48 rounded-xl border border-border bg-surface-2 pl-9 pr-9 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20 xl:w-60" name="q";
                            kbd aria-hidden="true" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface px-1.5 font-sans text-xs font-semibold leading-5 text-muted peer-focus:hidden" { "/" }
                        }
                    }
                    a rel="nofollow" class="hidden min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:inline-flex" href="/submit" { "제보" }
                    a aria-label="밈 검색" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-foreground transition-colors hover:border-border hover:bg-surface-2 lg:hidden" href="/search" {
                        svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" {
                            circle cx="11" cy="11" r="7" {}
                            path d="m20 20-3.5-3.5" {}
                        }
                    }
                    a class="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-foreground transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-11 md:px-4" href=(login_href) { "로그인" }
                    div class="relative" {
                        button type="button" aria-expanded="false" aria-controls="header-menu-panel" aria-label="메뉴" class="flex h-11 w-11 items-center justify-center rounded-full border border-transparent transition-colors hover:border-(--signal-cyan) active:scale-[0.95] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent text-foreground hover:bg-surface-2" {
                            svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grid2x2 lucide-grid-2x2 size-5" aria-hidden="true" {
                                path d="M12 3v18" {}
                                path d="M3 12h18" {}
                                rect x="3" y="3" width="18" height="18" rx="2" {}
                            }
                        }
                    }
                }
            }
        }
    }
}

/// `components/site-footer.tsx`. `year` is the current year.
pub fn footer(year: i32) -> Markup {
    html! {
        footer class="instrument-grid mt-16 border-t border-border bg-surface-2" {
            div class="mx-auto max-w-site px-4 py-8" {
                nav aria-label="사이트 정보" {
                    ul class="flex flex-wrap gap-x-5 gap-y-2 text-sm" {
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/memes" { "밈 전체 목록" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/contact" { "문의" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/about" { "밈캐치 소개" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/editorial" { "편집 원칙" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/guides" { "가이드" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/privacy" { "개인정보처리방침" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/terms" { "이용약관" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/rankings" { "밈캐치 내 급상승" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/news" { "세대별 밈 소식" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/submit" { "제보" }
                        }
                        li {
                            a class="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500" href="/support" { "고객센터" }
                        }
                    }
                }
                div class="mt-3 text-[13px] leading-relaxed text-muted" {
                    details class="group" open {
                        summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground sm:hidden [&::-webkit-details-marker]:hidden" {
                            "운영·저작권 안내"
                            svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                                path d="m7 10 5 5 5-5" {}
                            }
                        }
                        div class="space-y-1.5 pb-2 leading-normal sm:pb-0" {
                            p class="break-keep leading-normal" { "밈캐치는 한국 밈·유행어의 뜻과 유래를 기록하는 사전 서비스입니다. 모든 제보는 운영자 검수(사실 확인 → 저작권 확인)를 거쳐 공개됩니다." }
                            p class="break-keep leading-normal" {
                                "제3자 원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공하며, 각 콘텐츠의 저작권은 원저작자에게 있습니다. 문의·삭제 요청: "
                                a href="mailto:toris@toris.kr" class="underline underline-offset-2 hover:text-foreground" { "toris@toris.kr" }
                            }
                        }
                    }
                    p class="stat-mono mt-2" { "© " (year) " 밈캐치" }
                }
            }
        }
    }
}

/// `components/bottom-nav.tsx` on a page that is none of its five targets.
pub fn bottom_nav() -> Markup {
    html! {
        nav aria-label="주 내비게이션" data-site-bottom-nav class="fixed inset-x-0 bottom-0 z-40 border-t border-(--foreground)/10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-(--surface)/72 md:hidden" style="padding-bottom:env(safe-area-inset-bottom)" {
            ul class="mx-auto flex min-w-[19.25rem] max-w-2xl items-stretch justify-around" {
                li class="flex min-w-11 flex-1" {
                    a class="no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted" href="/" {
                        span class="relative grid h-5 w-5 place-items-center" {
                            svg class="h-5 w-5 " viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" {
                                path d="M3 10.5 12 3l9 7.5V21H3z" stroke-linejoin="round" {}
                            }
                        }
                        span class="whitespace-nowrap text-[11px] leading-none sm:text-xs " { "홈" }
                    }
                }
                li class="flex min-w-11 flex-1" {
                    a class="no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted" href="/explore?sort=recent" {
                        span class="relative grid h-5 w-5 place-items-center" {
                            svg class="h-5 w-5 " viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" {
                                circle cx="12" cy="12" r="9" {}
                                path d="m15.5 8.5-2 5-5 2 2-5z" stroke-linejoin="round" {}
                            }
                        }
                        span class="whitespace-nowrap text-[11px] leading-none sm:text-xs " { "최신" }
                    }
                }
                li class="flex min-w-11 flex-1" {
                    a class="no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted" href="/community" {
                        span class="relative grid h-5 w-5 place-items-center" {
                            svg class="h-5 w-5 " viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" {
                                path d="M4 5.5h16v11H9l-5 3v-14Z" stroke-linejoin="round" {}
                                path d="M8 10h8M8 13h5" stroke-linecap="round" {}
                            }
                        }
                        span class="whitespace-nowrap text-[11px] leading-none sm:text-xs " { "커뮤니티" }
                    }
                }
                li class="flex min-w-11 flex-1" {
                    a rel="nofollow" class="no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-accent-text font-semibold" href="/submit" {
                        span class="relative grid h-5 w-5 place-items-center" {
                            svg class="h-5 w-5 rounded-full bg-accent-soft p-0.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_50%,transparent),0_0_10px_1px_color-mix(in_srgb,var(--flame-500)_55%,transparent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" {
                                path d="M12 5v14M5 12h14" stroke-linecap="round" {}
                            }
                        }
                        span class="whitespace-nowrap text-[11px] leading-none sm:text-xs " { "제보" }
                    }
                }
                li class="flex min-w-11 flex-1" {
                    a rel="nofollow" class="no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted" href="/my" {
                        span class="relative grid h-5 w-5 place-items-center" {
                            svg class="h-5 w-5 " viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" {
                                circle cx="12" cy="8" r="4" {}
                                path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" stroke-linecap="round" {}
                            }
                        }
                        span class="whitespace-nowrap text-[11px] leading-none sm:text-xs " { "MY" }
                    }
                }
            }
        }
    }
}

/// The closed launcher of `components/meme-chatbot.tsx`. The class names of
/// its CSS module are spelled `meme-chatbot-<class>` (`scripts/build-ui.mjs`).
pub fn chat_launcher() -> Markup {
    html! {
        div class="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-[45] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 md:bottom-6 md:right-6" {
            button type="button" data-chat-open="false" aria-label="밈캐치 챗봇 열기" aria-expanded="false" class="meme-chatbot-launcher flex h-16 w-16 shrink-0 items-center justify-center border border-accent/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" {
                span class="meme-chatbot-launcher-prompt" aria-hidden="true" { "밈이 궁금할 땐" }
                span class="meme-chatbot-character" data-character-state="idle" aria-hidden="true" style="width:58px;height:58px" {
                    picture {
                        source media="(prefers-reduced-motion: reduce)" srcset="/images/meme-chat/mascot-idle.png";
                        img src="/images/meme-chat/mascot-wave.gif" alt width="58" height="58" class="meme-chatbot-character-image" decoding="async" draggable="false";
                    }
                }
            }
        }
    }
}
