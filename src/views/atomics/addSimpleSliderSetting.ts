import { Setting } from "obsidian";

/**
 *
 * @param containerEl
 * @param options
 * @param onChange
 * @returns
 */
export const addSimpleSliderSetting = (
  containerEl: HTMLElement,
  options: SliderOptions,
  onChange: (newValue: number) => void
) => {
  const slider = new Setting(containerEl)
    .setName(options.name)
    .setClass("mod-slider")
    .addSlider((slider) => {
      return slider
        .setLimits(options.stepOptions.min, options.stepOptions.max, options.stepOptions.step)
        .setValue(options.value)
        .setDynamicTooltip()
        .onChange(async (value) => {
          onChange(value);
        });
    });
  return slider;
};

export interface SliderOptions {
  name: string;
  stepOptions: SliderStepOptions;
  value: number;
}

export interface SliderStepOptions {
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_SLIDER_STEP_OPTIONS: SliderStepOptions = {
  min: 1,
  max: 20,
  step: 1,
};
