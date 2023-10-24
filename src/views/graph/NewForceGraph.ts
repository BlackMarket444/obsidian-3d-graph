import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import { Graph } from "@/graph/Graph";
import { CenterCoordinates } from "@/views/graph/CenterCoordinates";
import { NewGraph3dView } from "@/views/graph/NewGraph3dView";
import * as THREE from "three";
import * as d3 from "d3-force-3d";
import { hexToRGBA } from "@/util/hexToRGBA";
import { GlobalGraphSettings, LocalGraphSettings, SavedSetting } from "@/SettingManager";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/**
 * the origin vectorss
 */
export const origin = new THREE.Vector3(0, 0, 0);

type MyForceGraph3DInstance = Omit<ForceGraph3DInstance, "graphData"> & {
  graphData: {
    (): Graph; // When no argument is passed, it returns a Graph
    (graph: Graph): MyForceGraph3DInstance; // When a Graph is passed, it returns MyForceGraph3DInstance
  };
};

/**
 * this class control the config and graph of the force graph. The interaction is not control here.
 */
export class NewForceGraph {
  private view: NewGraph3dView;
  private config: LocalGraphSettings | GlobalGraphSettings;

  public readonly instance: MyForceGraph3DInstance;
  private centerCoordinates: CenterCoordinates;

  /**
   *
   * this will create a new force graph instance and render it to the view
   * @param view
   * @param config you have to provide the full config here!!
   */
  constructor(
    view: NewGraph3dView,
    graph: Graph,
    config: LocalGraphSettings | GlobalGraphSettings
  ) {
    this.view = view;
    this.config = config;
    // test;

    // get the content element of the item view
    const rootHtmlElement = view.contentEl as HTMLDivElement;

    // create the div element for the node label
    const divEl = document.createElement("div");
    divEl.style.zIndex = "0";
    const nodeLabelEl = divEl.createDiv({
      cls: "node-label",
      text: "",
    });
    nodeLabelEl.style.opacity = "0";

    // create the instance
    this.instance = ForceGraph3D({
      controlType: "orbit",
      extraRenderers: [
        // @ts-ignore https://github.com/vasturiano/3d-force-graph/blob/522d19a831e92015ff77fb18574c6b79acfc89ba/example/html-nodes/index.html#L27C9-L29
        new CSS2DRenderer({
          element: divEl,
        }),
      ],
    })(rootHtmlElement)
      .graphData(graph)
      // the options here are auto
      .width(rootHtmlElement.innerWidth)
      .height(rootHtmlElement.innerHeight)
      .d3Force("collide", d3.forceCollide(5))
      //   transparent
      .backgroundColor(hexToRGBA("#000000", 0)) as unknown as MyForceGraph3DInstance;

    const scene = this.instance.scene();
    // add others things
    // add center coordinates
    this.centerCoordinates = new CenterCoordinates(config.display.showCenterCoordinates);
    scene.add(this.centerCoordinates.arrowsGroup);
  }

  /**
   * update the dimensions of the graph
   */
  public updateDimensions() {
    const rootHtmlElement = this.view.contentEl as HTMLDivElement;
    const [width, height] = [rootHtmlElement.offsetWidth, rootHtmlElement.offsetHeight];
    this.instance.width(width).height(height);
  }

  public updateConfig(config: Partial<SavedSetting["setting"]>) {
    this.config = Object.assign(this.config, config);
    this.updateInstance(undefined, config);
  }

  /**
   * given a new force Graph, the update the graph and the instance
   */
  public updateGraph(graph: Graph) {
    // some optimization here
    // if the graph is the same, then we don't need to update the graph
    const same = Graph.compare(this.instance.graphData(), graph);
    if (!same) this.updateInstance(graph, undefined);
  }

  /**
   * given the changed things, update the instance
   */
  private updateInstance = (graph?: Graph, config?: Partial<SavedSetting["setting"]>) => {
    if (graph !== undefined) this.instance.graphData(graph);
    if (config?.display?.nodeSize !== undefined)
      this.instance.nodeRelSize(config.display?.nodeSize);
    if (config?.display?.linkThickness !== undefined)
      this.instance.linkWidth(config.display?.linkThickness);
    if (config?.display?.linkDistance !== undefined)
      this.instance.d3Force("link")?.distance(config.display?.linkDistance);
    if (config?.display?.nodeRepulsion !== undefined)
      this.instance
        .d3Force("charge")
        ?.strength(-config.display?.nodeRepulsion)
        .d3Force("x", d3.forceX(0).strength(1 - config.display?.nodeRepulsion / 3000 + 0.001))
        .d3Force("y", d3.forceY(0).strength(1 - config.display?.nodeRepulsion / 3000 + 0.001))
        .d3Force("z", d3.forceZ(0).strength(1 - config.display?.nodeRepulsion / 3000 + 0.001));
    if (config?.display?.showCenterCoordinates) this.centerCoordinates.setVisibility(true);

    /**
     * derive the need to reheat the simulation
     */
    // const needReheat =
    //   config?.display?.nodeRepulsion !== undefined || config?.display?.linkDistance !== undefined;

    // if (needReheat) {
    //   this.instance.numDimensions(3); // reheat simulation
    //   this.instance.refresh();
    // }
  };
}
