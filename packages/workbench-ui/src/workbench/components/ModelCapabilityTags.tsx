import { Image, MessageCircle } from "lucide-react";
import type { ModelCapability } from "./modelCatalog";

const capabilityIcons = {
  chat: {
    label: "Chat model",
    Icon: MessageCircle,
  },
  image: {
    label: "Image input",
    Icon: Image,
  },
} satisfies Record<ModelCapability, { label: string; Icon: typeof MessageCircle }>;

export function ModelCapabilityTags({ capabilities }: { capabilities: ModelCapability[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {capabilities.map((capability) => {
        const { Icon, label } = capabilityIcons[capability];
        return (
          <span
            key={capability}
            aria-label={label}
            className="flex size-5 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
            role="img"
            title={label}
          >
            <Icon size={12} aria-hidden />
          </span>
        );
      })}
    </span>
  );
}
