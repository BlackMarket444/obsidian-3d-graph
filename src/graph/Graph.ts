import { Link } from "@/graph/Link";
import { Node } from "@/graph/Node";
import { App } from "obsidian";

export class Graph {
  public readonly nodes: Node[];
  public readonly links: Link[];

  // Indexes to quickly retrieve nodes and links by id
  private readonly nodeIndex: Map<string, number>;
  private readonly linkIndex: Map<string, Map<string, number>>;

  constructor(
    nodes: Node[],
    links: Link[],
    nodeIndex: Map<string, number>,
    linkIndex: Map<string, Map<string, number>>
  ) {
    this.nodes = nodes;
    this.links = links;
    this.nodeIndex = nodeIndex || new Map<string, number>();
    this.linkIndex = linkIndex || new Map<string, Map<string, number>>();
  }

  public getNodeByPath = (path: string): Node | null => {
    return this.nodes.find((n) => n.path === path) ?? null;
  };

  // Returns a node by its id
  public getNodeById(id: string): Node | null {
    const index = this.nodeIndex.get(id);
    if (index !== undefined) {
      // @ts-ignore
      return this.nodes[index];
    }
    return null;
  }

  // Returns a link by its source and target node ids
  public getLinkByIds(sourceNodeId: string, targetNodeId: string): Link | null {
    const sourceLinkMap = this.linkIndex.get(sourceNodeId);
    if (sourceLinkMap) {
      const index = sourceLinkMap.get(targetNodeId);
      if (index !== undefined) {
        // @ts-ignore
        return this.links[index];
      }
    }
    return null;
  }

  // Returns the outgoing links of a node
  public getLinksFromNode(sourceNodeId: string): Link[] {
    const sourceLinkMap = this.linkIndex.get(sourceNodeId);
    if (sourceLinkMap) {
      // @ts-ignore
      return Array.from(sourceLinkMap.values()).map((index) => this.links[index]);
    }
    return [];
  }

  // Returns the outgoing and incoming links of a node
  public getLinksWithNode(nodeId: string): Link[] {
    // we need to check if the link consists of a Node instance
    // instead of just a string id,
    // because D3 will replace each string id with the real Node instance
    // once the graph is rendered
    // @ts-ignore
    if (this.links[0]?.source?.id) {
      return this.links.filter(
        // @ts-ignore
        (link) => link.source.id === nodeId || link.target.id === nodeId
      );
    } else {
      return this.links.filter((link) => link.source.id === nodeId || link.target.id === nodeId);
    }
  }

  /**
   *
   * @param nodeId
   * @returns the local graph of a node
   */
  public getLocalGraph(nodeId: string): Graph {
    const node = this.getNodeById(nodeId);
    if (node) {
      const nodes = [node, ...node.neighbors];
      const links: Link[] = [];
      const nodeIndex = new Map<string, number>();

      nodes.forEach((node, index) => {
        nodeIndex.set(node.id, index);
      });

      nodes.forEach((node, index) => {
        const filteredLinks = node.links
          .filter((link) => nodeIndex.has(link.target.id) && nodeIndex.has(link.source.id))
          .map((link) => {
            if (
              !links.includes(link) &&
              nodeIndex.has(link.target.id) &&
              nodeIndex.has(link.source.id)
            )
              links.push(link);
            return link;
          });

        node.links.splice(0, node.links.length, ...filteredLinks);
      });

      const linkIndex = Link.createLinkIndex(links);

      return new Graph(nodes, links, nodeIndex, linkIndex);
    } else {
      return new Graph([], [], new Map(), new Map());
    }
  }

  // Clones the graph
  public clone = (): Graph => {
    return new Graph(
      structuredClone(this.nodes),
      structuredClone(this.links),
      structuredClone(this.nodeIndex),
      structuredClone(this.linkIndex)
    );
  };

  // Creates a graph using the Obsidian API
  public static createFromApp = (app: App): Graph => {
    const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles()),
      [links, linkIndex] = Link.createFromCache(app.metadataCache.resolvedLinks, nodes, nodeIndex);
    return new Graph(nodes, links, nodeIndex, linkIndex);
  };

  // updates this graph with new data from the Obsidian API
  public update = (app: App) => {
    const newGraph = Graph.createFromApp(app);

    this.nodes.splice(0, this.nodes.length, ...newGraph.nodes);
    this.links.splice(0, this.links.length, ...newGraph.links);

    this.nodeIndex.clear();
    newGraph.nodeIndex.forEach((value, key) => {
      this.nodeIndex.set(key, value);
    });

    this.linkIndex.clear();
    newGraph.linkIndex.forEach((value, key) => {
      this.linkIndex.set(key, value);
    });
  };

  /**
   * filter the nodes of the graph, the links will be filtered automatically.
   * @param predicate this
   * @returns a new graph
   */
  public filter = (predicate: (node: Node) => boolean) => {
    const filteredNodes = this.nodes.filter(predicate);
    const filteredLinks = this.links.filter((link) => {
      // the source and target nodes of a link must be in the filtered nodes
      return (
        filteredNodes.some((node) => link.source.id === node.id) &&
        filteredNodes.some((node) => link.target.id === node.id)
      );
    });

    const nodeIndex = new Map<string, number>();
    filteredNodes.forEach((node, index) => {
      nodeIndex.set(node.id, index);
    });

    const linkIndex = Link.createLinkIndex(filteredLinks);

    return new Graph(filteredNodes, filteredLinks, nodeIndex, linkIndex);
  };
}
