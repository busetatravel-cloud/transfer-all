export function joinPublicPath(basePath: string, path: string) {
  const safeBase = basePath.trim().replace(/\/+$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;

  if (!safeBase) {
    return safePath || "/";
  }

  if (safePath === "/") {
    return safeBase;
  }

  return `${safeBase}${safePath}`;
}
