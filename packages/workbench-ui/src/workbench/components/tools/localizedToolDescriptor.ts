import type { ToolDescriptor, ToolParamSpec } from "@ai-agent-workflow/workflow-domain";

type Translate = (key: string, options?: { defaultValue?: string }) => string;

export function localizedToolDescriptor(descriptor: ToolDescriptor, t: Translate): ToolDescriptor {
  const baseKey = `tools.descriptors.${descriptor.toolName}`;
  return {
    ...descriptor,
    label: t(`${baseKey}.label`, { defaultValue: descriptor.label }),
    description: descriptor.description
      ? t(`${baseKey}.description`, { defaultValue: descriptor.description })
      : descriptor.description,
    params: descriptor.params.map((param) => localizedToolParamSpec(descriptor.toolName, param, t)),
  };
}

function localizedToolParamSpec(toolName: string, param: ToolParamSpec, t: Translate): ToolParamSpec {
  const baseKey = `tools.descriptors.${toolName}.params.${param.name}`;
  return {
    ...param,
    label: t(`${baseKey}.label`, { defaultValue: param.label }),
    placeholder: param.placeholder ? t(`${baseKey}.placeholder`, { defaultValue: param.placeholder }) : param.placeholder,
    help: param.help ? t(`${baseKey}.help`, { defaultValue: param.help }) : param.help,
    options: param.options?.map((option) => ({
      ...option,
      label: t(`${baseKey}.options.${option.value}`, { defaultValue: option.label }),
    })),
  };
}
