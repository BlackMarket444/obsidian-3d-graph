import type { ResolvedLinkCache } from "@/graph/Link";
import { Link } from "@/graph/Link";
import { Node } from "@/graph/Node";
import type { App, TAbstractFile } from "obsidian";

export class Graph {
  public readonly nodes: Map<string, Node> = new Map();
  public readonly links: Map<string, Map<string, Link>> = new Map();

  constructor(nodes: Node[], links: Link[]) {
    // Using maps directly for nodes and links for quick access
    nodes.forEach(node => this.nodes.set(node.id, node));
    links.forEach(link => {
      if (!this.links.has(link.sourceId)) {
        this.links.set(link.sourceId, new Map());
      }
      this.links.get(link.sourceId).set(link.targetId, link);
    });
  }

  public getNodeById(id: string): Node | undefined {
    // Directly retrieving from map, O(1) complexity
    return this.nodes.get(id);
  }

  public getLink(sourceId: string, targetId: string): Link | undefined {
    // Efficient nested map retrieval
    return this.links.get(sourceId)?.get(targetId);
  }

  public addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  public addLink(link: Link): void {
    if (!this.links.has(link.sourceId)) {
      this.links.set(link.sourceId, new Map());
    }
    this.links.get(link.sourceId).set(link.targetId, link);
  }

  public removeNode(id: string): void {
    this.nodes.delete(id);
    // Also remove all links associated with this node
    this.links.delete(id);
    this.links.forEach((targetMap, sourceId) => {
      targetMap.delete(id);
    });
  }

  public removeLink(sourceId: string, targetId: string): void {
    this.links.get(sourceId)?.delete(targetId);
  }
}
