import { type Link } from "@/graph/Link";
import type { TAbstractFile } from "obsidian";

export class Node {
  public readonly id: string;
  public readonly name: string;
  public readonly path: string;
  public readonly val: number;

  public readonly links: Set<Link>;

  constructor(name: string, path: string, val = 10, links: Link[] = []) {
    this.id = path;
    this.name = name;
    this.path = path;
    this.val = val;
    this.links = new Set(links);
  }

  static createFromFiles(files: TAbstractFile[]): Node[] {
    return files.map(file => new Node(file.name, file.path));
  }

  public addLink(link: Link): void {
    this.links.add(link);
  }

  public removeLink(link: Link): void {
    this.links.delete(link);
  }

  public hasLink(link: Link): boolean {
    return this.links.has(link);
  }
}
