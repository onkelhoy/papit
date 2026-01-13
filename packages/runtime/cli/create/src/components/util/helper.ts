export function stripRootPath(root: string, target: string) {
  let local = target.replace(root, '');
  if (local.startsWith("/"))
    return local.slice(1);

  return local;
}