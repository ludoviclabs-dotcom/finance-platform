"use client";

import type { ScreenId } from "./mockup-data";
import { MockupNav } from "./mockup-nav";
import { MockupScreen } from "./mockup-screens";

export function InteractiveDashboardMockup({
  activeScreen,
  onNavigate,
}: {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}) {
  return (
    <div className="flex h-full">
      <MockupNav activeScreen={activeScreen} onNavigate={onNavigate} />
      <div className="flex-1 min-w-0 overflow-hidden">
        <MockupScreen activeScreen={activeScreen} />
      </div>
    </div>
  );
}
