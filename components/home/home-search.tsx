"use client";

import { Search } from "lucide-react";

import styles from "@/components/home/home-web3.module.css";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import { recordMemeIntentSubmit } from "@/lib/meme-intent-submit.client";

export function HomeSearch({
  locale,
  action,
  label,
  placeholder,
  button,
}: {
  locale: SeoRouteLocale;
  action: string;
  label: string;
  placeholder: string;
  button: string;
}) {
  const searchId = `home-search-${locale}`;

  return (
    <div>
      <form
        action={action}
        method="get"
        role="search"
        aria-label={label}
        className={styles.searchForm}
        onSubmit={(event) => {
          if (locale !== "ko") return;
          const query = new FormData(event.currentTarget).get("q");
          if (typeof query === "string") recordMemeIntentSubmit(query, locale);
        }}
      >
        <label className={styles.searchLabel} htmlFor={searchId}>
          {label}
        </label>
        <div className={styles.searchShell}>
          <Search aria-hidden className={styles.searchIcon} />
          <input
            id={searchId}
            name="q"
            type="search"
            maxLength={120}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={placeholder}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            {button}
          </button>
        </div>
      </form>
      {locale === "ko" ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          검색어는 등록된 공개 밈 자료 안에서만 찾아요.
        </p>
      ) : null}
    </div>
  );
}
