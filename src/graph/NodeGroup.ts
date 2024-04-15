import type { Node } from "@/graph/Node";

export class NodeGroup {
  query: string;
  color: string;
  private regex: RegExp;

  constructor(query: string, color: string) {
    this.query = query;
    this.color = color;
    this.regex = new RegExp(this.sanitizeQuery(query), 'i'); // Compiled once, case insensitive
  }

  // Method to check if the node matches the query
  matches(node: Node): boolean {
    return this.regex.test(node.path);
  }

  // Cleans and prepares the query for use in regex
  private sanitizeQuery(query: string): string {
    return query.trim().replace(/^\.\//, '');
  }
}

