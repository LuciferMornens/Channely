import { Sparkles, Github, Globe, Heart } from "lucide-react";

export function AboutTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">About</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          App information and credits.
        </p>
      </div>

      {/* App Info */}
      <section className="flex items-center gap-4 px-4 py-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Channely</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Version 0.1.0
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            System-wide AI text proofreading for macOS
          </p>
        </div>
      </section>

      {/* Built With */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Built With
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: "Tauri 2.0", desc: "Desktop runtime" },
            { name: "React 19", desc: "UI framework" },
            { name: "Cerebras", desc: "AI inference" },
          ].map((tech) => (
            <div
              key={tech.name}
              className="px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-center"
            >
              <p className="text-sm font-medium">{tech.name}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {tech.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Credits */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Credits
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Designed and built with{" "}
          <Heart className="inline h-3.5 w-3.5 text-red-500 -mt-0.5" /> for
          writers, developers, and anyone who types.
        </p>
      </section>

      {/* Links */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Links
        </h3>
        <div className="flex gap-3">
          <a
            href="https://github.com/channely"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-600 dark:text-neutral-400 hover:border-blue-400 transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <a
            href="https://channely.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-600 dark:text-neutral-400 hover:border-blue-400 transition-colors"
          >
            <Globe className="h-4 w-4" />
            Website
          </a>
        </div>
      </section>

      {/* License */}
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        MIT License · © 2026 Channely
      </p>
    </div>
  );
}
