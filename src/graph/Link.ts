import { type Node } from "@/graph/Node";

export type ResolvedLinkCache = Record<string, Record<string, number>>;

export class Link {
  public readonly source: Node;
  public readonly target: Node;

  constructor(source: Node, target: Node) {
    this.source = source;
    this.target = target;
  }

  /**
   * Efficiently creates a link index for an array of links.
   */
  static createLinkIndex(links: Link[]): Map<string, Map<string, number>> {
    const linkIndex = new Map<string, Map<string, number>>();
    links.forEach(link => {
      if (!linkIndex.has(link.source.id)) {
        linkIndex.set(link.source.id, new Map<string, number>());
      }
      linkIndex.get(link.source.id).set(link.target.id, link.source.id);
    });
    return linkIndex;
  }

  /**
   * Checks for duplicate links using a set for O(n) complexity.
   */
  static checkLinksValid(links: Link[]): void {
    const seenLinks = new Set<string>();
    links.forEach(link => {
      const linkKey = `${link.source.id}->${link.target.id}`;
      if (seenLinks.has(linkKey)) {
        throw new Error("Duplicate link found: " + linkKey);
      }
      seenLinks.add(linkKey);
    });
  }
}
