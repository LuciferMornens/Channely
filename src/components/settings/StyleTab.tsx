import { Coffee, Briefcase, Scissors, Heart } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const STYLES = [
  {
    value: "casual",
    label: "Casual",
    icon: Coffee,
    description: "Keep it casual and natural. Use contractions. Be conversational.",
    example: {
      before: "i dont want extension coz, for example",
      after: "I don't want an extension because, for example",
    },
  },
  {
    value: "professional",
    label: "Professional",
    icon: Briefcase,
    description: "Make it polished and professional. Proper grammar throughout.",
    example: {
      before: "i dont want extension coz, for example",
      after: "I do not want an extension because, for example",
    },
  },
  {
    value: "concise",
    label: "Concise",
    icon: Scissors,
    description: "Make it shorter. Remove filler words. Be direct.",
    example: {
      before: "i actually think that maybe we should probably consider this",
      after: "We should consider this",
    },
  },
  {
    value: "friendly",
    label: "Friendly",
    icon: Heart,
    description: "Warm and approachable tone. Keep it natural.",
    example: {
      before: "send the report by friday",
      after: "Could you send the report by Friday? Thanks!",
    },
  },
] as const;

export function StyleTab() {
  const { config, updateSettings } = useSettingsStore();

  if (!config) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Style</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Choose the default writing style for AI improvements.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Default Style
        </h3>

        <div className="space-y-3">
          {STYLES.map((style) => {
            const Icon = style.icon;
            const isActive = config.ai.default_style === style.value;

            return (
              <button
                key={style.value}
                type="button"
                onClick={() =>
                  updateSettings((c) => ({
                    ...c,
                    ai: { ...c.ai, default_style: style.value },
                  }))
                }
                className={`
                  w-full text-left px-4 py-3 rounded-lg border transition-all duration-150
                  ${
                    isActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500"
                      : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-300 dark:hover:border-blue-600"
                  }
                `.trim()}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive
                        ? "text-blue-500"
                        : "text-neutral-400"
                    }`}
                  />
                  <span className="text-sm font-medium">{style.label}</span>
                  {isActive && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-500 ml-auto">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 ml-6.5">
                  {style.description}
                </p>
                <div className="ml-6.5 text-xs space-y-0.5">
                  <p className="text-neutral-400">
                    <span className="text-red-400 line-through">{style.example.before}</span>
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400">
                    → {style.example.after}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
