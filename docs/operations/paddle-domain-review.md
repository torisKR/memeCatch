# Paddle domain review handoff

## Decision from the October 14, 2026 review email

Paddle declined `catchmeme.com` after categorizing the mixed public site as digital content / marketplace, donation, and advertising-related. The root site contains multiple independent free-service and revenue surfaces, so it should not be resubmitted as the checkout domain.

## Implemented review boundary

- Submit `https://plus.catchmeme.com`, not `https://catchmeme.com`.
- The `plus.catchmeme.com` host is isolated by Vercel host rewrites.
- Its public navigation contains only product, pricing, terms, privacy, and refund pages.
- The stated product is a one-user, 30-day license to the hosted MemeCatch Plus workflow application.
- Checkout remains unavailable until Paddle approves the domain.

## Required production steps

1. Deploy the current change without including unrelated unreviewed work.
2. Add `plus.catchmeme.com` to the existing Vercel project.
3. Add the required DNS record using the Cloudflare `cf` CLI because this repository has no Wrangler configuration.
4. Verify public `200` responses and correct content for `/`, `/product`, `/pricing`, `/terms`, `/privacy`, `/refund`, `/robots.txt`, and `/sitemap.xml` on the subdomain.
5. Confirm that an unknown subdomain path renders the isolated not-found page instead of the main MemeCatch application.
6. Submit `plus.catchmeme.com` as a new website in Paddle. Do not resubmit the root domain.

## Appeal / resubmission explanation

> The original domain included several unrelated parts of our free public reference website, which made the product scope unclear. We have now separated the paid product onto https://plus.catchmeme.com. This domain describes and sells only MemeCatch Plus, a hosted software application for account-based watchlists, change monitoring, evidence-review workflow, localization follow-up, and activity history. The listed product is USD 10 for one user and 30 days of software access, with no automatic renewal. Product details, pricing, supplier terms, privacy policy, and refund policy are accessible from every page. Checkout will be enabled on this domain only after website approval. Please review the new product-specific domain rather than catchmeme.com.

## Stop condition

Do not enable live Paddle checkout or submit the form until the subdomain is deployed and the public checks above pass. Paddle approval remains an external decision and must not be reported as complete from code changes alone.
