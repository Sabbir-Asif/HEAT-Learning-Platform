export interface CopyLinkDeps {
  writeText: (text: string) => Promise<void>;
  onCopied: () => void;
  onFailed: () => void;
}

export const copyVerificationLink = async (url: string, deps: CopyLinkDeps): Promise<boolean> => {
  try {
    await deps.writeText(url);
  } catch {
    deps.onFailed();
    return false;
  }
  deps.onCopied();
  return true;
};
