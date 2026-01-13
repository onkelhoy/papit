export function getScope() {
  return (process.env.npm_package_name ?? "").split("/")?.[0];
}