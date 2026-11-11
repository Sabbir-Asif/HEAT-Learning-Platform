export const maskAddress = (address: string): string => {
  const at = address.lastIndexOf("@");
  if (at < 1 || at === address.length - 1) return "***";
  return `${address[0]}***${address.slice(at)}`;
};
