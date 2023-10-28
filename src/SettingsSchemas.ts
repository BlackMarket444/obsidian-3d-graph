import { z } from "zod";

export enum GraphType {
  /**
   * the global graph
   */
  global = "global",
  /**
   * the local graph
   */
  local = "local",
}

export enum SearchEngineType {
  dataview = "dataview",
  default = "default",
  builtIn = "builtIn",
}

export enum DagOrientation {
  td = "td",
  bu = "bu",
  lr = "lr",
  rl = "rl",
  zout = "zout",
  zin = "zin",
  radialout = "radialout",
  radialin = "radialin",
  null = "null",
}

export const BaseDisplaySettingsSchema = z.object({
  nodeSize: z.number(),
  linkThickness: z.number(),
  linkDistance: z.number(),
  nodeHoverColor: z.string(),
  nodeHoverNeighbourColor: z.string(),
  nodeRepulsion: z.number(),
  linkHoverColor: z.string(),
  showExtension: z.boolean(),
  showFullPath: z.boolean(),
  showCenterCoordinates: z.boolean(),
  showLinkArrow: z.boolean(),
  dontMoveWhenDrag: z.boolean(),
  dagOrientation: z.undefined().or(z.nativeEnum(DagOrientation)),
});
export const LocalDisplaySettingsSchema = z.object({
  ...BaseDisplaySettingsSchema.shape,
});
export const LocalFilterSettingSchema = z.object({
  searchQuery: z.string(),
  showOrphans: z.boolean(),
  showAttachments: z.boolean(),
  depth: z.number(),
  linkType: z.literal("inlinks").or(z.literal("outlinks")).or(z.literal("both")),
});
export const BaseFilterSettingsSchema = z.object({
  searchQuery: z.string(),
  showOrphans: z.boolean(),
  showAttachments: z.boolean(),
});
export const GroupSettingsSchema = z.array(
  z.object({
    query: z.string(),
    color: z.string(),
  })
);
export const GlobalGraphSettingsSchema = z.object({
  filter: BaseFilterSettingsSchema,
  groups: GroupSettingsSchema,
  display: BaseDisplaySettingsSchema,
});
export const LocalGraphSettingsSchema = z.object({
  filter: LocalFilterSettingSchema,
  groups: GroupSettingsSchema,
  display: LocalDisplaySettingsSchema,
});
export const SavedSettingSchema = z.object({
  title: z.string(),
  id: z.string(),
  setting: GlobalGraphSettingsSchema.or(LocalGraphSettingsSchema),
  type: z.nativeEnum(GraphType),
});
export const SettingSchema = z.object({
  savedSettings: z.array(SavedSettingSchema),
  temporaryLocalGraphSetting: LocalGraphSettingsSchema,
  temporaryGlobalGraphSetting: GlobalGraphSettingsSchema,
  pluginSetting: z.object({
    maxNodeNumber: z.number(),
    searchEngine: z.nativeEnum(SearchEngineType),
  }),
});
