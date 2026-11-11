/** "/@ada" is served from the static /u page, which reads the name from the address. */
export function isProfilePath(pathname: string): boolean {
  return /^\/@[A-Za-z0-9_]{1,64}\/?$/.test(pathname);
}
