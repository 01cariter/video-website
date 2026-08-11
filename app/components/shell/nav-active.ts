// Shared active-route matching for the left nav and the mobile tab bar.
// `/videos/[id]` opens in-shell as the post detail, so it counts as Home.
export function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/videos/');
  return pathname === href || pathname.startsWith(`${href}/`);
}
