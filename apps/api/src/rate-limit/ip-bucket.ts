import { isIPv6 } from "node:net";

const ipv4MappedPrefix = "::ffff:";
const ipv6PrefixGroups = 4;

const expandIpv6 = (address: string): string[] => {
  const [head = "", tail] = address.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  if (tail === undefined) return headGroups;
  const tailGroups = tail === "" ? [] : tail.split(":");
  const fill = Array.from({ length: 8 - headGroups.length - tailGroups.length }, () => "0");
  return [...headGroups, ...fill, ...tailGroups];
};

export const ipBucket = (ip: string): string => {
  const address = ip.split("%")[0]?.toLowerCase() ?? ip;
  if (address.startsWith(ipv4MappedPrefix) && !isIPv6(address.slice(ipv4MappedPrefix.length))) {
    return address.slice(ipv4MappedPrefix.length);
  }
  if (!isIPv6(address)) return address;
  const groups = expandIpv6(address)
    .slice(0, ipv6PrefixGroups)
    .map((group) => group.replace(/^0+(?=.)/, ""));
  return `${groups.join(":")}::/64`;
};

export const unknownIpBucket = "unknown";
