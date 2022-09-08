import {Setting} from "obsidian";

const SimpleSliderSetting = (containerEl: HTMLElement, options: SliderOptions, onChange: (newValue: number) => void) => {
	new Setting(containerEl)
		.setName(options.name)
		.addSlider(
			(slider) => {
				slider.setLimits(options.stepOptions.min, options.stepOptions.max, options.stepOptions.step)
					.setValue(options.value)
					.onChange(async (value) => {
						onChange(value);
					});
			}
		)
}

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
}

export default SimpleSliderSetting;
