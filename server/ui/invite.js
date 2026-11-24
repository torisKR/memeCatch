// components/auth-invite.tsx: the sign-in invite of the meme page. The server
// sends it invisible, holding its place. Once the session is known a guest
// sees it, focusable, and a member does not see it at all.
{
  const pending = document.querySelector('[data-auth-invite="pending"]');
  if (pending) {
    currentUser().then((user) => {
      if (user) {
        pending.remove();
        return;
      }
      const card = pending.firstElementChild;
      card.removeAttribute("aria-hidden");
      for (const link of card.querySelectorAll("[tabindex]")) link.removeAttribute("tabindex");
      pending.replaceWith(card);
    });
  }
}
