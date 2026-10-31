import net from "node:net";

// Cloudflare edge ranges, from https://www.cloudflare.com/ips-v4 and /ips-v6.
const cloudflare = new net.BlockList();
for (const cidr of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]) {
  const [address, prefix] = cidr.split("/");
  cloudflare.addSubnet(address, Number(prefix), "ipv4");
}
for (const cidr of ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"]) {
  const [address, prefix] = cidr.split("/");
  cloudflare.addSubnet(address, Number(prefix), "ipv6");
}

export function isCloudflare(ip = "") {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const address = mapped ? mapped[1] : ip;
  const family = net.isIP(address);
  return family !== 0 && cloudflare.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * The visitor's IP. Behind the Cloudflare proxy, `req.ip` (resolved through the trusted
 * local proxies) is a Cloudflare edge address; only then is CF-Connecting-IP believed,
 * so a direct request to the origin cannot spoof it.
 */
export function clientIp(req) {
  if (isCloudflare(req.ip)) {
    const forwarded = String(req.get("cf-connecting-ip") || "").trim();
    if (net.isIP(forwarded)) return forwarded;
  }
  return req.ip;
}

/**
 * Identity used for guest quotas and rate limits. IPv6 clients usually control a whole
 * /64, so they are grouped by that prefix instead of the exact address.
 */
export function clientKey(ip = "") {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!net.isIPv6(ip)) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** Quota / rate-limit identity of a request. */
export const clientId = (req) => clientKey(clientIp(req));
