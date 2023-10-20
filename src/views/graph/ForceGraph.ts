import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import { Node } from "@/graph/Node";
import { Link } from "@/graph/Link";
import { StateChange } from "@/util/State";
import Graph3dPlugin from "@/main";
import { Graph } from "@/graph/Graph";
import { rgba } from "polished";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { eventBus } from "@/util/EventBus";
import { GraphSettings } from "@/settings/GraphSettings";
import * as THREE from "three";
import { Notice, TFile } from "obsidian";
import { Graph3dView } from "@/views/graph/Graph3dView";
import * as TWEEN from "@tweenjs/tween.js";
import { CommandModal } from "@/commands/CommandModal";

const origin = new THREE.Vector3(0, 0, 0);
const selectedColor = "#CCA700";

/**
 * the Coords type in 3d-force-graph
 */
export type Coords = {
  x: number;
  y: number;
  z: number;
};

export type GraphNode = Node & Coords;

const LINK_PARTICLE_MULTIPLIER = 2;
const LINK_ARROW_WIDTH_MULTIPLIER = 5;
const PARTICLE_FREQUECY = 4;

const FOCAL_FROM_CAMERA = 400;
const DISTANCE_FROM_FOCAL = 300;
const BASE_NODE_OPACITY = 0.7;

function hexToRGBA(hex: string, alpha: number): string {
  // Remove the hash symbol if present
  hex = hex.replace("#", "");

  // Split the hex value into RGB components
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create the RGBA color value
  const rgba = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return rgba;
}

// Adapted from https://github.com/vasturiano/3d-force-graph/blob/master/example/highlight/index.html
// D3.js 3D Force Graph

export class ForceGraph {
  private instance: ForceGraph3DInstance;
  private controls: OrbitControls | TrackballControls;

  readonly rootHtmlElement: HTMLElement;

  /**
   * the node connected to the hover node
   */
  private readonly highlightedNodes: Set<string> = new Set();
  /**
   * the links connected to the hover node
   */
  private readonly highlightedLinks: Set<Link> = new Set();
  hoveredNode: Node | null;

  private readonly isLocalGraph: boolean;
  private graph: Graph;
  private readonly plugin: Graph3dPlugin;
  private myCube: THREE.Mesh;
  private nodeLabelEl: HTMLDivElement;
  private centerCoordinateArrow: {
    xArrow: THREE.ArrowHelper;
    yArrow: THREE.ArrowHelper;
    zArrow: THREE.ArrowHelper;
  };
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tween: { [tweenId: string]: TWEEN.Tween<any> | undefined } = {};
  private spaceDown = false;
  private commandDown = false;

  private selectedNodes = new Set<Node>();

  private view: Graph3dView;
  // private bloomComposer: EffectComposer;
  // private finalComposer: EffectComposer;

  constructor(
    plugin: Graph3dPlugin,
    rootHtmlElement: HTMLElement,
    isLocalGraph: boolean,
    view: Graph3dView
  ) {
    this.rootHtmlElement = rootHtmlElement;
    this.isLocalGraph = isLocalGraph;
    this.plugin = plugin;
    this.view = view;

    this.createGraph();
    this.initListeners();
    this.instance.onEngineStop(this.onEngineStop);
  }

  /**
   * Callback function invoked when the simulation engine stops and the layout is frozen.
   */
  private onEngineStop = () => {
    console.log("The engine is stop");
  };
  public getGraph = () => {
    return this.graph;
  };

  private cameraPosition(
    instance: ForceGraph3DInstance,
    position: Partial<Coords>,
    lookAt: Coords | undefined,
    transitionDuration: number | undefined
  ) {
    const camera = instance.camera();
    const controls = this.controls;
    const tween = this.tween;
    if (position === undefined && lookAt === undefined && transitionDuration === undefined) {
      return {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
    }

    if (position) {
      const finalPos = position;
      const finalLookAt = lookAt || { x: 0, y: 0, z: 0 };

      if (!transitionDuration) {
        // no animation

        setCameraPos(finalPos);
        setLookAt(finalLookAt);
      } else {
        const camPos = Object.assign({}, camera.position);
        const camLookAt = getLookAt();

        // create unique id for position tween
        const posTweenId = Math.random().toString(36).substring(2, 15);

        tween[posTweenId] = new TWEEN.Tween(camPos)
          .to(finalPos, transitionDuration)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onUpdate(setCameraPos)
          .onComplete(() => {
            tween[posTweenId] = undefined;
          })
          .start();

        // create unique id for lookAt tween
        const lookAtTweenId = Math.random().toString(36).substring(2, 15);

        // Face direction in 1/3rd of time
        tween[lookAtTweenId] = new TWEEN.Tween(camLookAt)
          .to(finalLookAt, transitionDuration / 3)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onUpdate(setLookAt)
          .onComplete(() => {
            tween[lookAtTweenId] = undefined;
          })
          .start();
      }

      // eslint-disable-next-line no-inner-declarations
      function setCameraPos(pos: Partial<Coords>) {
        const { x, y, z } = pos;
        if (x !== undefined) camera.position.x = x;
        if (y !== undefined) camera.position.y = y;
        if (z !== undefined) camera.position.z = z;
      }

      // eslint-disable-next-line no-inner-declarations
      function setLookAt(lookAt: Coords) {
        const lookAtVect = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);
        if (controls.target) {
          controls.target = lookAtVect;
        } else {
          // Fly controls doesn't have target attribute
          camera.lookAt(lookAtVect); // note: lookAt may be overridden by other controls in some cases
        }
      }

      // eslint-disable-next-line no-inner-declarations
      function getLookAt() {
        return Object.assign(
          new THREE.Vector3(0, 0, -1000).applyQuaternion(camera.quaternion).add(camera.position)
        );
      }
    }
  }

  private cameraLookAtCenter = () => {
    const cameraPosition = this.instance.camera().position;
    this.cameraPosition(this.instance, cameraPosition, { x: 0, y: 0, z: 0 }, 1000);
  };

  private initListeners() {
    this.plugin.settingsState.onChange(this.handleSettingsChanged);
    this.plugin.searchState.onChange(() => {
      // if the dv query is not empty, then don't refresh the graph
      if (this.plugin.settingsState.value.filters.dvQuery && this.plugin.getDvApi()) {
        return;
      }
      this.refreshGraphData();
    });
    if (this.isLocalGraph) this.plugin.openFileState.onChange(this.refreshGraphData);
    eventBus.on("graph-changed", this.refreshGraphData);
    eventBus.on("do-pull", () => {
      // look at the center of the graph
      console.log("pulling graph");
      this.cameraLookAtCenter();

      // pull together
      const currentDagOrientation = this.plugin.getSettings().display.dagOrientation;
      this.instance.dagMode("radialout");
      this.instance.numDimensions(3); // reheat simulation
      setTimeout(() => {
        const noDag = currentDagOrientation === "null";
        // @ts-ignore
        this.instance.dagMode(noDag ? null : currentDagOrientation);
        this.instance.graphData(this.getGraphData());
        this.instance.numDimensions(3); // reheat simulation
      }, 300);
    });

    // the utility buttons
    eventBus.on(
      "search",
      (
        file: {
          file: TFile;
          type: "file";
        },
        event: Event
      ) => {
        const targetNode = this.graph?.getNodeByPath(file.file.path);
        console.log("search", file, targetNode);
        if (targetNode) this.focusOnCoords(targetNode as GraphNode);
        else new Notice("The node doesn't exist in the graph");
      }
    );
    eventBus.on("look-at-center", this.cameraLookAtCenter);
    eventBus.on("remove-selected-nodes", this.removeSelectedNodes);
  }

  public removeSelectedNodes = () => {
    this.selectedNodes.clear();
    this.updateHighlight();
  };

  private createCenterCoordinateArrow() {
    const xDir = new THREE.Vector3(1, 0, 0);
    const yDir = new THREE.Vector3(0, 1, 0);
    const zDir = new THREE.Vector3(0, 0, 1);

    xDir.normalize();
    yDir.normalize();
    zDir.normalize();

    const length = 100;

    const xArrow = new THREE.ArrowHelper(xDir, origin, length, 0xff0000);
    const yArrow = new THREE.ArrowHelper(yDir, origin, length, 0x00ff00);
    const zArrow = new THREE.ArrowHelper(zDir, origin, length, 0x0000ff);

    xArrow.visible =
      yArrow.visible =
      zArrow.visible =
        this.plugin.settingsState.value.display.showCenterCoordinates;

    this.centerCoordinateArrow = {
      xArrow,
      yArrow,
      zArrow,
    };

    this.instance.scene().add(xArrow).add(yArrow).add(zArrow);
  }

  private onZoomStart = () => {
    const tweens = Object.keys(this.tween);
    if (tweens) {
      Object.values(this.tween).forEach((tween) => {
        if (tween) {
          tween.stop();
        }
      });
      // remove the tween
      this.tween = {};
    }
  };

  private createGraph() {
    const myCube = new THREE.Mesh(
      new THREE.BoxGeometry(30, 30, 30),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );

    this.myCube = myCube;
    myCube.position.set(0, 0, -FOCAL_FROM_CAMERA);
    myCube.visible = false;
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        this.spaceDown = true;
        // this.controls.mouseButtons.LEFT = THREE.MOUSE.RIGHT;
      }
      if (e.metaKey) this.commandDown = true;
    });

    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        this.spaceDown = false;
        // this.controls.mouseButtons.LEFT = THREE.MOUSE.LEFT;
      }
      if (!e.metaKey) this.commandDown = false;
    });

    this.createInstance();
    this.createNodes();
    this.createLinks();
    this.createCenterCoordinateArrow();
    this.instance.scene().add(myCube);

    const camera = this.instance.camera() as THREE.PerspectiveCamera;
    const renderer = this.instance.renderer();

    const xArrow = this.centerCoordinateArrow.xArrow;
    const yArrow = this.centerCoordinateArrow.yArrow;
    const zArrow = this.centerCoordinateArrow.zArrow;

    // TODO: move to global
    let isZooming = false;
    let startZoomTimeout: Timer | undefined;
    let endZoomTimeout: Timer | undefined;

    const onZoomStart = this.onZoomStart;

    function onZoom(event: WheelEvent) {
      // check if it is start zooming using setTimeout
      // if it is, then cancel the animation
      if (!isZooming && !startZoomTimeout) {
        startZoomTimeout = setTimeout(() => {
          // console.log("this should only show once");
          if (!isZooming) {
            clearTimeout(startZoomTimeout);
            startZoomTimeout = undefined;
            isZooming = true;
            onZoomStart();
          }
          return;
        }, 100);
      }

      const distanceToCenter = camera.position.distanceTo(origin);
      camera.updateProjectionMatrix();
      xArrow.setLength(distanceToCenter / 10);
      yArrow.setLength(distanceToCenter / 10);
      zArrow.setLength(distanceToCenter / 10);

      if (isZooming) {
        clearTimeout(endZoomTimeout);
        endZoomTimeout = setTimeout(() => {
          endZoomTimeout = undefined;
          isZooming = false;
        }, 100);
      }
    }

    renderer.domElement.addEventListener("wheel", onZoom);

    const oldOnBeforeRender = this.instance.scene().onBeforeRender;

    this.instance.scene().onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      // first run the old onBeforeRender
      oldOnBeforeRender(renderer, scene, camera, geometry, material, group);

      const cwd = new THREE.Vector3();
      camera.getWorldDirection(cwd);
      cwd.multiplyScalar(FOCAL_FROM_CAMERA);
      cwd.add(camera.position);
      myCube.position.set(cwd.x, cwd.y, cwd.z);
      myCube.setRotationFromQuaternion(camera.quaternion);
    };

    this.controls = this.instance.controls() as OrbitControls;
    this.controls.mouseButtons.RIGHT = undefined;

    //  change the nav info text
    this.rootHtmlElement
      .querySelector(".scene-nav-info")
      ?.setText("Left-click: rotate, Mouse-wheel/middle-click: zoom, Cmd + left-click: pan");
  }

  private createNodeLabel(rootHtmlElement: HTMLElement) {
    const nodeLabelEl = rootHtmlElement.createDiv({
      cls: "node-label",
      text: "",
    });
    nodeLabelEl.style.opacity = "0";
    this.nodeLabelEl = nodeLabelEl;
  }

  private createInstance() {
    const [width, height] = [this.rootHtmlElement.innerWidth, this.rootHtmlElement.innerHeight];
    // set the divEl to have z-index 0
    const divEl = document.createElement("div");
    divEl.style.zIndex = "0";
    this.createNodeLabel(divEl);
    const settings = this.plugin.getSettings();

    this.instance = ForceGraph3D({
      controlType: "orbit",
      extraRenderers: [
        // @ts-ignore https://github.com/vasturiano/3d-force-graph/blob/522d19a831e92015ff77fb18574c6b79acfc89ba/example/html-nodes/index.html#L27C9-L29
        new CSS2DRenderer({
          element: divEl,
        }),
      ],
    })(this.rootHtmlElement)
      .graphData(this.getGraphData())
      // .nodeLabel((node: Node) => `<div class="node-label">${node.name}</div>`)
      // @ts-ignore  we need to return null or empty string because by default it will access the name of node, see https://github.com/vasturiano/3d-force-graph#node-styling
      .nodeLabel((node: Node) => null)
      .nodeRelSize(settings.display.nodeSize)
      .nodeVal((node: Node) => {
        const maxVal = 5;
        return maxVal * (1 - Math.exp(-node.links.length / 5));
      })
      .backgroundColor(rgba(0, 0, 0, 0.0))
      .width(width)
      .height(height)
      //@ts-ignore
      .dagMode(settings.display.dagOrientation === "null" ? null : settings.display.dagOrientation)
      .dagLevelDistance(200);

    // @ts-ignore patch the cameraPosition function
    this.instance.cameraPosition = (...args) => {
      // @ts-ignore
      this.cameraPosition(this.instance, ...args);
    };
    this.instance.showNavInfo();

    // setBoundingSpace(this.instance.scene());
  }

  public getTween() {
    return this.tween;
  }

  private getNodeLabelText = (node: Node) => {
    const settings = this.plugin.getSettings();
    const fullPath = node.path;
    const fileNameWithExtension = node.name;
    const fullPathWithoutExtension = fullPath.substring(0, fullPath.lastIndexOf("."));
    const fileNameWithoutExtension = fileNameWithExtension.substring(
      0,
      fileNameWithExtension.lastIndexOf(".")
    );
    const text = !settings.display.showExtension
      ? settings.display.showFullPath
        ? fullPathWithoutExtension
        : fileNameWithoutExtension
      : settings.display.showFullPath
      ? fullPath
      : fileNameWithExtension;
    return text;
  };

  private getNodeOpacityEasedValue = (node: Node) => {
    // get the position of the node
    // @ts-ignore
    const obj = node.__threeObj as THREE.Object3D | undefined;
    if (!obj) return 0;
    const nodePosition = obj.position;
    // then get the distance between the node and this.myCube , console.log it
    const distance = nodePosition.distanceTo(this.myCube.position);
    // change the opacity of the nodeEl base on the distance
    // the higher the distance, the lower the opacity
    // when the distance is 300, the opacity is 0
    const normalizedDistance = Math.min(distance, DISTANCE_FROM_FOCAL) / DISTANCE_FROM_FOCAL;
    const easedValue = 0.5 - 0.5 * Math.cos(normalizedDistance * Math.PI);
    return easedValue;
  };

  private focusOnNode = (node: Coords, duration = 3000) => {
    // Aim at node from outside it
    const distance = FOCAL_FROM_CAMERA;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

    const newPos =
      node.x || node.y || node.z
        ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
        : { x: 0, y: 0, z: distance }; // special case if node is in (0,0,0)

    this.instance.cameraPosition(
      newPos, // new position
      node, // lookAt ({ x, y, z })
      duration // ms transition duration
    );
  };
  private focusOnCoords = this.focusOnNode;

  private createNodes = () => {
    this.instance
      .nodeColor((node: Node) => {
        // return the rgba of yellow
        const color = this.getNodeColor(node);
        const factor = 1 / (1 - BASE_NODE_OPACITY);
        const rgba = hexToRGBA(color, (factor - this.getNodeOpacityEasedValue(node)) / factor);
        return rgba;
      })
      .onNodeHover(this.onNodeHover)
      .nodeThreeObject((node: Node) => {
        const nodeEl = document.createElement("div");

        const text = this.getNodeLabelText(node);
        nodeEl.textContent = text;
        // @ts-ignore
        nodeEl.style.color = node.color;
        nodeEl.className = "node-label";
        nodeEl.style.top = "20px";
        nodeEl.style.fontSize = "12px";
        nodeEl.style.padding = "1px 4px";
        nodeEl.style.borderRadius = "4px";
        nodeEl.style.backgroundColor = rgba(0, 0, 0, 0.5);
        nodeEl.style.userSelect = "none";

        const cssObject = new CSS2DObject(nodeEl);
        cssObject.onAfterRender = (renderer, scene, camera) => {
          nodeEl.style.opacity = `${1 - this.getNodeOpacityEasedValue(node)}`;
        };

        return cssObject;
      })
      .nodeThreeObjectExtend(true);

    this.instance
      .onNodeClick((node: Node & Coords, event: MouseEvent) => {
        if (event.shiftKey) {
          const isSelected = this.selectedNodes.has(node);
          // multi-selection
          isSelected ? this.selectedNodes.delete(node) : this.selectedNodes.add(node);
          // @ts-ignore
          // if (node.__threeObj)
          //   onPointerDown(
          //     // @ts-ignore
          //     node.__threeObj,
          //     this.instance.scene(),
          //     this.bloomComposer,
          //     this.finalComposer
          //   );
          return;
        }

        if (this.commandDown || event.ctrlKey) {
          this.focusOnCoords(node);
          return;
        }

        const clickedNodeFile = this.plugin.app.vault.getFiles().find((f) => f.path === node.path);

        if (clickedNodeFile) {
          if (this.isLocalGraph) {
            this.plugin.app.workspace.getLeaf(false).openFile(clickedNodeFile);
          } else {
            this.view.leaf.openFile(clickedNodeFile);
          }
        }
      })
      // https://github.com/vasturiano/3d-force-graph/blob/d82ecff3fe278ea46beb6d7a5720b00bd993f5e4/example/multi-selection/index.html#L42C9-L55C12
      .onNodeDrag((node: Node & Coords, translate) => {
        if (this.selectedNodes.has(node)) {
          // moving a selected node
          [...this.selectedNodes]
            .filter((selNode) => selNode !== node) // don't touch node being dragged
            .forEach((node) =>
              ["x", "y", "z"].forEach(
                // @ts-ignore
                (coord) => (node[`f${coord}`] = node[coord] + translate[coord])
              )
            ); // translate other nodes by same amount
        }
      })
      .onNodeDragEnd((node: Node & Coords) => {
        if (this.selectedNodes.has(node)) {
          // finished moving a selected node
          [...this.selectedNodes]
            .filter((selNode) => selNode !== node) // don't touch node being dragged
            // @ts-ignore
            .forEach((node) => ["x", "y", "z"].forEach((coord) => (node[`f${coord}`] = undefined))); // unfix controlled nodes
        }
      })
      .onNodeRightClick((node: Node, mouseEvent: MouseEvent) => {
        console.log("right click", node, mouseEvent);
        if (!this.selectedNodes.has(node)) {
          this.selectedNodes.clear();
          this.selectedNodes.add(node);
        }
        //   show a modal
        const modal = new CommandModal(this.view, this.selectedNodes);
        const promptEl = modal.containerEl.querySelector(".prompt");
        const dv = promptEl?.createDiv({
          text: `Commands will be run for ${this.selectedNodes.size} nodes.`,
        });
        dv?.setAttribute("style", "padding: var(--size-4-3); font-size: var(--font-smaller);");
        modal.open();
      });

    // post processing
    // this.instance.postProcessingComposer().addPass(bloomPass);
  };

  private createLinks = () => {
    const settings = this.plugin.getSettings();
    this.instance
      .linkWidth((link: Link) =>
        this.isHighlightedLink(link)
          ? settings.display.linkThickness * 1.5
          : settings.display.linkThickness
      )
      .linkDirectionalParticles((link: Link) =>
        this.isHighlightedLink(link) ? PARTICLE_FREQUECY : 0
      )
      .linkDirectionalParticleWidth(() => settings.display.linkThickness * LINK_PARTICLE_MULTIPLIER)
      .linkDirectionalArrowLength(
        () =>
          settings.display.linkThickness *
          LINK_ARROW_WIDTH_MULTIPLIER *
          (settings.display.showLinkArrow ? 1 : 0)
      )
      .linkDirectionalArrowRelPos(1)
      .onLinkHover(this.onLinkHover)
      .linkColor((link: Link) => {
        return this.isHighlightedLink(link)
          ? settings.display.linkHoverColor
          : this.plugin.theme.textMuted;
      })
      .d3Force("link")
      ?.distance(() => settings.display.linkDistance);
  };

  // TODO: optimise this
  private getGraphData = (): Graph => {
    function getGraph(this: ForceGraph) {
      const settings = this.plugin.getSettings();
      if (this.isLocalGraph && this.plugin.openFileState.value) {
        return this.plugin.globalGraph.clone().getLocalGraph(this.plugin.openFileState.value);
      } else {
        // const dvQuery = settings.filters.dvQuery.trim();
        const searchQuery = settings.filters.searchQuery.trim();
        // const dv = this.plugin.getDvApi();

        const totalNodeCount = this.plugin.globalGraph.nodes.length;

        // if there is no search query, we will simply return the global graph
        if (searchQuery === "") {
          if (totalNodeCount > this.plugin.settingsState.value.other.maxNodeNumber) {
            const message = `The number of nodes is ${totalNodeCount}, which is larger than the maxNodeNumber ${this.plugin.settingsState.value.other.maxNodeNumber}. The graph will not be shown.`;
            console.warn(message);
            new Notice(message);
            // return an empty graph
            return new Graph([], [], new Map(), new Map());
          }
          return this.plugin.globalGraph;
        }

        // const resultFilePaths =
        //   dvQuery !== "" && dv
        //     ? (() => {
        //         try {
        //           return dv.pagePaths(dvQuery);
        //         } catch (e) {
        //           return [];
        //         }
        //       })()
        //     : this.plugin.searchState.value.filter.files.map((file) => file.path) ?? [];
        const resultFilePaths =
          this.plugin.searchState.value.filter.files.map((file) => file.path) ?? [];

        if (resultFilePaths.length > this.plugin.settingsState.value.other.maxNodeNumber) {
          const message = `The number of nodes is ${resultFilePaths.length}, which is larger than the maxNodeNumber ${this.plugin.settingsState.value.other.maxNodeNumber}. The graph will not be shown.`;
          console.warn(message);
          new Notice(message);
          // return an empty graph
          return new Graph([], [], new Map(), new Map());
        }

        console.log("resultFilePaths", resultFilePaths.length);
        return this.plugin.globalGraph.filter((node) => {
          return (
            resultFilePaths.includes(node.path) &&
            // if not show orphans, the node must have at least one link
            (settings.filters.showOrphans || node.links.length > 0) &&
            // if not show attachments, the node must be ".md"
            (settings.filters.showAttachments || node.path.endsWith(".md"))
          );
        });
      }
    }
    const graph = getGraph.call(this);
    this.graph = graph;
    console.log(this.graph);
    if (this.graph.nodes.length > 0) {
      this.view.showGraphViewAndHideText();
    }
    return graph;
  };

  public refreshGraphData = () => {
    // console.log("refresh graph data");
    try {
      this.instance.graphData(this.getGraphData());
    } catch (e) {
      console.error(e);
    }
  };

  public handleSettingsChanged = (data: StateChange<unknown, GraphSettings>) => {
    // TODO: This should be organized better
    if (
      data.currentPath === "filters.dvQuery" ||
      data.currentPath === "filters.showOrphans" ||
      data.currentPath === "filters.showAttachments"
    ) {
      this.refreshGraphData();
    } else if (data.currentPath === "display.nodeSize") {
      this.instance.nodeRelSize(data.newValue as number);
      this.instance.refresh();
    } else if (data.currentPath === "display.linkDistance") {
      // https://github.com/vasturiano/3d-force-graph/blob/522d19a831e92015ff77fb18574c6b79acfc89ba/example/manipulate-link-force/index.html#L50-L55
      this.instance.d3Force("link")?.distance(data.newValue as number);
      this.instance.numDimensions(3); // reheat simulation
      this.instance.refresh();
    } else if (data.currentPath === "display.dagOrientation") {
      const noDag = data.newValue === "null";
      // @ts-ignore
      this.instance.dagMode(noDag ? null : data.newValue);
      this.instance.numDimensions(3); // reheat simulation
      this.instance.refresh();
    } else if (data.currentPath === "display.showCenterCoordinates") {
      this.centerCoordinateArrow.xArrow.visible =
        this.centerCoordinateArrow.yArrow.visible =
        this.centerCoordinateArrow.zArrow.visible =
          data.newValue as boolean;
      this.instance.refresh();
    }
  };

  public updateDimensions() {
    const [width, height] = [this.rootHtmlElement.offsetWidth, this.rootHtmlElement.offsetHeight];
    this.setDimensions(width, height);
  }

  public setDimensions(width: number, height: number) {
    this.instance.width(width);
    this.instance.height(height);

    // this.bloomComposer.setSize(width, height);
    // this.finalComposer.setSize(width, height);
  }

  private getNodeColor = (node: Node): string => {
    const settings = this.plugin.getSettings();
    if (this.selectedNodes.has(node)) {
      return selectedColor;
    }
    if (this.isHighlightedNode(node)) {
      return node === this.hoveredNode
        ? settings.display.nodeHoverColor
        : settings.display.nodeHoverNeighbourColor;
    } else {
      let color = this.plugin.theme.textMuted;
      settings.groups.groups
        // we only want to use the groups that have a query
        .filter((g) => g.query.trim().length !== 0)
        .forEach((group, index) => {
          const searchStateGroup = this.plugin.searchState.value.group[index]!;
          const searchGroupfilePaths = searchStateGroup.files.map((file) => file.path);

          // if the node path is in the searchGroupfiles, change the color to group.color
          if (searchGroupfilePaths.includes(node.path)) color = group.color;
        });
      return color;
    }
  };

  private onNodeHover = (node: Node | null) => {
    // TODO: not sure why, this.graph is undefined
    if (!this.graph) return;
    if ((!node && !this.highlightedNodes.size) || (node && this.hoveredNode === node)) return;

    // set node label text
    if (node) {
      const text = this.getNodeLabelText(node);
      this.nodeLabelEl.textContent = text;
      // @ts-ignore
      this.nodeLabelEl.style.color = node.color;
      this.nodeLabelEl.style.opacity = "1";
    } else {
      this.nodeLabelEl.style.opacity = "0";
    }

    this.clearHighlights();

    if (node) {
      this.highlightedNodes.add(node.id);
      node.neighbors.forEach((neighbor) => this.highlightedNodes.add(neighbor.id));
      const nodeLinks = this.graph.getLinksWithNode(node.id);

      if (nodeLinks) nodeLinks.forEach((link) => this.highlightedLinks.add(link));
    }
    this.hoveredNode = node ?? null;
    this.updateHighlight();
  };

  private isHighlightedLink = (link: Link): boolean => {
    return this.highlightedLinks.has(link);
  };

  private isHighlightedNode = (node: Node): boolean => {
    return this.highlightedNodes.has(node.id);
  };

  private onLinkHover = (link: Link | null) => {
    this.clearHighlights();

    if (link) {
      this.highlightedLinks.add(link);
      this.highlightedNodes.add(link.source.id);
      this.highlightedNodes.add(link.target.id);
    }
    this.updateHighlight();
  };

  private clearHighlights = () => {
    this.highlightedNodes.clear();
    this.highlightedLinks.clear();
  };

  private updateHighlight() {
    // trigger update of highlighted objects in scene
    this.instance
      .nodeColor(this.instance.nodeColor())
      .linkColor(this.instance.linkColor())
      .linkDirectionalParticles(this.instance.linkDirectionalParticles());
  }

  getInstance() {
    return this.instance;
  }
}
