import { Notice, Plugin } from "obsidian";
import { Graph3dView } from "@/views/graph/Graph3dView";
import { GraphSettings } from "@/settings/GraphSettings";
import { State } from "@/util/State";
import { Graph } from "@/graph/Graph";
import { ObsidianTheme } from "@/util/ObsidianTheme";
import { ResolvedLinkCache } from "@/graph/Link";
import { deepCompare } from "@/util/deepCompare";
import { getGraphSettingsFromStore } from "@/settings/getGraphSettingsFromStore";
import "@total-typescript/ts-reset";
import "@total-typescript/ts-reset/dom";
import { eventBus } from "@/util/EventBus";
import { SearchResultFile } from "@/views/atomics/addSearchInput";

export default class Graph3dPlugin extends Plugin {
  _resolvedCache: ResolvedLinkCache;

  /**
   * the setting of the plugin
   */
  public settingsState: State<GraphSettings>;
  /**
   * the current open file
   */
  public openFileState: State<string | undefined> = new State(undefined);
  public searchState: State<{
    filter: {
      query: string;
      files: SearchResultFile[];
    };
    group: {
      query: string;
      files: SearchResultFile[];
    }[];
  }> = new State({ filter: { query: "", files: [] }, group: [] });
  private cacheIsReady: State<boolean> = new State(
    this.app.metadataCache.resolvedLinks !== undefined
  );

  // Other properties
  public globalGraph: Graph;
  public theme: ObsidianTheme;
  // Graphs that are waiting for cache to be ready
  private queuedGraphs: Graph3dView[] = [];
  private callbackUnregisterHandles: (() => void)[] = [];
  public activeGraphView: Graph3dView;

  async onload() {
    await this.init();
    this.addRibbonIcon("glasses", "3D Graph", this.openGlobalGraph);
    this.addCommand({
      id: "open-3d-graph-global",
      name: "Open Global 3D Graph",
      callback: this.openGlobalGraph,
    });

    this.addCommand({
      id: "open-3d-graph-local",
      name: "Open Local 3D Graph",
      callback: this.openLocalGraph,
    });
  }

  public triggerSearch = () => {
    eventBus.trigger("trigger-search");
  };

  private async init() {
    await this.initStates();
    this.initListeners();
  }

  private async initStates() {
    const settings = await this.loadSettings();
    this.settingsState = new State<GraphSettings>(settings);
    // initialize the search states
    this.searchState = new State({
      filter: {
        query: this.settingsState.value.filters.searchQuery,
        files: [],
      },
      group: this.settingsState.value.groups.groups.map((group) => {
        return {
          query: group.query,
          files: [],
        };
      }),
    });
    this.theme = new ObsidianTheme(this.app.workspace.containerEl);
    this.cacheIsReady.value = this.app.metadataCache.resolvedLinks !== undefined;
    this.onGraphCacheChanged();
  }

  private initListeners() {
    this.callbackUnregisterHandles.push(
      // save settings on change
      this.settingsState.onChange(() => this.saveSettings())
    );

    // internal event to reset settings to default
    eventBus.on("do-reset-settings", this.onDoResetSettings);

    // show open local graph button in file menu
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!file) return;
        menu.addItem((item) => {
          item
            .setTitle("Open in local 3D Graph")
            .setIcon("glasses")
            .onClick(() => this.openLocalGraph());
        });
      })
    );

    // when a file gets opened, update the open file state
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) this.openFileState.value = file.path;
      })
    );

    this.callbackUnregisterHandles.push(
      // when the cache is ready, open the queued graphs
      this.cacheIsReady.onChange((isReady) => {
        if (isReady) {
          this.openQueuedGraphs();
        }
      })
    );

    // all files are resolved, so the cache is ready:
    this.app.metadataCache.on("resolved", this.onGraphCacheReady.bind(this));
    // the cache changed:
    this.app.metadataCache.on("resolve", this.onGraphCacheChanged.bind(this));
  }

  // opens all queued graphs (graphs get queued if cache isnt ready yet)
  private openQueuedGraphs() {
    this.queuedGraphs.forEach((view) => view.showGraph());
    this.queuedGraphs = [];
  }

  private onGraphCacheReady = () => {
    console.log("Graph cache is ready");
    this.cacheIsReady.value = true;
    this.onGraphCacheChanged();
  };

  private onGraphCacheChanged = () => {
    // check if the cache actually updated
    // Obsidian API sends a lot of (for this plugin) unnecessary stuff
    // with the resolve event
    if (
      this.cacheIsReady.value &&
      !deepCompare(this._resolvedCache, this.app.metadataCache.resolvedLinks)
    ) {
      this._resolvedCache = structuredClone(this.app.metadataCache.resolvedLinks);
      this.globalGraph = Graph.createFromApp(this.app);
    } else {
      console.log(
        "changed but ",
        this.cacheIsReady.value,
        " and ",
        deepCompare(this._resolvedCache, this.app.metadataCache.resolvedLinks)
      );
    }
  };

  private onDoResetSettings = () => {
    this.settingsState.value.reset();
    // search the setting
    this.searchState.value = { filter: { query: "", files: [] }, group: [] };
    eventBus.trigger("did-reset-settings");
  };

  // Opens a local graph view in a new leaf
  private openLocalGraph = () => {
    const newFilePath = this.app.workspace.getActiveFile()?.path;

    if (newFilePath) {
      this.openFileState.value = newFilePath;
      this.openGraph(true);
    } else {
      new Notice("No file is currently open");
    }
  };

  // Opens a global graph view in the current leaf
  private openGlobalGraph = () => {
    this.openGraph(false);
  };

  // Open a global or local graph
  private openGraph = (isLocalGraph: boolean) => {
    eventBus.trigger("open-graph");
    const leaf = this.app.workspace.getLeaf(isLocalGraph ? "split" : false);
    const graphView = new Graph3dView(this, leaf, isLocalGraph);
    leaf.open(graphView);
    this.activeGraphView = graphView;
    if (this.cacheIsReady.value) {
      graphView.showGraph();
    } else {
      this.queuedGraphs.push(graphView);
    }
  };

  private async loadSettings(): Promise<GraphSettings> {
    const loadedData: unknown = await this.loadData(),
      settings = getGraphSettingsFromStore(!loadedData ? {} : loadedData);
    console.log("loadSettings:", settings);
    return settings;
  }

  async saveSettings() {
    console.log("saveSettings:", this.settingsState.getRawValue().toObject());
    await this.saveData(this.settingsState.getRawValue().toObject());
  }

  onunload() {
    super.onunload();
    this.callbackUnregisterHandles.forEach((handle) => handle());
    eventBus.off("do-reset-settings", this.onDoResetSettings);
  }

  public getSettings(): GraphSettings {
    return this.settingsState.value;
  }
}
