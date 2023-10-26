import { GlobalGraphSettings, GraphSetting } from "@/SettingManager";
import { GraphType } from "@/SettingsSchemas";
import Graph3dPlugin from "@/main";
import { Graph3dView } from "@/views/graph/Graph3dView";
import { SearchResult } from "@/views/settings/GraphSettingsManager";
import { WorkspaceLeaf } from "obsidian";

const getNewGlobalGraph = (
  plugin: Graph3dPlugin,
  config?: {
    searchResults: SearchResult["filter"]["files"];
    filterSetting: GlobalGraphSettings["filter"];
  }
) => {
  if (!config) return plugin.globalGraph;
  return plugin.globalGraph
    .filter((node) => {
      // if node is not a markdown  and show attachment is false, then we will not show it
      if (!node.path.endsWith(".md") && !config.filterSetting.showAttachments) return false;
      //  if the search query is not empty and the search result is empty, then we don't need to filter the search result
      if (config.searchResults.length === 0 && config.filterSetting.searchQuery === "") return true;
      // if the node is not in the files, then we will not show it
      return config.searchResults.some((file) => file.path === node.path);
    })
    .filter((node) => {
      // if node is an orphan and show orphan is false, then we will not show it
      if (node.links.length === 0 && !config.filterSetting.showOrphans) return false;
      return true;
    });
};

export class GlobalGraph3dView extends Graph3dView {
  constructor(plugin: Graph3dPlugin, leaf: WorkspaceLeaf) {
    super(leaf, plugin, GraphType.global, plugin.globalGraph);
  }

  public handleGroupColorSearchResultChange(): void {
    console.error("Method not implemented.");
  }

  public handleSearchResultChange(): void {
    this.updateGraphData();
  }

  public handleSettingUpdate(newSetting: GraphSetting, ...path: NestedKeyOf<GraphSetting>[]): void {
    if (path.includes("filter.showAttachments") || path.includes("filter.showOrphans")) {
      this.updateGraphData();
      return;
    }

    // other settings
    console.error("Method not implemented.");
  }

  protected updateGraphData() {
    super.updateGraphData(
      getNewGlobalGraph(this.plugin, {
        searchResults: this.settingManager.searchResult.value.filter.files,
        filterSetting: this.settingManager.getCurrentSetting().filter,
      })
    );
  }

  public handleMetadataCacheChange(): void {
    this.updateGraphData();
  }
}
