export abstract class BreachedPasswordProvider {
  abstract fetchRange(prefix: string): Promise<string>;
}
