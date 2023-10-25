import { ExtraButtonComponent } from "obsidian";
import { addColorPicker } from "@/views/atomics/addColorPicker";
import { addSearchInput } from "@/views/atomics/addSearchInput";
import { GroupSettings } from "@/SettingManager";
import { Graph3dView } from "@/views/graph/Graph3dView";
import { IPassiveSearchEngine } from "@/Interfaces";

/**
 * given a group and a container element,
 * create a group setting item inside the container element
 */
export const AddNodeGroupItem = async (
  newGroup: GroupSettings[number],
  containerEl: HTMLElement,
  view: Graph3dView,
  /**
   * the index of this group
   */
  index: number
) => {
  // This group must exist
  const groupEl = containerEl.createDiv({ cls: "graph-color-group" });

  const searchInput = await addSearchInput(
    groupEl,
    newGroup.query,
    (value) => {
      view.settingManager.updateCurrentSettings((setting) => {
        setting.value.groups[index]!.query = value;
      });
    },
    view
  );

  if (searchInput && view.plugin.fileManager.searchEngine instanceof IPassiveSearchEngine)
    searchInput.addMutationObserver((files) => {
      console.log("set the graph config", files);
    });

  addColorPicker(groupEl, newGroup.color, (value) => {
    view.settingManager.updateCurrentSettings((setting) => {
      // This group must exist
      setting.value.groups[index]!.color = value;
    });
  });

  new ExtraButtonComponent(groupEl)
    .setIcon("cross")
    .setTooltip("Delete Group")
    .onClick(() => {
      // remove itself from the UI
      groupEl.remove();

      // remove from setting
      view.settingManager.updateCurrentSettings((setting) => {
        setting.value.groups.splice(index, 1);
      });
    });
};
