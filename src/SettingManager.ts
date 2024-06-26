import type { ISettingManager } from "@/Interfaces";
import { AsyncQueue } from "@/util/AsyncQueue";
import type {
  Setting,
  GlobalGraphSettings,
  LocalGraphSettings,
  MarkdownPostProcessorGraphSettings,
  GraphSetting,
} from "@/SettingsSchemas";
import {
  SettingSchema,
  GraphType,
  SearchEngineType,
  CommandClickNodeAction,
  defaultLocalGraphSetting,
  defaultGlobalGraphSetting,
  defaultMarkdownPostProcessorGraphSetting,
} from "@/SettingsSchemas";
import { createNotice } from "@/util/createNotice";
import { State } from "@/util/State";
import type { Plugin } from "obsidian";

const corruptedMessage =
  "The setting is corrupted. You will not be able to save the setting. Please backup your data.json, remove it and reload the plugin. Then migrate your old setting back.";

/**
 * the plugin setting manager
 * @remarks the setting will not keep the temporary setting. It will only keep the saved settings.
 */
export class PluginSettingManager implements ISettingManager<Setting> {
  private plugin: Plugin;
  private setting: State<Setting> = new State(DEFAULT_SETTING);
  private asyncQueue = new AsyncQueue();

  /**
   * whether the setting is loaded successfully
   */
  private isLoaded = false;

  /**
   * @remarks don't forget to call `loadSettings` after creating this class
   */
  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * this function will update the setting and save it to the json file. But it is still a sync function.
   * You should always use this function to update setting
   */
  updateSettings(updateFunc: (setting: State<Setting>) => void): Setting {
    // update the setting first
    updateFunc(this.setting);
    // save the setting to json
    this.asyncQueue.push(this.saveSettings.bind(this));
    // return the updated setting
    return this.setting.value;
  }

  getSettings(): Setting {
    return this.setting.value;
  }

  /**
   * load the settings from the json file
   */
  async loadSettings() {
    // load the data, this can be null if the plugin is used for the first time
    const loadedData = (await this.plugin.loadData()) as unknown | null;

    // console.log("loaded: ", loadedData);

    // if the data is null, then we need to initialize the data
    if (!loadedData) {
      this.setting.value = DEFAULT_SETTING;
      this.isLoaded = true;
      await this.saveSettings();
      return this.setting.value;
    }

    const result = SettingSchema.safeParse(loadedData);
    // the data schema is wrong or the data is corrupted, then we need to initialize the data
    if (!result.success) {
      createNotice(corruptedMessage);
      console.warn("parsed loaded data failed", result.error.flatten());
      this.isLoaded = false;
      this.setting.value = DEFAULT_SETTING;
      return this.setting.value;
    }

    // console.log("parsed loaded data successfully");

    this.setting.value = result.data;
    return this.setting.value;
  }

  /**
   * save the settings to the json file
   */
  async saveSettings() {
    if (!this.isLoaded) {
      // try to parse it again to see if it is corrupted
      const result = SettingSchema.safeParse(this.setting.value);

      if (!result.success) {
        createNotice(corruptedMessage);
        console.warn("parsed loaded data failed", result.error.flatten());
        return;
      }

      this.isLoaded = true;
      // console.log("parsed loaded data successfully");
    }
    await this.plugin.saveData(this.setting.value);

    // debug
    // console.log("saved: ", this.setting.value);
  }

  static getNewSetting(type: GraphType.global): GlobalGraphSettings;
  static getNewSetting(type: GraphType.local): LocalGraphSettings;
  static getNewSetting(type: GraphType.postProcessor): MarkdownPostProcessorGraphSettings;
  static getNewSetting(type: GraphType): GraphSetting;
  static getNewSetting(type: GraphType) {
    if (type === GraphType.global) {
      return defaultGlobalGraphSetting;
    } else if (type === GraphType.local) {
      return defaultLocalGraphSetting;
    } else {
      return defaultMarkdownPostProcessorGraphSetting;
    }
  }
}

export const DEFAULT_SETTING: Setting = {
  savedSettings: [],
  temporaryLocalGraphSetting: defaultLocalGraphSetting,
  temporaryGlobalGraphSetting: defaultGlobalGraphSetting,
  pluginSetting: {
    maxNodeNumber: 1000,
    searchEngine: SearchEngineType.default,
    rightClickToPan: false,
    commandLeftClickNode: CommandClickNodeAction.openNodeInNewTab,
    commandRightClickNode: CommandClickNodeAction.focusNode,
  },
};
